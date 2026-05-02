// src/modules/auth/services/refresh-token.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { Role } from '../../common/enums/role.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly config: ConfigService,
  ) {}

  async createRefreshToken(data: {
    rawToken: string;
    entityId: string;
    expiresIn: string;
  }) {
    const tokenHash = this.hashToken(data.rawToken);
    const expiresAt = new Date(
      Date.now() + this.convertExpiresInToMs(data.expiresIn),
    );

    const tokenEntity = await this.refreshTokenRepo.createToken({
      tokenHash,
      expiresAt,
      baseUserId: data.entityId,
    });

    return tokenEntity;
  }
  async validateRefreshToken(
    plainToken: string,
    hashedToken: string,
  ): Promise<boolean> {
    const isValid = this.verifyToken(plainToken, hashedToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return isValid;
  }
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepo.revokeToken(tokenHash);
  }
  async findValidToken(entityId: string, plainToken: string) {
    const tokenHash = this.hashToken(plainToken);
    const token = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!token || token.isRevoked || token.expiresAt < new Date()) {
      return null;
    }

    return token;
  }
  async revokeAllTokensForEntity(id: string) {
    await this.refreshTokenRepo.revokeAllTokensForEntity(id);
  }
  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepo.deleteToken(tokenHash);
  }
  async deleteAllTokensForEntity(id: string) {
    await this.refreshTokenRepo.deleteAllTokensForEntity(id);
  }
  async getTokenByHash(tokenHash: string) {
    return await this.refreshTokenRepo.findByTokenHash(tokenHash);
  }
  async deleteExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo.deleteExpiredTokens();
  }
  private hashToken(token: string): string {
    return crypto
      .createHmac('sha256', process.env.REFRESH_TOKEN_HASH_SECRET!)
      .update(token)
      .digest('hex');
  }

  private verifyToken(plainToken: string, hashedToken: string): boolean {
    const hash = this.hashToken(plainToken);

    const hashBuffer = Buffer.from(hash);
    const storedBuffer = Buffer.from(hashedToken);

    if (hashBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, storedBuffer);
  }
  private convertExpiresInToMs(expiresIn: string): number {
    // Accepts formats like "15m", "7d", "1h"
    const unit = expiresIn.slice(-1); // last char
    const value = parseInt(expiresIn.slice(0, -1), 10);
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown expiresIn unit: ${unit}`);
    }
  }
}
