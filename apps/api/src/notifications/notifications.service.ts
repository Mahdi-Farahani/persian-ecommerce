import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from './notification.provider.js';

const APP_NAME = 'بازارچه';

/**
 * Business-level notification API. Composes Persian messages and delegates
 * transport to the configured provider. Failures are logged and never break
 * the calling request.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
    private readonly config: AppConfigService,
  ) {}

  async sendPasswordReset(
    target: { email: string | null; phone: string | null },
    token: string,
  ): Promise<void> {
    const link = `${this.config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.safely(async () => {
      if (target.email) {
        await this.provider.sendEmail({
          to: target.email,
          subject: `${APP_NAME} — بازیابی رمز عبور`,
          text: `برای تنظیم رمز عبور جدید روی پیوند زیر بزنید (اعتبار محدود):\n${link}`,
        });
      } else if (target.phone) {
        await this.provider.sendSms({
          to: target.phone,
          text: `${APP_NAME}: پیوند بازیابی رمز عبور ${link}`,
        });
      }
    });
  }

  async sendVerificationCode(
    channel: 'EMAIL' | 'PHONE',
    target: string,
    code: string,
  ): Promise<void> {
    await this.safely(async () => {
      if (channel === 'EMAIL') {
        await this.provider.sendEmail({
          to: target,
          subject: `${APP_NAME} — کد تأیید ایمیل`,
          text: `کد تأیید شما: ${code}`,
        });
      } else {
        await this.provider.sendSms({ to: target, text: `${APP_NAME} کد تأیید: ${code}` });
      }
    });
  }

  private async safely(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.logger.error(
        `Notification delivery failed via ${this.provider.name}: ${(error as Error).message}`,
      );
    }
  }
}
