// src/modules/auth/repositories/refresh-token.repository.ts
import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}
  // Create and save a new refresh token
  async createToken(data: Partial<RefreshToken>): Promise<RefreshToken> {
    const token = this.refreshTokenRepo.create(data);
    return this.refreshTokenRepo.save(token);
  }
  // Find a token by its hash
  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });
  }
  // Revoke a token
  async revokeToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepo.update({ tokenHash }, { isRevoked: true });
  }
  async revokeAllTokensForEntity(id: string) {
    try {
      await this.refreshTokenRepo.update(
        { baseUserId: id },
        { isRevoked: true },
      );
    } catch (error) {
      console.error(`Error revoking tokens for user with ID ${id}:`, error);
      throw error;
    }
  }
  // Delete a token (e.g., after password reset)
  async deleteToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepo.delete({ tokenHash });
  }
  // Delete all tokens for a user or brand (e.g., logout all devices)
  async deleteAllTokensForEntity(id: string) {
    try {
      await this.refreshTokenRepo.delete({ baseUserId: id });
    } catch (error) {
      console.error(`Error deleting tokens for user with ID ${id}:`, error);
      throw error;
    }
  }
  // Optional: remove expired tokens
  async deleteExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }
}
