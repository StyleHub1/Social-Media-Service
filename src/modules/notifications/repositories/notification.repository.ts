import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { PaginationResponse } from '../../common/pagination/pagination.response';

export interface CreateNotificationData {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  postId: string | null;
}

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  private readonly actorRelations = {
    actor: { userProfile: true, brandProfile: true },
  };

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repo.create(data);
    const saved = await this.repo.save(notification);
    return this.repo.findOne({
      where: { id: saved.id },
      relations: this.actorRelations,
    }) as Promise<Notification>;
  }

  async findByRecipient(
    recipientId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Notification>> {
    const [items, total] = await this.repo.findAndCount({
      where: { recipientId },
      relations: this.actorRelations,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items, meta: { total, limit, offset } };
  }

  async markAsRead(
    id: string,
    recipientId: string,
  ): Promise<Notification | null> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('id = :id AND recipientId = :recipientId AND isRead = :isRead', {
        id,
        recipientId,
        isRead: false,
      })
      .execute();

    if (!result.affected || result.affected === 0) return null;
    return this.repo.findOne({
      where: { id },
      relations: this.actorRelations,
    });
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.repo.update(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  countUnread(recipientId: string): Promise<number> {
    return this.repo.count({ where: { recipientId, isRead: false } });
  }
}
