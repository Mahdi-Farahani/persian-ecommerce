import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage, NotificationProvider, SmsMessage } from './notification.provider.js';

function maskTarget(target: string): string {
  if (target.includes('@')) {
    const [local = '', domain = ''] = target.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `${target.slice(0, 4)}***${target.slice(-2)}`;
}

/**
 * Development / test provider: writes notifications to the application log.
 * Recipients are masked; message bodies (which may contain one-time codes)
 * are only logged outside production.
 */
@Injectable()
export class LoggerNotificationProvider implements NotificationProvider {
  readonly name = 'logger';
  private readonly logger = new Logger('Notifications');

  constructor(private readonly includeBody: boolean) {}

  sendEmail(message: EmailMessage): Promise<void> {
    this.logger.log({
      message: 'email',
      to: maskTarget(message.to),
      subject: message.subject,
      body: this.includeBody ? message.text : undefined,
    });
    return Promise.resolve();
  }

  sendSms(message: SmsMessage): Promise<void> {
    this.logger.log({
      message: 'sms',
      to: maskTarget(message.to),
      body: this.includeBody ? message.text : undefined,
    });
    return Promise.resolve();
  }
}
