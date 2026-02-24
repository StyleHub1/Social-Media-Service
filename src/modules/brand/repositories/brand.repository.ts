import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandProfile } from '../entities/brand-profile.entity';

@Injectable()
export class BrandRepository {
  constructor(
    @InjectRepository(BrandProfile)
    private readonly brandRepository: Repository<BrandProfile>,
  ) {}
  async createBrand(brand: Partial<BrandProfile>): Promise<BrandProfile> {
    const newBrand = this.brandRepository.create(brand);
    return await this.brandRepository.save(newBrand);
  }

  async findByUsername(username: string): Promise<BrandProfile | null> {
    return await this.brandRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<BrandProfile | null> {
    return await this.brandRepository.findOne({ where: { id } });
  }

  async findByBaseUserId(baseUserId: string): Promise<BrandProfile | null> {
    return await this.brandRepository.findOne({ where: { baseUserId } });
  }

  async updateBrand(id: string, updates: Partial<BrandProfile>): Promise<BrandProfile | null> {
    await this.brandRepository.update(id, updates);
    return await this.findById(id);
  }

  async deleteBrand(id: string): Promise<void> {
    await this.brandRepository.softDelete(id);
  }
}