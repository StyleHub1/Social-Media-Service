import { NotificationType } from '../enums/notification-type.enum';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  actorId: string | null;
  actorName: string | null;
  actorPhoto: string | null;
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

    const userProfile = n.actor?.userProfile ?? null;
    const brandProfile = n.actor?.brandProfile ?? null;

    dto.actorName = userProfile?.username ?? brandProfile?.username ?? null;
    dto.actorPhoto =
      userProfile?.profileImageUrl ?? brandProfile?.profileImageUrl ?? null;

    return dto;
  }
}
