import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BrandRepository } from '../repositories/brand.repository';
import { BrandProfile } from '../entities/brand-profile.entity';
import { BrandProfileDto } from '../dto/brand-profile.dto';

@Injectable()
export class BrandService {
    constructor(
        protected readonly brandRepository: BrandRepository
    ) {}
    public async completeProfile(baseUserId: string, brandData: Partial<BrandProfile>): Promise<BrandProfile> {
        brandData = { ...brandData, baseUserId };
        try {
        return await this.brandRepository.createBrand(brandData);
        } catch (error) {
        if (error.code === '23505') {
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

    public async findByBaseUserId(baseUserId: string): Promise<BrandProfile | null> {
        return await this.brandRepository.findByBaseUserId(baseUserId);
    }
    public async getProfile(brandId: string): Promise<BrandProfileDto> {
        const brand = await this.brandRepository.findByBaseUserId(brandId);
        if (!brand) {
            throw new NotFoundException('Brand not found');
        }
        const profile: BrandProfileDto = {
            username: brand.username,
            brandName: brand.brandName,
            bio: brand.bio,
            profileImageUrl: brand.profileImageUrl,
            websiteUrl: brand.websiteUrl,
            numberOfFollowers: 0, // Placeholder, should be calculated based on followers table
            numberOfPosts: 0, // Placeholder, should be calculated based on posts table
        };
        return profile;
    }
}
