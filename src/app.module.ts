import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import { env } from './config/env.validation';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL_SECONDS,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    SubscriptionsModule,
    PaymentsModule,
    PushNotificationsModule,
  ],
})
export class AppModule {}
