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
    const sentViaSupabaseFunction = await this.sendPasswordResetViaSupabaseFunction(
      method,
      contact,
      code,
    );

    if (sentViaSupabaseFunction) {
      return;
    }

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

  private async sendPasswordResetViaSupabaseFunction(
    method: RecoveryMethod,
    contact: string,
    code: string,
  ): Promise<boolean> {
    const functionName = this.configService.get<string>('SUPABASE_PASSWORD_RESET_FUNCTION_NAME')?.trim();
    if (!functionName) {
      return false;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        '[NotificationsService] Supabase password reset function is configured, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to direct delivery.',
      );
      return false;
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          contact,
          code,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.warn(
          `[NotificationsService] Supabase password reset function ${functionName} returned ${response.status}: ${responseText}. Falling back to direct delivery.`,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn(
        `[NotificationsService] Supabase password reset function ${functionName} failed: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to direct delivery.`,
      );
      return false;
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
