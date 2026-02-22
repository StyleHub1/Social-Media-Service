// src/modules/auth/repositories/refresh-token.repository.ts
import { Injectable } from "@nestjs/common";
import { RefreshToken } from "../entities/refresh_tokens.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Role } from "../../common/enums/role.enum";

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
  async revokeAllTokensForEntity(entityType: Role, id: string): Promise<number> {
    let result;
    switch (entityType) {
        case Role.USER:
        result = await this.refreshTokenRepo.update({ userId: id }, { isRevoked: true });
        break;
        case Role.BRAND:
        result = await this.refreshTokenRepo.update({ brandId: id }, { isRevoked: true });
        break;
        default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
    return result.affected || 0;
  }

  // Delete a token (e.g., after password reset)
  async deleteToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepo.delete({ tokenHash });
  }

  // Delete all tokens for a user or brand (e.g., logout all devices)
  async deleteAllTokensForEntity(entityType: Role, id: string): Promise<number> {
    let result;
    switch (entityType) {
        case Role.USER:
        result = await this.refreshTokenRepo.delete({ userId: id });
        break;
        case Role.BRAND:
        result = await this.refreshTokenRepo.delete({ brandId: id });
        break;
        default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
    return result.affected || 0;
  }

  // Optional: remove expired tokens
  async deleteExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where("expiresAt < :now", { now: new Date() })
      .execute();
  }
}