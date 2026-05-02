import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../services/notification.service';
import { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Controller('notifications')
@Roles(Role.USER, Role.BRAND)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications(
    @CurrentUser('sub') userId: string,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginationResponse<NotificationResponseDto>> {
    return this.notificationService.getNotifications(
      userId,
      query.limit,
      query.offset,
    );
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser('sub') userId: string,
  ): Promise<{ count: number }> {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('sub') userId: string): Promise<void> {
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markAsRead(id, userId);
  }
}
