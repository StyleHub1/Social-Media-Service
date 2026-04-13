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
import { Role } from '../..//auth/entities/base-user.entity';
import { UserSearchResponseDto } from '../dto/user-search-response.dto ';
import { ECommerceConfig } from '@/config/e_commerce.config';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly eCommerceServiceConfig: ECommerceConfig;
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly BaseUserService: BaseUsersService,
    private readonly CloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {
    this.eCommerceServiceConfig = this.configService.get<ECommerceConfig>('ecommerce')!;
  }
  public async completeProfile(
    baseUserId: string,
    userData: Partial<UserProfile>,
    accessToken: string,
  ): Promise<UserProfile> {
    userData = { ...userData, baseUserId: baseUserId };
    try {
      const userProfile = await this.userRepository.createUser(userData);
      try {
        await this.sendUserDataToCommerceService(userProfile, accessToken);
      } catch (error) {
        this.logger.error('Failed to sync user data with e-commerce service', error instanceof Error ? error.stack : error);
      }
      await this.BaseUserService.updateBaseUser(baseUserId, {
        isProfileComplete: true,
      });
      return userProfile;
    } catch (error) {
      if (error.code === '23505') {
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
    const user = await this.userRepository.findByBaseUserId(userId);
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
      numberOfFollowers: 0, // Placeholder, should be calculated based on followers table
      numberOfFollowing: 0, // Placeholder, should be calculated based on followers table
      numberOfPosts: 0, // Placeholder, should be calculated based on posts table
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
    Object.assign(user, updates);
    const updatedUser = await this.userRepository.updateProfile(user);
    return this.getProfile(updatedUser.baseUserId);
  }
  public async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findByBaseUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.BaseUserService.deleteBaseUser(user.baseUserId);
    await this.userRepository.deleteUser(user.id);
  }
  public async updateProfileImage(
    userId: string,
    image: Express.Multer.File,
  ): Promise<UserProfileDto> {
    const uploadResult = await this.CloudinaryService.uploadFile(
      image,
      'users/profile',
    );
    const imageUrl = uploadResult.secure_url;
    const updatedUser = await this.userRepository.updateProfileImage(
      userId,
      imageUrl,
    );
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
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
      score: parseInt(raw[index]?.score ?? 0),
    }));
  }
  private async sendUserDataToCommerceService(
    user: UserProfile,
    accessToken: string,
  ) {
    const url = this.eCommerceServiceConfig.serviceUrl;
    const formData = new FormData();
    formData.append('userName', user.username);
    formData.append('firstName', user.firstName ?? '');
    formData.append('lastName', user.lastName ?? '');
    formData.append('phoneNumber', user.phoneNumber ?? '');
    const genderChar: Record<string, string> = {
      MALE: 'M',
      FEMALE: 'F',
      OTHER: 'O',
      PREFER_NOT_TO_SAY: 'P',
    };
    formData.append('gender', genderChar[user.gender] ?? user.gender);

    const response = await fetch(`${url}/customer/profile/setup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const responseBody = await response.text();
    this.logger.log(
      `Commerce service response: ${response.status} - ${response.statusText} - ${responseBody}`,
    );

    if (!response.ok) {
      throw new Error(
        `Commerce service returned ${response.status}: ${responseBody}`,
      );
    }
  }
}
