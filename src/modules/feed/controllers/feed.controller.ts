import { Controller } from '@nestjs/common';
import { FeedService } from '../services/feed.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('feed')
@Roles(Role.USER, Role.BRAND)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}
}
