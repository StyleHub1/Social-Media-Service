import { Injectable } from '@nestjs/common';
import { UserProfile } from '../entities/user-profile.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserProfile)
    private readonly userRepository: Repository<UserProfile>,
  ) {}

  async createUser(user: Partial<UserProfile>): Promise<UserProfile> {
    const newUser = this.userRepository.create(user);
    return await this.userRepository.save(newUser);
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    return await this.userRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<UserProfile | null> {
    return await this.userRepository.findOne({ where: { id } });
  }
  async updateUser(
    id: string,
    updates: Partial<UserProfile>,
  ): Promise<UserProfile | null> {
    await this.userRepository.update(id, updates);
    return await this.findById(id);
  }
  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
  async findByBaseUserId(baseUserId: string): Promise<UserProfile | null> {
    return await this.userRepository.findOne({ where: { baseUserId } });
  }
  async updateProfile(user: UserProfile): Promise<UserProfile> {
    return await this.userRepository.save(user);
  }
  async updateProfileImage(
    id: string,
    imageUrl: string,
  ): Promise<UserProfile | null> {
    const user = await this.findByBaseUserId(id);
    if (!user) return null;
    user.profileImageUrl = imageUrl;
    return await this.userRepository.save(user);
  }
  async searchByUsernameOrNameRaw(query: string) {
    return await this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.baseUserId',
        'user.username',
        'user.firstName',
        'user.lastName',
        'user.profileImageUrl',
      ])
      .addSelect(
        `
                GREATEST(
                    similarity(user.username, :plainQuery),
                    similarity(user.firstName, :plainQuery),
                    similarity(user.lastName, :plainQuery)
                )`,
        'score',
      )
      .where(
        'user.username ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q',
        { q: `%${query}%` },
      )
      .setParameter('plainQuery', query)
      .orderBy('score', 'DESC')
      .limit(20)
      .getRawAndEntities();
  }
}
