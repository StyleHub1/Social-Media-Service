// src/common/services/email.service.ts
import { emailConfig } from '../../../config/email.config';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

@Injectable()
export class EmailService {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(
    // 👇 FIX: Inject the specific config namespace directly
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
  ) {

    if (!this.config.email.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is missing in environment variables');
    }

    // 1. Initialize API Instance
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    // 2. Set API Key safely
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.email.BREVO_API_KEY,
    );
  }

  // Send welcome email
  async sendWelcomeEmail(to: string, name: string) {
    const email = new SibApiV3Sdk.SendSmtpEmail();
    
    email.to = [{ email: to, name }];
    
    // 👇 FIX: Access properties directly from the injected config
    email.sender = { 
      email: this.config.email.EMAIL_FROM, 
      name: this.config.email.EMAIL_NAME 
    };
    
    email.subject = `Welcome to ${this.config.email.EMAIL_NAME}!`;
    email.htmlContent = `<h1>Welcome ${name}!</h1><p>Thanks for registering. We're excited to have you!</p>`;

    try {
      await this.apiInstance.sendTransacEmail(email);
      //console.log(`Welcome email sent to ${to}`);
    } catch (err) {
      console.error('Error sending welcome email:', err);
      throw new InternalServerErrorException('Failed to send welcome email');
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(to: string, code: string) {
    const email = new SibApiV3Sdk.SendSmtpEmail();

    email.to = [{ email: to }];
    
    // 👇 FIX: Consistent usage
    email.sender = { 
      email: this.config.email.EMAIL_FROM, 
      name: this.config.email.EMAIL_NAME 
    };
    
    email.subject = `Password Reset Code`;
    email.htmlContent = `<h1>Password Reset</h1><p>Your verification code is: <b>${code}</b></p><p>This code expires in 10 minutes.</p>`;

    try {
      await this.apiInstance.sendTransacEmail(email);
      console.log(`Password reset email sent to ${to}`);
    } catch (err) {
      console.error('Error sending password reset email:', err);
      throw new InternalServerErrorException('Failed to send password reset email');
    }
  }
}