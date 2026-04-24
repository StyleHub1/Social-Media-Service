import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from './email.service';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { PasswordResetRequestedEvent } from '../events/password-reset-requested.event';

@Injectable()
export class EmailListenerService {
  constructor(private readonly emailService: EmailService) {}

  @OnEvent('auth.user.registered')
  async onUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.emailService.sendVerificationEmail(
      event.email,
      event.verificationToken,
      event.name,
    );
  }

  @OnEvent('auth.password.reset-requested')
  async onPasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    await this.emailService.sendPasswordResetEmail(event.email, event.code);
  }
}
