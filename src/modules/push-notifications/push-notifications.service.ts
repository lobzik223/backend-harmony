import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updatePushToken(
    userId: string,
    dto: { deviceId: string; pushToken?: string | null; platform?: string; preferredLocale?: string },
  ) {
    const deviceId = String(dto.deviceId ?? '').trim();
    if (!deviceId) {
      throw new InternalServerErrorException('deviceId is required');
    }

    const platform = dto.platform == null ? null : String(dto.platform).toLowerCase();

    const existing = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!existing) {
      await this.prisma.device.create({
        data: {
          id: deviceId,
          userId,
          platform,
          pushToken: dto.pushToken ?? null,
          preferredLocale: dto.preferredLocale ?? null,
        },
      });
      this.logger.log(`[PUSH] Token registered: userId=${userId} deviceId=${deviceId} platform=${platform ?? '?'} hasToken=${!!dto.pushToken}`);
      return { deviceId };
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        userId,
        ...(dto.platform !== undefined && { platform }),
        ...(dto.pushToken !== undefined && { pushToken: dto.pushToken ?? null }),
        ...(dto.preferredLocale !== undefined && { preferredLocale: dto.preferredLocale }),
        lastSeenAt: new Date(),
      },
    });
    this.logger.log(`[PUSH] Token updated: userId=${userId} deviceId=${deviceId} hasToken=${!!dto.pushToken}`);
    return { deviceId };
  }

  async getUserPushTokens(
    userId: string,
  ): Promise<Array<{ token: string; platform: string | null; preferredLocale: string | null }>> {
    const devices = await this.prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { pushToken: true, platform: true, preferredLocale: true },
    });

    return devices
      .filter((d) => d.pushToken != null)
      .map((d) => ({
        token: d.pushToken!,
        platform: d.platform ?? null,
        preferredLocale: d.preferredLocale ?? null,
      }));
  }

  async sendPushNotification(
    token: string,
    platform: string | null,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    const isExpoToken =
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      token.startsWith('ExpoPushToken');

    if (!isExpoToken) {
      this.logger.warn(`[PUSH] Not an Expo token (${platform || 'unknown'}): ${token.substring(0, 20)}...`);
      return false;
    }

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title,
          body,
          data: data ?? {},
          sound: 'default',
          channelId: 'harmony_default',
        }),
      });

      const json = (await res.json().catch(() => null)) as { data?: Array<{ status?: string }> };
      const entry = Array.isArray(json?.data) ? json.data[0] : null;
      const ok = res.ok && entry?.status === 'ok';

      if (!ok) {
        this.logger.warn(`[PUSH] Failed (${platform || 'unknown'}) ${token.substring(0, 20)}...`);
        return false;
      }

      this.logger.log(`[PUSH] Sent (${platform || 'unknown'}): ${title}`);
      return true;
    } catch (e) {
      this.logger.warn(`[PUSH] Error sending push: ${(e as Error).message}`);
      return false;
    }
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const tokens = await this.getUserPushTokens(userId);
    if (tokens.length === 0) {
      this.logger.warn(`[PUSH] No push tokens for user ${userId}`);
      return;
    }

    const results = await Promise.allSettled(
      tokens.map(({ token, platform }) =>
        this.sendPushNotification(token, platform, title, body, data),
      ),
    );
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    this.logger.log(`[PUSH] Sent to ${successCount}/${tokens.length} devices for user ${userId}`);
  }
}
