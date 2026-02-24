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
  async generateAndSendToken(userId: string, email: string): Promise<void> {
    // 1. Generate a 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Set expiration (e.g., 15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 3. Save to Database (Repository handles deleting old tokens)
    await this.repository.create({
      baseUserId: userId,
      token: token,
      expiresAt,
    });
    await this.emailService.sendPasswordResetEmail(email, token);
  }
  /**
   * Verifies if a token is valid and not expired.
   * Returns true if valid, throws error if invalid.
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const validRecord = await this.repository.findValidToken(userId, token);
    if (!validRecord) {
      throw new BadRequestException('Invalid or expired verification code.');
    }
    return true;
  }

  /**
   * Deletes the code after a successful password reset.
   */
  async deleteCode(userId: string): Promise<void> {
    await this.repository.delete(userId);
  }
}