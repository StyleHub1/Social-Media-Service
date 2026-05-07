import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BaseUsersRepository } from '../repositories/base-user.repository';
import { BaseUser } from '../entities/base-user.entity';

@Injectable()
export class BaseUsersService {

  constructor(private readonly baseUsersRepository: BaseUsersRepository) {}

  async findByEmail(email: string): Promise<BaseUser | null> {
    return this.baseUsersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<BaseUser> {
    const user = await this.baseUsersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Safe create with duplicate email handling */
  async createBaseUser(data: Partial<BaseUser>): Promise<BaseUser> {
    try {
      return await this.baseUsersRepository.create({
        email: data.email,
        password: data.password, // make sure it's hashed before calling
        role: data.role,
      });
    } catch (error: any) {
      // Postgres unique violation code
      if (error.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  /** Only update allowed fields */
  async updateBaseUser(
    id: string,
    data: Partial<
      Pick<
        BaseUser,
        'email' | 'role' | 'isActive' | 'isEmailVerified' | 'isProfileComplete'
      >
    >,
  ): Promise<BaseUser> {
    const updated = await this.baseUsersRepository.update(id, data);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  /** Ensure password is hashed before calling this */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    await this.baseUsersRepository.update(id, { password: newPassword });
  }

  async deactivateBaseUser(id: string): Promise<void> {
    await this.updateBaseUser(id, { isActive: false });
  }

  async activateBaseUser(id: string): Promise<void> {
    await this.updateBaseUser(id, { isActive: true });
  }

  /** Atomic increment operations */
  async incrementFollowers(id: string, value = 1): Promise<void> {
    await this.baseUsersRepository.incrementField(id, 'followersCount', value);
  }

  async incrementFollowing(id: string, value = 1): Promise<void> {
    await this.baseUsersRepository.incrementField(id, 'followingCount', value);
  }

  async incrementPosts(id: string, value = 1): Promise<void> {
    await this.baseUsersRepository.incrementField(id, 'postsCount', value);
  }

  async deleteBaseUser(id: string): Promise<void> {
    await this.baseUsersRepository.delete(id);
  }

  async decrementPosts(id: string, value = 1): Promise<void> {
    await this.baseUsersRepository.decrementField(id, 'postsCount', value);
  }
}
