import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class BrandRepository {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
  ) {}
  async createBrand(brand: Partial<Brand>): Promise<Brand> {
    const newBrand = this.brandRepository.create(brand);
    return await this.brandRepository.save(newBrand);
  }

  async findByEmail(email: string): Promise<Brand | null> {
    return await this.brandRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<Brand | null> {
    return await this.brandRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<Brand | null> {
    return await this.brandRepository.findOne({ where: { id } });
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<Brand | null> {
    return await this.brandRepository.findOne({
      where: [{ email: emailOrUsername }, { username: emailOrUsername }],
      select: ['id', 'email', 'username', 'password', 'role', 'brandName'], // Include password for authentication
    });
  }

  async updateBrand(id: string, updates: Partial<Brand>): Promise<Brand | null> {
    await this.brandRepository.update(id, updates);
    return await this.findById(id);
  }

  async deleteBrand(id: string): Promise<void> {
    await this.brandRepository.softDelete(id);
  }

  async getPasswordHash(id: string): Promise<string | null> {
    const brand = await this.brandRepository.findOne({ where: { id }, select: ['password'] });
    return brand ? brand.password : null;
  }
  async updatePassword(email: string, hashedPassword: string): Promise<void> {
    await this.brandRepository.update({ email }, { password: hashedPassword });
  }
}