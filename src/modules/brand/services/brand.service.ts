import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BrandRepository } from '../repositories/brand.repository';
import { BrandProfile } from '../entities/brand-profile.entity';
import { BrandProfileDto } from '../dto/brand-profile.dto';
import { BaseUsersService } from '../../auth/services/base-user.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { BaseUser, Role } from '../../auth/entities/base-user.entity';
import { BrandSearchResponseDto } from '../dto/brand-search-response.dto';
import { BrandProfileUpdateDto } from '../dto/brand-profile-update.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BrandProfileCompletedEvent } from '../events/brand-profile-completed.event';
import { BrandProfileUpdatedEvent } from '../events/brand-profile-updated.event';
import { BrandProfileDeletedEvent } from '../events/brand-profile-deleted.event';
import { DataSource } from 'typeorm';

@Injectable()
export class BrandService {
  constructor(
    protected readonly brandRepository: BrandRepository,
    private readonly BaseUserService: BaseUsersService,
    private readonly CloudinaryService: CloudinaryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}
  public async completeProfile(
    baseUserId: string,
    brandData: Partial<BrandProfile>,
  ): Promise<BrandProfile> {
    brandData = { ...brandData, baseUserId };
    try {
      const brand = await this.brandRepository.createBrand(brandData);
      const baseUser = await this.BaseUserService.findById(brand.baseUserId);
      this.eventEmitter.emit(
        'brand.profile.completed',
        new BrandProfileCompletedEvent(
          brand.baseUserId,
          baseUser.email,
          brand.brandName ?? '',
          brand.username,
          brand.bio ?? '',
          brand.websiteUrl ?? '',
        ),
      );
      // Update the base user to indicate their profile is complete
      await this.BaseUserService.updateBaseUser(baseUserId, {
        isProfileComplete: true,
      });
      return brand;
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

  public async findByUsername(username: string): Promise<BrandProfile | null> {
    return await this.brandRepository.findByUsername(username);
  }

  public async findById(id: string): Promise<BrandProfile | null> {
    return await this.brandRepository.findById(id);
  }

  public async findByBaseUserId(
    baseUserId: string,
  ): Promise<BrandProfile | null> {
    return await this.brandRepository.findByBaseUserId(baseUserId);
  }
  public async getProfile(brandId: string): Promise<BrandProfileDto> {
    const [brand, baseUser] = await Promise.all([
      this.brandRepository.findByBaseUserId(brandId),
      this.BaseUserService.findById(brandId),
    ]);
    if (!brand || !baseUser) {
      throw new NotFoundException('Brand not found');
    }
    const profile: BrandProfileDto = {
      id: brand.baseUserId,
      type: Role.BRAND,
      username: brand.username,
      brandName: brand.brandName,
      bio: brand.bio,
      profileImageUrl: brand.profileImageUrl,
      websiteUrl: brand.websiteUrl,
      numberOfFollowers: baseUser.followersCount,
      numberOfPosts: baseUser.postsCount,
    };
    return profile;
  }
  public async updateProfileImage(
    brandId: string,
    image: Express.Multer.File,
  ): Promise<BrandProfileDto> {
    const uploadResult = await this.CloudinaryService.uploadFile(
      image,
      'Brands/profile',
    );
    const updatedBrand = await this.brandRepository.updateProfileImage(
      brandId,
      uploadResult.secure_url,
    );
    if (!updatedBrand) {
      throw new NotFoundException('Brand not found');
    }
    const [profile, baseUser] = await Promise.all([
      this.getProfile(updatedBrand.baseUserId),
      this.BaseUserService.findById(updatedBrand.baseUserId),
    ]);

    this.eventEmitter.emit(
      'brand.profile.updated',
      new BrandProfileUpdatedEvent(
        updatedBrand.baseUserId,
        baseUser.email,
        updatedBrand.brandName,
        updatedBrand.username,
        updatedBrand.bio,
        updatedBrand.websiteUrl,
        updatedBrand.profileImageUrl,
      ),
    );

    return profile;
  }

  public async getProfileImage(brandId: string): Promise<string> {
    const brand = await this.brandRepository.findByBaseUserId(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand.profileImageUrl || '';
  }
  public async deleteProfile(brandId: string): Promise<void> {
    const brand = await this.brandRepository.findByBaseUserId(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(BrandProfile, { id: brand.id });
      await manager.delete(BaseUser, { id: brand.baseUserId });
    });
    this.eventEmitter.emit(
      'brand.profile.deleted',
      new BrandProfileDeletedEvent(brand.id, brand.username),
    );
  }

  public async searchBrands(query: string): Promise<BrandSearchResponseDto[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    const { entities, raw } =
      await this.brandRepository.searchByUsernameOrName(query);
    return entities.map((brand, index) => ({
      id: brand.baseUserId,
      type: Role.BRAND,
      username: brand.username,
      brandName: brand.brandName,
      profileImageUrl: brand.profileImageUrl,
      score: parseFloat((raw[index] as { score?: string })?.score ?? '0'),
    }));
  }
  public async updateProfile(
    brandId: string,
    updates: Partial<BrandProfileUpdateDto>,
  ): Promise<BrandProfileDto> {
    const brand = await this.brandRepository.findByBaseUserId(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    if (updates.username && updates.username !== brand.username) {
      const existingBrand = await this.brandRepository.findByUsername(
        updates.username,
      );
      if (existingBrand) {
        throw new ConflictException('Username already exists');
      }
    }
    Object.assign(brand, updates);
    const [updatedBrand, baseUser] = await Promise.all([
      this.brandRepository.updateProfile(brand),
      this.BaseUserService.findById(brandId),
    ]);
    this.eventEmitter.emit(
      'brand.profile.updated',
      new BrandProfileUpdatedEvent(
        updatedBrand.baseUserId,
        baseUser.email,
        updatedBrand.brandName,
        updatedBrand.username,
        updatedBrand.bio,
        updatedBrand.websiteUrl,
        updatedBrand.profileImageUrl,
      ),
    );
    return this.getProfile(updatedBrand.baseUserId);
  }
}
