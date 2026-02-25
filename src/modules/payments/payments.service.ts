import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService, SUBSCRIPTION_NAME_PREMIUM } from '../subscriptions/entitlements.service';
import { env } from '../../config/env.validation';

export interface PaymentPlan {
  id: string;
  durationDays: number;
  price: number;
  description: string;
}

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private readonly plans: Record<string, PaymentPlan> = {
    '1month': {
      id: '1month',
      durationDays: 30,
      price: 299,
      description: 'Harmony Premium на 1 месяц',
    },
    '6months': {
      id: '6months',
      durationDays: 180,
      price: 1490,
      description: 'Harmony Premium на 6 месяцев',
    },
  };

  private readonly PLAN_IDS = ['1month', '6months'] as const;
  private readonly SIX_MONTHS_DAYS = 180;

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private getYooKassaAuth(): { shopId: string; secretKey: string } | null {
    const shopId = env.YOOKASSA_SHOP_ID;
    const secretKey = env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return null;
    return { shopId: String(shopId), secretKey };
  }

  getPlans() {
    return Object.values(this.plans);
  }

  async checkSubscriptionBeforePurchase(
    userId: string,
    planId: string,
  ): Promise<{ allowed: boolean; message?: string; warning?: string }> {
    const sub = await this.entitlementsService.getSubscription(userId);
    const now = new Date();
    const isActive = sub.currentPeriodEnd != null && sub.currentPeriodEnd > now;

    if (!isActive) return { allowed: true };

    const currentProduct = sub.productId ?? '';
    if (currentProduct === planId) {
      return {
        allowed: false,
        message:
          'У вас уже активна подписка на этот тариф. Повторная покупка недоступна. Дождитесь окончания или перейдите на тариф «6 месяцев».',
      };
    }

    if (currentProduct === '1month' && planId === '6months') {
      return {
        allowed: true,
        warning: 'Оставшиеся дни по месячному тарифу будут добавлены к новому периоду 6 месяцев.',
      };
    }

    if (currentProduct === '6months' && planId === '1month') {
      return {
        allowed: false,
        message: 'У вас активен тариф «6 месяцев». Переход на месячный возможен после его окончания.',
      };
    }

    return { allowed: true };
  }

  getSubscriptionSiteUrl() {
    return env.SUBSCRIPTION_SITE_URL;
  }

  async createYooKassaPayment(
    planId: string,
    emailOrId: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ confirmationUrl: string; paymentId: string; subscriptionWarning?: string }> {
    const auth = this.getYooKassaAuth();
    if (!auth) {
      this.logger.warn('[YooKassa] YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not set');
      throw new ServiceUnavailableException('Оплата через ЮKassa не настроена');
    }

    const plan = this.plans[planId];
    if (!plan) throw new BadRequestException('Неверный тариф');
    if (!this.PLAN_IDS.includes(planId as (typeof this.PLAN_IDS)[number])) {
      throw new BadRequestException('Доступны только тарифы «1 месяц» и «6 месяцев». Укажите planId: 1month или 6months.');
    }

    const trimmed = String(emailOrId).trim();
    if (!trimmed) throw new BadRequestException('Укажите Email или ID аккаунта из приложения');

    const user = await this.findUser(trimmed);
    if (!user) {
      this.logger.warn(`[YooKassa] Create payment rejected: account not found for emailOrId=${trimmed}`);
      throw new BadRequestException(
        'Аккаунт не найден. Проверьте Email или ID аккаунта из профиля в приложении.',
      );
    }

    const subscriptionCheck = await this.checkSubscriptionBeforePurchase(user.id, planId);
    if (!subscriptionCheck.allowed) {
      this.logger.warn(`[YooKassa] Rejected: userId=${user.id}, planId=${planId}: ${subscriptionCheck.message}`);
      throw new BadRequestException(subscriptionCheck.message);
    }

    const idempotenceKey = `harmony-${planId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const basicAuth = Buffer.from(`${auth.shopId}:${auth.secretKey}`).toString('base64');

    const body = {
      amount: { value: String(plan.price.toFixed(2)), currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
        enforce: false,
      },
      description: plan.description.slice(0, 128),
      metadata: { planId, emailOrId: trimmed },
    };

    const res = await fetch(`${YOOKASSA_API}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      id?: string;
      status?: string;
      confirmation?: { confirmation_url?: string };
      code?: string;
      description?: string;
    };

    if (!res.ok) {
      this.logger.warn('[YooKassa] Create payment failed', { code: data.code, description: data.description });
      throw new BadRequestException(data.description || 'Не удалось создать платёж');
    }

    const yookassaPaymentId = data.id!;
    const confirmationUrl = data.confirmation?.confirmation_url;

    if (!yookassaPaymentId || !confirmationUrl) {
      this.logger.warn('[YooKassa] Missing id or confirmation_url in response', data);
      throw new ServiceUnavailableException('Некорректный ответ от платёжной системы');
    }

    await this.prisma.yookassaPayment.create({
      data: {
        id: yookassaPaymentId,
        planId,
        emailOrId: trimmed,
        status: 'PENDING',
      },
    });

    this.logger.log(`[YooKassa] Payment created ${yookassaPaymentId} for plan ${planId}, emailOrId=${trimmed}`);

    const result: { confirmationUrl: string; paymentId: string; subscriptionWarning?: string } = {
      confirmationUrl,
      paymentId: yookassaPaymentId,
    };
    if (subscriptionCheck.warning) result.subscriptionWarning = subscriptionCheck.warning;
    return result;
  }

  async processSucceededYooKassaPayment(yookassaPaymentId: string): Promise<{ granted: boolean }> {
    const auth = this.getYooKassaAuth();
    if (!auth) return { granted: false };

    const existing = await this.prisma.yookassaPayment.findUnique({
      where: { id: yookassaPaymentId },
    });

    if (!existing) {
      this.logger.warn(`[YooKassa] Unknown payment ${yookassaPaymentId}`);
      return { granted: false };
    }

    if (existing.status === 'SUCCEEDED' && existing.grantedAt) {
      this.logger.log(`[YooKassa] Payment ${yookassaPaymentId} already granted`);
      return { granted: true };
    }

    const basicAuth = Buffer.from(`${auth.shopId}:${auth.secretKey}`).toString('base64');
    const getRes = await fetch(`${YOOKASSA_API}/payments/${yookassaPaymentId}`, {
      method: 'GET',
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!getRes.ok) {
      this.logger.warn(`[YooKassa] Failed to get payment ${yookassaPaymentId}`, getRes.status);
      return { granted: false };
    }

    const payment = (await getRes.json()) as {
      id: string;
      status: string;
      metadata?: { planId?: string; emailOrId?: string };
    };

    const statusLower = String(payment.status || '').toLowerCase();
    if (statusLower !== 'succeeded') {
      this.logger.log(
        `[YooKassa] Payment ${yookassaPaymentId} status="${payment.status}" — ${SUBSCRIPTION_NAME_PREMIUM} not granted`,
      );
      await this.prisma.yookassaPayment.update({
        where: { id: yookassaPaymentId },
        data: { status: (payment.status || 'UNKNOWN').toUpperCase().replace(/-/g, '_') },
      });
      return { granted: false };
    }

    const planId = payment.metadata?.planId ?? existing.planId;
    const emailOrId = payment.metadata?.emailOrId ?? existing.emailOrId;
    const plan = this.plans[planId];

    if (!plan) {
      this.logger.warn(`[YooKassa] Unknown planId ${planId} for payment ${yookassaPaymentId}`);
      await this.prisma.yookassaPayment.update({
        where: { id: yookassaPaymentId },
        data: { status: 'SUCCEEDED' },
      });
      return { granted: false };
    }

    const user = await this.findUser(emailOrId);
    if (!user) {
      this.logger.warn(`[YooKassa] User not found for emailOrId=${emailOrId}, payment ${yookassaPaymentId}`);
      await this.prisma.yookassaPayment.update({
        where: { id: yookassaPaymentId },
        data: { status: 'SUCCEEDED' },
      });
      return { granted: false };
    }

    const now = new Date();
    const existingSub = await this.entitlementsService.getSubscription(user.id);
    const isActive = existingSub.currentPeriodEnd != null && existingSub.currentPeriodEnd > now;

    if (isActive && existingSub.productId === planId) {
      this.logger.warn(`[YooKassa] Duplicate subscription: userId=${user.id}, planId=${planId} already active`);
      await this.prisma.yookassaPayment.update({
        where: { id: yookassaPaymentId },
        data: { status: 'SUCCEEDED', userId: user.id, grantedAt: now },
      });
      return { granted: true };
    }

    const isUpgrade =
      planId === '6months' &&
      existingSub.productId === '1month' &&
      existingSub.currentPeriodEnd != null &&
      existingSub.currentPeriodEnd > now;

    let newPeriodEnd: Date;
    if (isUpgrade) {
      newPeriodEnd = new Date(
        existingSub.currentPeriodEnd!.getTime() + this.SIX_MONTHS_DAYS * 24 * 60 * 60 * 1000,
      );
      this.logger.log(`[YooKassa] Upgrade: userId=${user.id}, 1month → 6months, new end ${newPeriodEnd.toISOString()}`);
    } else {
      newPeriodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    }

    await this.entitlementsService.setPremiumUntil(user.id, newPeriodEnd);

    await this.prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        productId: planId,
        store: 'INTERNAL',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
      },
      update: {
        productId: planId,
        store: 'INTERNAL',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: now,
      },
    });

    await this.prisma.yookassaPayment.update({
      where: { id: yookassaPaymentId },
      data: { status: 'SUCCEEDED', userId: user.id, grantedAt: now },
    });

    this.logger.log(
      `[YooKassa] ${SUBSCRIPTION_NAME_PREMIUM} granted for user ${user.id} after successful payment ${yookassaPaymentId}, plan ${planId}`,
    );
    return { granted: true };
  }

  async handleYooKassaWebhook(body: {
    type?: string;
    event?: string;
    object?: { id?: string };
  }): Promise<void> {
    if (body.type !== 'notification' || body.event !== 'payment.succeeded' || !body.object?.id) return;
    await this.processSucceededYooKassaPayment(body.object.id);
  }

  async confirmReturnPayment(paymentId: string): Promise<{ granted: boolean }> {
    const trimmed = String(paymentId).trim();
    if (!trimmed) throw new BadRequestException('Укажите идентификатор платежа');
    return this.processSucceededYooKassaPayment(trimmed);
  }

  async grantDemoSubscription(emailOrId: string, planId: string) {
    if (this.getYooKassaAuth()) {
      throw new BadRequestException('Демо-оплата отключена. Используйте оплату через ЮKassa.');
    }
    const plan = this.plans[planId];
    if (!plan) throw new BadRequestException('Неверный тариф');

    const user = await this.findUser(emailOrId);
    if (!user) {
      throw new BadRequestException('Пользователь не найден. Проверьте Email или ID аккаунта из приложения.');
    }

    await this.entitlementsService.grantPremium(user.id, plan.durationDays);
    this.logger.log(`[Demo] Granting premium to user ${user.id} for plan ${planId}`);
    return { success: true, userId: user.id, planId, days: plan.durationDays };
  }

  async findUser(emailOrId: string): Promise<{ id: string } | null> {
    const trimmed = String(emailOrId).trim().toLowerCase();

    const byId = await this.prisma.user.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    if (byId) return { id: byId.id };

    const byEmail = await this.prisma.user.findUnique({
      where: { email: trimmed },
      select: { id: true },
    });
    return byEmail ? { id: byEmail.id } : null;
  }

  validateSiteKey(key: string) {
    if (key !== env.SITE_API_KEY) {
      throw new UnauthorizedException('Invalid Site API Key');
    }
  }

  async verifyAppleAndActivate(
    userId: string,
    receipt: string,
  ): Promise<{ success: boolean }> {
    const secret = env.APPLE_SHARED_SECRET;
    if (!secret) {
      this.logger.warn('[Apple IAP] APPLE_SHARED_SECRET not set');
      throw new ServiceUnavailableException('Apple IAP not configured');
    }

    const body = { 'receipt-data': receipt, password: secret };
    const urls = [
      'https://buy.itunes.apple.com/verifyReceipt',
      'https://sandbox.itunes.apple.com/verifyReceipt',
    ];

    let lastStatus: number | undefined;
    for (const url of urls) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        status: number;
        receipt?: { in_app?: Array<{ expires_date_ms?: string }> };
        latest_receipt_info?: Array<{ expires_date_ms?: string }>;
      };
      lastStatus = data.status;

      if (data.status === 0) {
        const list = data.latest_receipt_info ?? data.receipt?.in_app ?? [];
        let expiresMs = 0;
        for (const item of list) {
          const ms = item.expires_date_ms ? parseInt(item.expires_date_ms, 10) : 0;
          if (ms > expiresMs) expiresMs = ms;
        }
        if (expiresMs > Date.now()) {
          const days = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
          await this.entitlementsService.grantPremium(userId, days);
          this.logger.log(`[Apple IAP] ${SUBSCRIPTION_NAME_PREMIUM} granted for user ${userId}`);
          return { success: true };
        }
      }
      if (data.status !== 21007) break;
    }

    this.logger.warn(`[Apple IAP] Verify failed status=${lastStatus}`);
    throw new BadRequestException('Invalid or expired receipt');
  }

  async verifyGoogleAndActivate(
    userId: string,
    purchaseToken: string,
    productId: string,
  ): Promise<{ success: boolean }> {
    const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS;
    const packageName = env.ANDROID_PACKAGE_NAME;
    if (!keyPath || !packageName) {
      this.logger.warn('[Google IAP] GOOGLE_APPLICATION_CREDENTIALS or ANDROID_PACKAGE_NAME not set');
      throw new ServiceUnavailableException('Google IAP not configured');
    }

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const androidPublisher = google.androidpublisher({ version: 'v3', auth });
    const res = await androidPublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });
    const data = res.data;
    const expiryMs = data.expiryTimeMillis ? parseInt(String(data.expiryTimeMillis), 10) : 0;
    if (expiryMs <= Date.now()) {
      throw new BadRequestException('Subscription expired');
    }
    const days = Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000));
    await this.entitlementsService.grantPremium(userId, days);
    this.logger.log(`[Google IAP] ${SUBSCRIPTION_NAME_PREMIUM} granted for user ${userId}`);
    return { success: true };
  }
}
