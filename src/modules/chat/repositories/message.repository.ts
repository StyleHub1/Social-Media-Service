import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { MessageStatus } from '../enums/message-status.enum';
import {
  CursorPaginationResponse,
  decodeCursor,
  encodeCursor,
} from '../dto/cursor-pagination.dto';
import { MessageQueryDto } from '../dto/message-query.dto';

interface CreateMessageData {
  conversationId: string;
  senderId: string;
  content: string;
}

@Injectable()
export class MessageRepository {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly repo: Repository<ChatMessage>,
    private readonly dataSource: DataSource,
  ) {}

  create(data: CreateMessageData): Promise<ChatMessage> {
    const msg = this.repo.create({ ...data, status: MessageStatus.SENT });
    return this.repo.save(msg);
  }

  async findByConversation(
    conversationId: string,
    query: MessageQueryDto,
  ): Promise<CursorPaginationResponse<ChatMessage>> {
    const { limit, cursor } = query;
    const fetchLimit = limit + 1;

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(fetchLimit);

    if (cursor) {
      const { createdAt: createdAtStr, id: cursorId } = decodeCursor(cursor);
      const cursorDate = new Date(createdAtStr);
      qb.andWhere(
        `(m."createdAt" < :cursorDate OR (m."createdAt" = :cursorDate AND m.id < :cursorId))`,
        { cursorDate, cursorId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length === fetchLimit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.createdAt, lastItem.id)
        : null;

    return { items, nextCursor };
  }

  /**
   * Transitions a single message status forward (SENT→DELIVERED, any→SEEN).
   * WHERE clause enforces one-way transitions — silently no-ops if already at
   * or past the target status.
   */
  async updateStatus(
    messageId: string,
    newStatus: MessageStatus,
  ): Promise<ChatMessage | null> {
    const allowedFrom: Record<MessageStatus, MessageStatus[]> = {
      [MessageStatus.DELIVERED]: [MessageStatus.SENT],
      [MessageStatus.SEEN]: [MessageStatus.SENT, MessageStatus.DELIVERED],
      [MessageStatus.SENT]: [],
    };

    const from = allowedFrom[newStatus];
    if (from.length === 0) return null;

    await this.repo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({
        status: newStatus,
        ...(newStatus === MessageStatus.SEEN ? { seenAt: new Date() } : {}),
      })
      .where('id = :messageId AND status IN (:...from)', { messageId, from })
      .execute();

    return this.repo.findOne({ where: { id: messageId } });
  }

  /**
   * Bulk-marks all unread messages from the other participant as SEEN.
   * Returns affected message IDs so the caller can push status events to sender.
   */
  async markConversationSeen(
    conversationId: string,
    recipientId: string,
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `UPDATE "chat_messages"
       SET "status" = 'SEEN', "seenAt" = now()
       WHERE "conversationId" = $1
         AND "senderId" != $2
         AND "status" != 'SEEN'
       RETURNING "id"`,
      [conversationId, recipientId],
    );
    return rows.map((r) => r.id);
  }

  countUnread(conversationId: string, recipientId: string): Promise<number> {
    return this.repo
      .createQueryBuilder('m')
      .where(
        'm.conversationId = :cid AND m.senderId != :rid AND m.status != :seen',
        { cid: conversationId, rid: recipientId, seen: MessageStatus.SEEN },
      )
      .getCount();
  }

  findById(id: string): Promise<ChatMessage | null> {
    return this.repo.findOne({ where: { id } });
  }
}
