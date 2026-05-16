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

  async updateBrand(
    id: string,
    updates: Partial<BrandProfile>,
  ): Promise<BrandProfile | null> {
    await this.brandRepository.update(id, updates);
    return await this.findById(id);
  }

  async deleteBrand(id: string): Promise<void> {
    await this.brandRepository.delete(id);
  }
  async updateProfileImage(
    id: string,
    imageUrl: string,
  ): Promise<BrandProfile | null> {
    const brand = await this.findByBaseUserId(id);
    if (!brand) return null;
    brand.profileImageUrl = imageUrl;
    return await this.brandRepository.save(brand);
  }
  async searchByUsernameOrName(query: string) {
    return await this.brandRepository
      .createQueryBuilder('brand')
      .select([
        'brand.baseUserId',
        'brand.username',
        'brand.brandName',
        'brand.profileImageUrl',
      ])
      .addSelect(
        `GREATEST(
              similarity(brand.username, :plainQuery),
              similarity(brand.brandName, :plainQuery)
            )`,
        'score',
      )
      .where('brand.username ILIKE :q OR brand.brandName ILIKE :q', {
        q: `%${query}%`,
      })
      .setParameter('plainQuery', query)
      .orderBy('score', 'DESC')
      .limit(20)
      .getRawAndEntities();
  }
  public async updateProfile(brand: BrandProfile): Promise<BrandProfile> {
    return await this.brandRepository.save(brand);
  }

  async findAllPaginated(
    limit: number,
    offset: number,
  ): Promise<[BrandProfile[], number]> {
    return await this.brandRepository
      .createQueryBuilder('brand')
      .select([
        'brand.baseUserId',
        'brand.username',
        'brand.brandName',
        'brand.profileImageUrl',
      ])
      .where('brand.brandName IS NOT NULL')
      .orderBy('brand.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
  }
}
