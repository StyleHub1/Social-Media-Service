import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateNotificationData,
  NotificationRepository,
} from '../repositories/notification.repository';
import { NotificationRealtimeService } from './notification-realtime.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly realtimeService: NotificationRealtimeService,
  ) {}

  async createAndDeliver(
    data: CreateNotificationData,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.create(data);
    const dto = NotificationResponseDto.fromEntity(notification);

    // Best-effort real-time delivery — never throws even if user is offline
    this.realtimeService.sendToUser(data.recipientId, dto);

    return dto;
  }

  async getNotifications(
    recipientId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<NotificationResponseDto>> {
    const result = await this.notificationRepository.findByRecipient(
      recipientId,
      limit,
      offset,
    );

    return {
      items: result.items.map((n) => NotificationResponseDto.fromEntity(n)),
      meta: result.meta,
    };
  }

  async markAsRead(
    id: string,
    recipientId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.markAsRead(
      id,
      recipientId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return NotificationResponseDto.fromEntity(notification);
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(recipientId);
  }

  async getUnreadCount(recipientId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.countUnread(recipientId);
    return { count };
  }
}
