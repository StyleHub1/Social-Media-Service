import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ResetToken } from '../entities/reset-token.entity';
import { Role } from '../../common/enums/role.enum'; // Ensure you import your Role enum

@Injectable()
export class ResetTokenRepository {
  constructor(
    @InjectRepository(ResetToken)
    private readonly repo: Repository<ResetToken>,
  ) {}

  // 1. Create or Overwrite (Delete old code first)
  async create(data: Partial<ResetToken>): Promise<ResetToken> {
    // Clean up any existing code for this user so they only have 1 active code
    await this.repo.delete({ baseUserId: data.baseUserId});

    const token = this.repo.create(data);
    return await this.repo.save(token);
  }

  // 2. Find a specific valid token
  async findValidToken(baseUserId: string, token: string): Promise<ResetToken | null> {
    return await this.repo.findOne({
      where: {
        baseUserId,
        token, // Match the 6-digit token
        expiresAt: MoreThan(new Date()), // Check it hasn't expired
      },
    });
  }

  // 3. Delete after successful use
  async delete(baseUserId: string): Promise<void> {
    await this.repo.delete({ baseUserId });
  }
}