import { Injectable } from '@nestjs/common';
import { BrandRepository } from '../repositories/brand.repository';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class BrandService {
    constructor(
        protected readonly brandRepository: BrandRepository
    ) {}
    public async register(brandData: Partial<Brand>): Promise<Brand> {
        return await this.brandRepository.createBrand(brandData);
    }

    public async findByEmail(email: string): Promise<Brand | null> {
        return await this.brandRepository.findByEmail(email);
    }

    public async findByUsername(username: string): Promise<Brand | null> {
        return await this.brandRepository.findByUsername(username);
    }

    public async findByEmailOrUsername(emailOrUsername: string): Promise<Brand | null> {
        return await this.brandRepository.findByEmailOrUsername(emailOrUsername);
    }

    public async findById(id: string): Promise<Brand | null> {
        return await this.brandRepository.findById(id);
    }      
}
