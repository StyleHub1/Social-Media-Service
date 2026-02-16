import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ResetToken } from '../entities/reset_tokens.entity';
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
    await this.repo.delete({ email: data.email, role: data.role });

    const token = this.repo.create(data);
    return await this.repo.save(token);
  }

  // 2. Find a specific valid token
  async findValidToken(email: string, token: string, role: Role): Promise<ResetToken | null> {
    return await this.repo.findOne({
      where: {
        email,
        token, // Match the 6-digit token
        role,
        expiresAt: MoreThan(new Date()), // Check it hasn't expired
      },
    });
  }

  // 3. Delete after successful use
  async delete(email: string, role: Role): Promise<void> {
    await this.repo.delete({ email, role });
  }
}