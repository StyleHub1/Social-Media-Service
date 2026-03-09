import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/services/user.service';
import { BrandService } from '../brand/services/brand.service';
import { SearchResultDto } from './search-result.dto';

@Injectable()
export class SearchService {
    constructor(
        protected readonly brandService: BrandService,
        protected readonly userService: UserService
    ) {}

// SearchService
    public async search(query: string): Promise<SearchResultDto[]> {
    if (!query?.trim()) return [];

    const [brands, users] = await Promise.all([
        this.brandService.searchBrands(query),
        this.userService.searchUsers(query),
    ]);

    const results = [...brands, ...users];

    // Optional: sort again in JS if needed by a 'score' property
    results.sort((a, b) => b.score - a.score);

    return results;
    }

    public async getUserById(id: string) {
        return await this.userService.getProfile(id);
    }

    public async getBrandById(id: string) {
        return await this.brandService.getProfile(id);
    }

    public async getAccountById(id: string) {
        try {
            return await this.userService.getProfile(id);
        } catch (error) {
            if (error instanceof NotFoundException) {
                return await this.brandService.getProfile(id);
            }
            throw error;
        }
    }
}
