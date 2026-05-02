import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repo.create(data);
    return this.repo.save(notification);
  }

  async findByRecipient(
    recipientId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Notification>> {
    const [items, total] = await this.repo.findAndCount({
      where: { recipientId },
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
    const rows: Notification[] = await this.dataSource.query(
      `UPDATE "notifications"
       SET "isRead" = true, "readAt" = now()
       WHERE id = $1 AND "recipientId" = $2 AND "isRead" = false
       RETURNING *`,
      [id, recipientId],
    );
    return rows[0] ?? null;
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
