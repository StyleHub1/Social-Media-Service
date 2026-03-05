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
    const userName=name.split('@')[0];
    const formattedUserName = userName.charAt(0).toUpperCase() + userName.slice(1);
    
    email.subject = `🎉 Welcome to ${this.config.email.EMAIL_NAME}!`;

    email.htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 40px 0;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <h1 style="color: #333333; margin-bottom: 10px;">
            Welcome, ${formattedUserName}! 👋
          </h1>

          <p style="font-size: 16px; color: #555555; line-height: 1.6;">
            We're excited to have you on board at 
            <strong>${this.config.email.EMAIL_NAME}</strong>.
          </p>

          <p style="font-size: 16px; color: #555555; line-height: 1.6;">
            Your journey starts now — connect, share, and explore amazing content.
          </p>

          <div style="margin: 30px 0; text-align: center;">
            <a href="#" 
              style="background-color: #4f46e5; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; 
                      font-weight: bold; display: inline-block;">
              Explore Now 🚀
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;" />

          <p style="font-size: 13px; color: #999999; text-align: center;">
            If you did not create this account, please ignore this email.
          </p>

        </div>
      </div>
    `;
    try {
      await this.apiInstance.sendTransacEmail(email);
      //console.log(`Welcome email sent to ${to}`);
    } catch (err) {
      console.log('Error sending welcome email.');
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
    
    email.subject = `🔐 Password Reset Code`;

    email.htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 40px 0;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <h1 style="color: #333333; margin-bottom: 10px;">
            Password Reset 🔐
          </h1>

          <p style="font-size: 16px; color: #555555; line-height: 1.6;">
            We received a request to reset your password.
          </p>

          <p style="font-size: 16px; color: #555555; line-height: 1.6;">
            Use the verification code below to complete the process:
          </p>

          <div style="margin: 30px 0; text-align: center;">
            <div style="
              display: inline-block;
              background-color: #fee2e2;
              color: #b91c1c;
              padding: 16px 32px;
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 4px;
              border-radius: 8px;
            ">
              ${code}
            </div>
          </div>

          <p style="font-size: 14px; color: #777777; text-align: center;">
            ⏳ This code expires in <strong>10 minutes</strong>.
          </p>

          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;" />

          <p style="font-size: 13px; color: #999999; text-align: center;">
            If you did not request a password reset, you can safely ignore this email.
            Your account remains secure.
          </p>

        </div>
      </div>
    `;

    try {
      await this.apiInstance.sendTransacEmail(email);
      console.log(`Password reset email sent to ${to}`);
    } catch (err) {
      console.log('Error sending password reset email.');
      throw new InternalServerErrorException('Failed to send password reset email');
    }
  }
  async sendVerificationEmail(to: string, token: string) {
  const email = new SibApiV3Sdk.SendSmtpEmail();

  const verificationUrl = `https://style-hub-social-media-be-d369dfc7ce40.herokuapp.com/auth/verify-email?token=${token}`;

  email.to = [{ email: to }];
  email.sender = {
    email: this.config.email.EMAIL_FROM,
    name: this.config.email.EMAIL_NAME,
  };

  email.subject = 'Verify your email';

  email.htmlContent = `
    <h2>Email Verification</h2>
    <p>Click the button below to verify your account:</p>
    <a href="${verificationUrl}"
       style="padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">
       Verify Email
    </a>
    <p>This link expires in 15 minutes.</p>
  `;
  try{
    await this.apiInstance.sendTransacEmail(email);
    console.log(`Verification email sent to ${to}`);
  } catch (err) {
    console.log('Error sending verification email.');
  }
}
}