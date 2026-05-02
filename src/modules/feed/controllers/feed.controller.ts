import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from '../services/feed.service';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { FeedItemResponseDto } from '../dto/feed-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Controller('feed')
@Roles(Role.USER, Role.BRAND)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  getFeed(
    @CurrentUser('sub') userId: string,
    @Query() query: FeedQueryDto,
  ): Promise<PaginationResponse<FeedItemResponseDto>> {
    return this.feedService.getFeed(userId, query);
  }
}
