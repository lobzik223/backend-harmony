import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FAILED_AUTH_MAX = 7;
const BLOCK_DURATION_MS = 3 * 60 * 1000;
const REGISTRATIONS_PER_IP_PER_HOUR = 5;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface RegistrationRecord {
  count: number;
  windowStart: number;
}

@Injectable()
export class AuthProtectionService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthProtectionService.name);
  private readonly registrationsByIp = new Map<string, RegistrationRecord>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.startCleanup();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      for (const [key, rec] of this.registrationsByIp) {
        if (Date.now() - rec.windowStart > 60 * 60 * 1000) {
          this.registrationsByIp.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  /** Проверка блокировки по IP и email — данные только из БД. */
  async assertNotBlocked(ip?: string, email?: string): Promise<void> {
    const now = new Date();
    const keys = this.getKeys(ip, email);

    for (const key of keys) {
      const row = await this.prisma.authLockout.findUnique({
        where: { key },
      });
      if (row?.lockedUntil && row.lockedUntil > now) {
        const retryAfter = Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 1000);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Слишком много попыток. Окно входа/регистрации заблокировано на 3 минуты. Попробуйте позже.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  /** Записать неудачную попытку в БД; после 7-й — блокировка на 3 мин, при новой неудаче в блоке — +3 мин. */
  async recordFailedAuth(ip?: string, email?: string): Promise<void> {
    const now = new Date();
    const keys = this.getKeys(ip, email);

    for (const key of keys) {
      const row = await this.prisma.authLockout.findUnique({ where: { key } });
      const attempts = (row?.attempts ?? 0) + 1;
      let lockedUntil: Date | null = row?.lockedUntil ?? null;

      if (lockedUntil && lockedUntil > now) {
        lockedUntil = new Date(lockedUntil.getTime() + BLOCK_DURATION_MS);
        this.logger.warn(`[SECURITY] Block extended for key ${key.slice(0, 40)}... (+3 min)`);
      } else if (attempts >= FAILED_AUTH_MAX) {
        lockedUntil = new Date(now.getTime() + BLOCK_DURATION_MS);
        this.logger.warn(
          `[SECURITY] Blocked for ${BLOCK_DURATION_MS / 1000}s after ${FAILED_AUTH_MAX} failed attempts (key: ${key.slice(0, 40)}...)`,
        );
      }

      await this.prisma.authLockout.upsert({
        where: { key },
        create: { key, attempts, lockedUntil, updatedAt: now },
        update: { attempts, lockedUntil, updatedAt: now },
      });
    }
  }

  async clearAuthAttempts(ip?: string, email?: string): Promise<void> {
    const keys = this.getKeys(ip, email);
    await this.prisma.authLockout.deleteMany({
      where: { key: { in: keys } },
    });
  }

  isLoginBlocked(ip: string): Promise<boolean> {
    return this.assertNotBlocked(ip)
      .then(() => false)
      .catch((e) => e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS);
  }

  recordFailedLogin(ip: string): Promise<void> {
    return this.recordFailedAuth(ip);
  }

  clearFailedLogins(ip: string): Promise<void> {
    return this.clearAuthAttempts(ip);
  }

  checkRegistrationLimit(ip: string): void {
    const key = this.normalizeKey(ip);
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    let rec = this.registrationsByIp.get(key);

    if (!rec) {
      rec = { count: 0, windowStart: now };
      this.registrationsByIp.set(key, rec);
    }

    if (now - rec.windowStart > hourMs) {
      rec.count = 0;
      rec.windowStart = now;
    }

    if (rec.count >= REGISTRATIONS_PER_IP_PER_HOUR) {
      this.logger.warn(`[SECURITY] Registration limit exceeded for IP ${ip}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Слишком много попыток регистрации. Попробуйте через час.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    rec.count += 1;
  }

  private getKeys(ip?: string, email?: string): string[] {
    const keys: string[] = [];
    if (ip) keys.push('ip:' + this.normalizeKey(ip));
    if (email) keys.push('email:' + String(email).trim().toLowerCase().slice(0, 256));
    return keys.length ? keys : ['ip:unknown'];
  }

  private normalizeKey(ip: string): string {
    return (ip || 'unknown').trim().slice(0, 64);
  }
}
