// src/auth/services/password-reset-code.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import {ResetTokenRepository } from '../repositories/reset-token.repository';
import { EmailService } from './email.service'
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ResetTokenService {
  constructor(
    private readonly repository: ResetTokenRepository,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generates a 6-digit token, saves it to DB, and sends it via Email.
   */
  async generateAndSendToken(email: string, role: Role): Promise<void> {
    // 1. Generate a 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Set expiration (e.g., 15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 3. Save to Database (Repository handles deleting old tokens)
    await this.repository.create({
      email,
      role,
      token: token,
      expiresAt,
    });

    // 4. Send Email
    // Ensure your EmailService has a method specifically for this
    await this.emailService.sendPasswordResetEmail(email, token);
  }

  /**
   * Verifies if a token is valid and not expired.
   * Returns true if valid, throws error if invalid.
   */
  async verifyToken(email: string, token: string, role: Role): Promise<boolean> {
    const validRecord = await this.repository.findValidToken(email, token, role);
    if (!validRecord) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    return true;
  }

  /**
   * Deletes the code after a successful password reset.
   */
  async deleteCode(email: string, role: Role): Promise<void> {
    await this.repository.delete(email, role);
  }
}