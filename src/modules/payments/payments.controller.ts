import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessPayload } from '../auth/types/jwt-payload';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  getConfig() {
    return {
      subscriptionSiteUrl: this.paymentsService.getSubscriptionSiteUrl(),
    };
  }

  @Post('create')
  async createPayment(
    @Headers('x-harmony-site-key') siteKey: string,
    @Body()
    body: {
      planId: string;
      emailOrId: string;
      returnUrl: string;
      cancelUrl?: string;
    },
  ) {
    this.paymentsService.validateSiteKey(siteKey);
    if (!body.planId || !body.returnUrl) {
      throw new BadRequestException('Укажите тариф и URL возврата после оплаты');
    }
    return this.paymentsService.createYooKassaPayment(
      body.planId,
      body.emailOrId,
      body.returnUrl,
      body.cancelUrl || body.returnUrl,
    );
  }

  @Post('yookassa/webhook')
  async yookassaWebhook(@Body() body: { type?: string; event?: string; object?: { id?: string } }) {
    await this.paymentsService.handleYooKassaWebhook(body);
    return {};
  }

  @Post('confirm-return')
  async confirmReturn(
    @Headers('x-harmony-site-key') siteKey: string,
    @Body() body: { paymentId: string },
  ) {
    this.paymentsService.validateSiteKey(siteKey);
    if (!body.paymentId || typeof body.paymentId !== 'string') {
      throw new BadRequestException('Укажите paymentId');
    }
    return this.paymentsService.confirmReturnPayment(body.paymentId);
  }

  @Post('demo')
  async demoPayment(
    @Headers('x-harmony-site-key') siteKey: string,
    @Body() body: { emailOrId?: string; planId: string },
  ) {
    this.paymentsService.validateSiteKey(siteKey);
    const emailOrId = (body.emailOrId ?? '').toString().trim();
    if (!emailOrId) throw new BadRequestException('Укажите Email или ID аккаунта');
    if (!body.planId) throw new BadRequestException('Укажите тариф');
    return this.paymentsService.grantDemoSubscription(emailOrId, body.planId);
  }

  @Get('plans')
  getPlans() {
    return this.paymentsService.getPlans();
  }

  @Post('apple/verify')
  @UseGuards(JwtAccessGuard)
  async verifyApple(
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: { receipt: string; originalTransactionId?: string },
  ) {
    if (!body.receipt || typeof body.receipt !== 'string') {
      throw new BadRequestException('receipt required');
    }
    return this.paymentsService.verifyAppleAndActivate(
      user.sub,
      body.receipt,
    );
  }

  @Post('google/verify')
  @UseGuards(JwtAccessGuard)
  async verifyGoogle(
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: { purchaseToken: string; productId: string },
  ) {
    if (!body.purchaseToken || !body.productId) {
      throw new BadRequestException('purchaseToken and productId required');
    }
    return this.paymentsService.verifyGoogleAndActivate(
      user.sub,
      body.purchaseToken,
      body.productId,
    );
  }
}
