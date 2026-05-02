import { NotificationType } from '../enums/notification-type.enum';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  actorId: string | null;
  postId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;

  static fromEntity(n: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = n.id;
    dto.type = n.type;
    dto.actorId = n.actorId;
    dto.postId = n.postId;
    dto.isRead = n.isRead;
    dto.readAt = n.readAt;
    dto.createdAt = n.createdAt;
    return dto;
  }
}
