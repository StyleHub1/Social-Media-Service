import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BrandRepository } from '../repositories/brand.repository';
import { BrandProfile } from '../entities/brand-profile.entity';
import { BrandProfileDto } from '../dto/brand-profile.dto';
import { BaseUsersService } from '../../auth/services/base-user.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { Role } from '../..//auth/entities/base-user.entity';
import { BrandSearchResponseDto } from '../dto/brand-search-response.dto ';
import { BrandProfileUpdateDto } from '../dto/brand-profile-update.dto';

@Injectable()
export class BrandService {
    constructor(
        protected readonly brandRepository: BrandRepository,
        private readonly BaseUserService: BaseUsersService,
        private readonly CloudinaryService: CloudinaryService
    ) {}
    public async completeProfile(baseUserId: string, brandData: Partial<BrandProfile>): Promise<BrandProfile> {
        brandData = { ...brandData, baseUserId };
        try {
            const brand = await this.brandRepository.createBrand(brandData);
            // Update the base user to indicate their profile is complete
            await this.BaseUserService.updateBaseUser(baseUserId, { isProfileComplete: true });
            return brand;
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
            id: brand.baseUserId,
            type: Role.BRAND,
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
    public async updateProfileImage(brandId: string, image: Express.Multer.File): Promise<BrandProfileDto> {
        const uploadResult = await this.CloudinaryService.uploadFile(
            image,
            'Brands/profile'
        );
        const updatedBrand = await this.brandRepository.updateProfileImage(brandId, uploadResult.secure_url);
        if (!updatedBrand) {
            throw new NotFoundException('Brand not found');
        }
        return this.getProfile(updatedBrand.baseUserId);
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
        await this.brandRepository.deleteBrand(brand.id);
        await this.BaseUserService.deleteBaseUser(brand.baseUserId);
    }

    public async searchBrands(query: string): Promise<BrandSearchResponseDto[]> {
        if (!query || query.trim() === '') {
            return [];
        }
        const { entities ,raw} = await this.brandRepository.searchByUsernameOrName(query);
        return entities.map((brand, index) => ({
            id: brand.baseUserId,
            type: Role.BRAND,
            username: brand.username,
            brandName: brand.brandName,
            profileImageUrl: brand.profileImageUrl,
            score: parseInt(raw[index]?.score?? 0)
        }));
    }
    public async updateProfile(brandId: string, updates: Partial<BrandProfileUpdateDto>): Promise<BrandProfileDto> {
        const brand = await this.brandRepository.findByBaseUserId(brandId);
        if (!brand) {
            throw new NotFoundException('Brand not found');
        }
        if (updates.username && updates.username !== brand.username) {
            const existingBrand = await this.brandRepository.findByUsername(updates.username);
            if (existingBrand) {
                throw new ConflictException('Username already exists');
            }
        }
        Object.assign(brand, updates);
        const updatedBrand = await this.brandRepository.updateProfile(brand);
        return this.getProfile(updatedBrand.baseUserId);
    }
}
