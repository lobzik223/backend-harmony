import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../../config/env.validation';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  typ: 'admin';
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string): string {
    const v = String(email ?? '').trim().toLowerCase().slice(0, 254);
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new BadRequestException('Некорректный формат email');
    }
    return v;
  }

  private validatePassword(password: string): void {
    const v = String(password ?? '');
    if (v.length < 8 || v.length > 200) {
      throw new BadRequestException('Пароль должен быть от 8 до 200 символов');
    }
    if (/[\x00-\x1f\x7f]/.test(v)) {
      throw new BadRequestException('Недопустимые символы в пароле');
    }
  }

  /** Вход админа: email + пароль, возвращает JWT. Пароль проверяется только по хэшу. */
  async login(email: string, password: string): Promise<{ token: string; email: string }> {
    const normalizedEmail = this.normalizeEmail(email);

    const admin = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!admin) {
      throw new UnauthorizedException('Неверная почта или пароль');
    }

    const ok = await argon2.verify(admin.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('Неверная почта или пароль');
    }

    const payload: AdminJwtPayload = {
      sub: admin.id,
      email: admin.email,
      typ: 'admin',
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: env.ADMIN_JWT_SECRET,
      expiresIn: env.ADMIN_JWT_TTL_SECONDS,
    });

    return { token, email: admin.email };
  }

  /** Создание админа (только из консоли через create-admin script). Пароль хэшируется argon2. */
  async createAdmin(email: string, password: string): Promise<{ id: string; email: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    this.validatePassword(password);

    const existing = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('Админ с таким email уже существует');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const admin = await this.prisma.admin.create({
      data: { email: normalizedEmail, passwordHash },
    });

    return { id: admin.id, email: admin.email };
  }
}
