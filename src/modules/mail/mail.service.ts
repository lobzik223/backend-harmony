import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../../config/env.validation';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      if (!env.SMTP_PASS) {
        this.logger.warn('SMTP_PASS not set — verification emails will not be sent');
      }
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });
    }
    return this.transporter;
  }

  /**
   * Отправка кода подтверждения (6 цифр) на email пользователя при регистрации.
   */
  async sendVerificationCode(toEmail: string, code: string): Promise<void> {
    if (!env.SMTP_PASS) {
      this.logger.warn('SMTP_PASS not set — skipping sendVerificationCode');
      return;
    }
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #333;">
  <p>Здравствуйте!</p>
  <p>Ваш код подтверждения для регистрации в Harmony:</p>
  <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">${code}</p>
  <p>Код действителен 10 минут. Никому не сообщайте код.</p>
  <p>Если вы не регистрировались в Harmony — просто проигнорируйте это письмо.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #888;">Harmony — приложение для медитации и сна.</p>
</body>
</html>`;
    const text = `Ваш код подтверждения для регистрации в Harmony: ${code}. Код действителен 10 минут.`;

    await this.getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject: 'Код подтверждения — Harmony',
      text,
      html,
    });
    this.logger.log(`Verification email sent to ${toEmail}`);
  }
}
