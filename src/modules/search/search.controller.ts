import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { SearchResultDto } from './search-result.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

// GET /search?query=omar
  @Get()
  @Roles(Role.USER, Role.BRAND)
  async search(@Query('query') query: string): Promise<SearchResultDto[]> {
    return this.searchService.search(query);
  }

  // GET /search/user/:id
  @Get('user/:id')
  @Roles(Role.USER, Role.BRAND)
  async getUserById(@Param('id') id: string) {
    return this.searchService.getUserById(id);
  }

  // GET /search/brand/:id
  @Get('brand/:id')
  @Roles(Role.USER, Role.BRAND)
  async getBrandById(@Param('id') id: string) {
    return this.searchService.getBrandById(id);
  }

  // GET /search/account/:id
  @Get('account/:id')
  @Roles(Role.USER, Role.BRAND)
  async getAccountById(@Param('id') id: string) {
    return this.searchService.getAccountById(id);
  }
}
