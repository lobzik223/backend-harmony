import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscriptionStore } from './types';

export const SUBSCRIPTION_NAME_PREMIUM = 'PREMIUM';

export interface SubscriptionStatus {
  productId: string | null;
  store: SubscriptionStore | null;
  currentPeriodEnd: Date | null;
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async isPremium(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUntil: true },
    });
    if (!user || !user.premiumUntil) return false;
    return new Date() < user.premiumUntil;
  }

  async getSubscription(userId: string): Promise<SubscriptionStatus> {
    const [sub, user] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } }),
    ]);

    if (sub) {
      return {
        productId: sub.productId,
        store: sub.store as SubscriptionStore | null,
        currentPeriodEnd: sub.currentPeriodEnd,
      };
    }

    return {
      productId: null,
      store: null,
      currentPeriodEnd: user?.premiumUntil ?? null,
    };
  }

  async grantPremium(userId: string, days: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUntil: true },
    });
    if (!user) return;

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const endDate =
      user.premiumUntil && user.premiumUntil > now
        ? new Date(user.premiumUntil.getTime() + days * dayMs)
        : new Date(now.getTime() + days * dayMs);

    await this.prisma.user.update({
      where: { id: userId },
      data: { premiumUntil: endDate },
    });
  }

  async setPremiumUntil(userId: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { premiumUntil: until },
    });
  }
}
