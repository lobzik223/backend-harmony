import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService, SUBSCRIPTION_NAME_PREMIUM } from '../subscriptions/entitlements.service';
import { AuthProtectionService } from './auth-protection.service';
import { MailService } from '../mail/mail.service';
import { env } from '../../config/env.validation';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload';

type Tokens = { accessToken: string; refreshToken: string };

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  surname: string;
  createdAt: string;
  premiumUntil: string | null;
  subscription: typeof SUBSCRIPTION_NAME_PREMIUM | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authProtection: AuthProtectionService,
    private readonly entitlementsService: EntitlementsService,
    private readonly mailService: MailService,
  ) {}

  /** Строгая валидация email: формат, длина, запрет управляющих символов. */
  private normalizeEmail(email: string): string {
    const v = String(email ?? '').trim().toLowerCase().slice(0, 254);
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new BadRequestException('Некорректный формат email');
    }
    if (/[\x00-\x1f\x7f]/.test(v)) {
      throw new BadRequestException('Недопустимые символы в email');
    }
    return v;
  }

  /** Строгая валидация имени/фамилии. */
  private sanitizeName(name: string, field: string): string {
    const v = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!v) throw new BadRequestException(`Введите ${field}`);
    if (/[\x00-\x1f\x7f]/.test(v)) {
      throw new BadRequestException(`Недопустимые символы в ${field}`);
    }
    return v;
  }

  /** Стандартная валидация пароля: от 8 до 128 символов. Без требований к составу. */
  private validatePassword(password: string): void {
    const v = String(password ?? '');
    if (v.length < 8) {
      throw new BadRequestException('Пароль не короче 8 символов');
    }
    if (v.length > 128) {
      throw new BadRequestException('Пароль не длиннее 128 символов');
    }
  }

  private async signTokens(user: { id: string; email: string }, sessionId: string): Promise<Tokens> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      typ: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      jti: sessionId,
      typ: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_REFRESH_TTL_SECONDS,
    });

    return { accessToken, refreshToken };
  }

  /** Генерация 6-значного кода подтверждения (безопасный случайный). */
  private generateVerificationCode(): string {
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, '0');
  }

  /**
   * Регистрация по email/паролю, шаг 1: отправка 6-значного кода на email.
   * Аккаунт в БД не создаётся — только запись в PendingRegistration. Аккаунт создаётся в verifyEmail после ввода кода.
   */
  async register(input: {
    name: string;
    surname: string;
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authProtection.assertNotBlocked(input.ip, input.email);
    this.authProtection.checkRegistrationLimit(input.ip ?? 'unknown');

    const email = this.normalizeEmail(input.email);
    const name = this.sanitizeName(input.name, 'имя');
    const surname = this.sanitizeName(input.surname, 'фамилию');
    this.validatePassword(input.password);

    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      await this.authProtection.recordFailedAuth(input.ip, email);
      throw new ConflictException('Email уже зарегистрирован');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const code = this.generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    await this.prisma.pendingRegistration.upsert({
      where: { email },
      create: { email, code, codeExpiresAt, name, surname, passwordHash },
      update: { code, codeExpiresAt, name, surname, passwordHash },
    });

    await this.mailService.sendVerificationCode(email, code);
    await this.authProtection.clearAuthAttempts(input.ip, email);

    return {
      message: 'Код отправлен на вашу почту',
      sent: true,
    };
  }

  /**
   * Регистрация по email/паролю, шаг 2: проверка кода и создание аккаунта в БД. Возвращает токены.
   * Без успешного verifyEmail аккаунт не создаётся (только для регистрации через форму; Google/Apple — без кода).
   */
  async verifyEmail(input: { email: string; code: string; ip?: string; userAgent?: string }) {
    const email = this.normalizeEmail(input.email);
    const code = String(input.code).trim();

    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });
    if (!pending) {
      throw new BadRequestException('Код не найден или истёк. Запросите новый код при регистрации.');
    }
    if (pending.code !== code) {
      throw new BadRequestException('Неверный код подтверждения');
    }
    if (new Date() > pending.codeExpiresAt) {
      await this.prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
      throw new BadRequestException('Код истёк. Запросите новый код при регистрации.');
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: pending.email,
        name: pending.name,
        surname: pending.surname,
        passwordHash: pending.passwordHash,
        premiumUntil: null,
        nameChangeCount: 0,
        refreshSessions: {
          create: {
            id: sessionId,
            expiresAt,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
          },
        },
      },
      include: { refreshSessions: { where: { id: sessionId } } },
    });

    await this.prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});

    const tokens = await this.signTokens({ id: user.id, email: user.email }, sessionId);

    return {
      message: 'ok',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        createdAt: user.createdAt.toISOString(),
        premiumUntil: null,
        subscription: null,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Вход. Пароль проверяется только по хэшу (argon2.verify); в ответы и логи не попадает.
   * В БД хранится только хэш, исходный пароль на сервере не сохраняется.
   */
  async login(input: { email: string; password: string; ip?: string; userAgent?: string }) {
    await this.authProtection.assertNotBlocked(input.ip, input.email);

    const email = this.normalizeEmail(input.email);

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        createdAt: true,
        premiumUntil: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      await this.authProtection.recordFailedAuth(input.ip, email);
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) {
      await this.authProtection.recordFailedAuth(input.ip, email);
      throw new UnauthorizedException('Неверный email или пароль');
    }

    await this.authProtection.clearAuthAttempts(input.ip, email);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    const premiumUntil = user.premiumUntil;
    const isPremium = premiumUntil != null && premiumUntil.getTime() > Date.now();

    const tokens = await this.signTokens({ id: user.id, email: user.email }, sessionId);

    return {
      message: 'ok',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        createdAt: user.createdAt.toISOString(),
        premiumUntil: premiumUntil ? premiumUntil.toISOString() : null,
        subscription: isPremium ? SUBSCRIPTION_NAME_PREMIUM : null,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async loginWithGoogle(input: { idToken: string; ip?: string; userAgent?: string }) {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.idToken)}`,
    ).catch(() => null);
    if (!res?.ok) throw new UnauthorizedException('Недействительный Google токен');

    const payload = (await res.json()) as {
      email?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };
    const email = payload.email ? this.normalizeEmail(payload.email) : null;
    if (!email) throw new UnauthorizedException('Google токен не содержит email');

    const name =
      payload.name?.trim() ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim() ||
      email.split('@')[0];
    const safeName = (name ?? email).slice(0, 80);

    let user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      // Регистрация через Google: аккаунт создаётся сразу, без подтверждения по коду на почту
      user = await this.prisma.user.create({
        data: {
          email,
          name: safeName,
          surname: '',
          passwordHash: null,
          nameChangeCount: 0,
        },
      });
      await this.prisma.pendingRegistration.deleteMany({ where: { email } }).catch(() => {});
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    const premiumUntil = user.premiumUntil;
    const isPremium = premiumUntil != null && premiumUntil.getTime() > Date.now();
    const tokens = await this.signTokens({ id: user.id, email: user.email }, sessionId);

    return {
      message: 'ok',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        createdAt: user.createdAt.toISOString(),
        premiumUntil: premiumUntil ? premiumUntil.toISOString() : null,
        subscription: isPremium ? SUBSCRIPTION_NAME_PREMIUM : null,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async loginWithApple(input: { identityToken: string; ip?: string; userAgent?: string }) {
    const token = input.identityToken;
    let header: { kid?: string; alg?: string };
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT');
      const part0 = parts[0];
      if (!part0) throw new Error('Invalid JWT');
      header = JSON.parse(Buffer.from(part0, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Недействительный Apple токен');
    }

    const kid = header.kid;
    if (!kid) throw new UnauthorizedException('Apple токен без kid');

    const keysRes = await fetch('https://appleid.apple.com/auth/keys').catch(() => null);
    if (!keysRes?.ok) throw new UnauthorizedException('Не удалось проверить Apple токен');

    const keysBody = (await keysRes.json()) as { keys?: Array<{ kid: string; n: string; e: string; kty: string }> };
    const jwk = keysBody.keys?.find((k) => k.kid === kid);
    if (!jwk?.n || !jwk?.e) throw new UnauthorizedException('Ключ Apple не найден');

    let payload: { iss?: string; sub?: string; email?: string };
    try {
      const publicKey = crypto.createPublicKey({
        key: { kty: jwk.kty || 'RSA', n: jwk.n, e: jwk.e },
        format: 'jwk',
      });
      payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
      }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Недействительный или просроченный Apple токен');
    }

    if (payload.iss !== 'https://appleid.apple.com') throw new UnauthorizedException('Неверный издатель Apple токена');

    const email = payload.email ? this.normalizeEmail(payload.email) : null;
    if (!email) throw new UnauthorizedException('Apple токен не содержит email');

    const safeName = (email.split('@')[0] ?? email).slice(0, 80);

    let user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      // Регистрация через Apple: аккаунт создаётся сразу, без подтверждения по коду на почту
      user = await this.prisma.user.create({
        data: {
          email,
          name: safeName,
          surname: '',
          passwordHash: null,
          nameChangeCount: 0,
        },
      });
      await this.prisma.pendingRegistration.deleteMany({ where: { email } }).catch(() => {});
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    const premiumUntil = user.premiumUntil;
    const isPremium = premiumUntil != null && premiumUntil.getTime() > Date.now();
    const tokens = await this.signTokens({ id: user.id, email: user.email }, sessionId);

    return {
      message: 'ok',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        createdAt: user.createdAt.toISOString(),
        premiumUntil: premiumUntil ? premiumUntil.toISOString() : null,
        subscription: isPremium ? SUBSCRIPTION_NAME_PREMIUM : null,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /** Текущий пользователь. passwordHash не запрашивается и в ответ не попадает. */
  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        createdAt: true,
        premiumUntil: true,
      },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    const premiumUntil = user.premiumUntil;
    const isPremiumActive = premiumUntil != null && premiumUntil.getTime() > Date.now();
    const sub = await this.entitlementsService.getSubscription(userId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        createdAt: user.createdAt.toISOString(),
        premiumUntil: premiumUntil ? premiumUntil.toISOString() : null,
        subscription: isPremiumActive ? SUBSCRIPTION_NAME_PREMIUM : null,
        subscriptionProductId: sub.productId,
        subscriptionStore: sub.store,
        subscriptionPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      },
    };
  }

  /** Обновление токенов: сессия только в БД, при подозрении — отзыв всех сессий пользователя. */
  async refresh(userId: string, sessionId: string, meta?: { ip?: string; userAgent?: string }) {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token истёк');
    }

    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Подозрительная активность. Выполните вход заново.');
    }

    const newSessionId = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    await this.prisma.$transaction([
      this.prisma.refreshSession.create({
        data: {
          id: newSessionId,
          userId,
          expiresAt: newExpiresAt,
          ip: meta?.ip ?? null,
          userAgent: meta?.userAgent ?? null,
        },
      }),
      this.prisma.refreshSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), replacedById: newSessionId },
      }),
    ]);

    const tokens = await this.signTokens({ id: userId, email: user.email }, newSessionId);

    return {
      message: 'ok',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.refreshSession
      .updateMany({
        where: { id: sessionId, userId },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
    return { message: 'ok' };
  }

  /** Удаление аккаунта пользователем: soft delete (deletedAt), отзыв всех сессий. */
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: now },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId },
        data: { revokedAt: now },
      }),
    ]);
    return { message: 'ok' };
  }

  /** Обновление профиля: имя/фамилия не чаще раз в 14 дней (контроль в БД). */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const hasName = dto.name != null && dto.name.trim().length > 0;
    const hasSurname = dto.surname != null && dto.surname.trim().length > 0;
    if (!hasName && !hasSurname) return this.me(userId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    const now = new Date();
    const isFirstChange = user.nameChangeCount === 0;

    if (!isFirstChange && user.nameUpdatedAt) {
      const diffDays = (now.getTime() - user.nameUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 14) {
        const remainingDays = Math.ceil(14 - diffDays);
        throw new BadRequestException(
          `Сменить имя можно раз в 14 дней. Попробуйте через ${remainingDays} дн.`,
        );
      }
    }

    const updateData: { nameUpdatedAt: Date; nameChangeCount: number; name?: string; surname?: string } = {
      nameUpdatedAt: now,
      nameChangeCount: user.nameChangeCount + 1,
    };
    if (hasName) updateData.name = dto.name!.trim().slice(0, 50);
    if (hasSurname) updateData.surname = dto.surname!.trim().slice(0, 50);

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.me(userId);
  }
}
