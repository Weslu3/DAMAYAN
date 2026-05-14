import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import Twilio from 'twilio';
import { RecoveryMethod } from '../auth/dto/forgot-password.dto.js';

@Injectable()
export class NotificationsService {
  private readonly resendClient: Resend | null;
  private readonly twilioClient: Twilio.Twilio | null;
  private readonly resendFromEmail: string | null;
  private readonly twilioFromPhone: string | null;
  private readonly isProduction: boolean;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    const twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    this.resendClient = resendApiKey ? new Resend(resendApiKey) : null;
    this.twilioClient =
      twilioAccountSid && twilioAuthToken
        ? Twilio(twilioAccountSid, twilioAuthToken)
        : null;
    this.resendFromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') ?? null;
    this.twilioFromPhone = this.configService.get<string>('TWILIO_FROM_PHONE') ?? null;
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async sendPasswordResetCode(
    method: RecoveryMethod,
    contact: string,
    code: string,
  ): Promise<void> {
    if (method === RecoveryMethod.EMAIL) {
      await this.sendPasswordResetEmail(contact, code);
      return;
    }

    await this.sendPasswordResetSms(contact, code);
  }

  async sendBroadcastEmail(to: string, subject: string, message: string): Promise<boolean> {
    if (!this.resendClient || !this.resendFromEmail) {
      this.handleDeliveryFailure(
        'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
      );
      return false;
    }

    try {
      await this.resendClient.emails.send({
        from: this.resendFromEmail,
        to,
        subject,
        text: message,
      });
      return true;
    } catch (error) {
      this.handleDeliveryFailure(
        error instanceof Error ? error.message : 'Failed to send broadcast email.',
      );
      return false;
    }
  }

  async sendBroadcastSms(to: string, message: string): Promise<boolean> {
    if (!this.twilioClient || !this.twilioFromPhone) {
      this.handleDeliveryFailure(
        'SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE.',
      );
      return false;
    }

    try {
      await this.twilioClient.messages.create({
        from: this.twilioFromPhone,
        to,
        body: message,
      });
      return true;
    } catch (error) {
      this.handleDeliveryFailure(
        error instanceof Error ? error.message : 'Failed to send broadcast SMS.',
      );
      return false;
    }
  }

  private async sendPasswordResetEmail(to: string, code: string): Promise<void> {
    if (!this.resendClient || !this.resendFromEmail) {
      this.handleDeliveryFailure(
        'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
      );
      return;
    }

    try {
      await this.resendClient.emails.send({
        from: this.resendFromEmail,
        to,
        subject: 'Your Damayan password reset code',
        text: `Your password reset code is ${code}. It will expire in 10 minutes.`,
      });
    } catch (error) {
      this.handleDeliveryFailure(
        error instanceof Error ? error.message : 'Failed to send password reset email.',
      );
    }
  }

  private async sendPasswordResetSms(to: string, code: string): Promise<void> {
    if (!this.twilioClient || !this.twilioFromPhone) {
      this.handleDeliveryFailure(
        'SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE.',
      );
      return;
    }

    try {
      await this.twilioClient.messages.create({
        from: this.twilioFromPhone,
        to,
        body: `Your Damayan password reset code is ${code}. It expires in 10 minutes.`,
      });
    } catch (error) {
      this.handleDeliveryFailure(
        error instanceof Error ? error.message : 'Failed to send password reset SMS.',
      );
    }
  }

  private handleDeliveryFailure(message: string): void {
    if (!this.isProduction) {
      console.warn(`[NotificationsService] ${message}`);
      return;
    }

    throw new InternalServerErrorException(message);
  }
}
