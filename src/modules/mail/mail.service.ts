import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../../config/env.validation';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private verifyPromise: Promise<boolean> | null = null;

  private createTransporter(): nodemailer.Transporter {
    if (!env.SMTP_PASS) {
      this.logger.warn('SMTP_PASS not set — verification emails will not be sent');
    }
    const port = env.SMTP_PORT;
    const secure = env.SMTP_SECURE;
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      requireTLS: !secure && port === 587,
      tls: env.SMTP_TLS_INSECURE ? { rejectUnauthorized: false } : undefined,
    });
    return transporter;
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
    }
    return this.transporter;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`SMTP config: host=${env.SMTP_HOST} port=${env.SMTP_PORT} secure=${env.SMTP_SECURE} user=${env.SMTP_USER || '(none)'}`);
    if (!env.SMTP_PASS) {
      this.logger.warn('SMTP_PASS is empty — verification emails disabled. Set SMTP_PASS in .env to the mailbox password.');
      return;
    }
    this.verifyPromise = this.getTransporter()
      .verify()
      .then(() => {
        this.logger.log('SMTP connection verified successfully');
        return true;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `SMTP connection failed: ${msg}. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. For self-signed cert try SMTP_TLS_INSECURE=true`,
        );
        const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : null;
        if (code) this.logger.error(`SMTP error code: ${code}`);
        return false;
      });
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

    try {
      await this.getTransporter().sendMail({
        from: env.SMTP_FROM,
        to: toEmail,
        subject: 'Код подтверждения — Harmony',
        text,
        html,
      });
      this.logger.log(`Verification email sent to ${toEmail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const response = err && typeof err === 'object' && 'response' in err ? String((err as { response: string }).response) : '';
      const suffix = response ? ` | Server: ${response}` : '';
      this.logger.error(`Failed to send verification email to ${toEmail}: ${msg}${suffix}`);
      if (err instanceof Error && err.stack) {
        this.logger.debug(err.stack);
      }
      if (msg.includes('certificate') || msg.includes('TLS') || (err as NodeJS.ErrnoException)?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        this.logger.warn('If your mail server uses a self-signed certificate, set SMTP_TLS_INSECURE=true in .env');
      }
    }
  }
}
