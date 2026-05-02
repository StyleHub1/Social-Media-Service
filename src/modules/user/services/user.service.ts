import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserProfile } from '../entities/user-profile.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UserProfileUpdateDto } from '../dto/user-profile-update.dto';
import { BaseUsersService } from '../../auth/services/base-user.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { BaseUser, Role } from '../../auth/entities/base-user.entity';
import { DataSource } from 'typeorm';
import { UserSearchResponseDto } from '../dto/user-search-response.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserProfileCompletedEvent } from '../events/user-profile-completed.event';
import { UserProfileUpdatedEvent } from '../events/user-profile-updated.event';
import { UserProfileDeletedEvent } from '../events/user-profile-deleted.event';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly baseUserService: BaseUsersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}
  public async completeProfile(
    baseUserId: string,
    userData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    userData = { ...userData, baseUserId: baseUserId };
    try {
      const userProfile = await this.userRepository.createUser(userData);
      const baseUser = await this.baseUserService.findById(
        userProfile.baseUserId,
      );
      this.eventEmitter.emit(
        'user.profile.completed',
        new UserProfileCompletedEvent(
          userProfile.baseUserId,
          baseUser.email,
          userProfile.username,
          userProfile.firstName ?? '',
          userProfile.lastName ?? '',
          userProfile.phoneNumber ?? '',
          userProfile.bio,
          userProfile.gender,
        ),
      );
      await this.baseUserService.updateBaseUser(baseUserId, {
        isProfileComplete: true,
      });
      return userProfile;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Username already exists');
      }
      throw error;
    }
  }
  public async findByUsername(username: string): Promise<UserProfile | null> {
    return await this.userRepository.findByUsername(username);
  }
  public async findById(id: string): Promise<UserProfile | null> {
    return await this.userRepository.findById(id);
  }
  public async findByBaseUserId(
    baseUserId: string,
  ): Promise<UserProfile | null> {
    return await this.userRepository.findByBaseUserId(baseUserId);
  }
  public async getProfile(userId: string): Promise<UserProfileDto> {
    const [user, baseUser] = await Promise.all([
      this.userRepository.findByBaseUserId(userId),
      this.baseUserService.findById(userId),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const profile: UserProfileDto = {
      id: user.baseUserId,
      type: Role.USER,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      numberOfFollowers: baseUser.followersCount,
      numberOfFollowing: baseUser.followingCount,
      numberOfPosts: baseUser.postsCount,
      posts: {}, // Placeholder, should be populated with actual posts data
      bio: user.bio,
      profileImageUrl: user.profileImageUrl,
    };
    return profile;
  }
  public async updateProfile(
    userId: string,
    updates: Partial<UserProfileUpdateDto>,
  ): Promise<UserProfileDto> {
    const user = await this.userRepository.findByBaseUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (updates.username && updates.username !== user.username) {
      const existingUser = await this.userRepository.findByUsername(
        updates.username,
      );
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }
    }
    const [updatedUser, baseUser] = await Promise.all([
      this.userRepository.updateProfile({ ...user, ...updates }),
      this.baseUserService.findById(userId),
    ]);
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }
    this.eventEmitter.emit(
      'user.profile.updated',
      new UserProfileUpdatedEvent(
        updatedUser.baseUserId,
        baseUser.email,
        updatedUser.username,
        updatedUser.firstName,
        updatedUser.lastName,
        updatedUser.bio,
        updatedUser.profileImageUrl,
        updatedUser.gender,
        updatedUser.phoneNumber,
      ),
    );
    return this.getProfile(updatedUser.baseUserId);
  }
  public async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findByBaseUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserProfile, { id: user.id });
      await manager.delete(BaseUser, { id: user.baseUserId });
    });
    this.eventEmitter.emit(
      'user.profile.deleted',
      new UserProfileDeletedEvent(user.baseUserId, user.username),
    );
  }
  public async updateProfileImage(
    userId: string,
    image: Express.Multer.File,
  ): Promise<UserProfileDto> {
    const uploadResult = await this.cloudinaryService.uploadFile(
      image,
      'users/profile',
    );
    const imageUrl = uploadResult.secure_url;
    const [updatedUser, baseUser] = await Promise.all([
      this.userRepository.updateProfileImage(userId, imageUrl),
      this.baseUserService.findById(userId),
    ]);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    this.eventEmitter.emit(
      'user.profile.updated',
      new UserProfileUpdatedEvent(
        updatedUser.baseUserId,
        baseUser.email,
        updatedUser.username,
        updatedUser.firstName,
        updatedUser.lastName,
        updatedUser.bio,
        updatedUser.profileImageUrl,
        updatedUser.gender,
        updatedUser.phoneNumber,
      ),
    );
    return this.getProfile(updatedUser.baseUserId);
  }
  public async getProfileImage(userId: string): Promise<string> {
    const user = await this.userRepository.findByBaseUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.profileImageUrl || '';
  }
  public async searchUsers(query: string): Promise<UserSearchResponseDto[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    const { entities, raw } =
      await this.userRepository.searchByUsernameOrNameRaw(query);
    return entities.map((user, index) => ({
      id: user.baseUserId,
      type: Role.USER,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      score: parseFloat((raw[index] as { score?: string })?.score ?? '0'),
    }));
  }
}
