export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmsMessage {
  to: string;
  text: string;
}

/**
 * Transport abstraction for outbound notifications. Concrete providers
 * (SMTP, SMS gateways, …) implement this interface; business code only
 * depends on NotificationsService.
 */
export interface NotificationProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<void>;
  sendSms(message: SmsMessage): Promise<void>;
}
