import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { MessageStatus } from '../enums/message-status.enum';
import {
  ConversationResponseDto,
  MessageResponseDto,
  MessageStatusPushDto,
} from '../dto/chat-response.dto';
import { ConversationQueryDto } from '../dto/conversation-query.dto';
import { MessageQueryDto } from '../dto/message-query.dto';
import { CursorPaginationResponse } from '../dto/cursor-pagination.dto';
import { PaginationResponse } from '../../common/pagination/pagination.response';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getOrCreateConversation(
    callerId: string,
    participantId: string,
  ): Promise<ConversationResponseDto> {
    if (callerId === participantId) {
      throw new BadRequestException(
        'Cannot start a conversation with yourself',
      );
    }
    const conv = await this.conversationRepo.findOrCreate(
      callerId,
      participantId,
    );
    const unread = await this.messageRepo.countUnread(conv.id, callerId);
    return ConversationResponseDto.fromEntity(conv, callerId, unread);
  }

  async sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageResponseDto> {
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    this.assertParticipant(conv.participantA, conv.participantB, senderId);

    const recipientId =
      conv.participantA === senderId ? conv.participantB : conv.participantA;

    let msg = await this.messageRepo.create({
      conversationId,
      senderId,
      content,
    });

    // Attempt immediate DELIVERED transition if recipient is online
    if (await this.isUserOnline(recipientId)) {
      const updated = await this.messageRepo.updateStatus(
        msg.id,
        MessageStatus.DELIVERED,
      );
      if (updated) msg = updated;

      const statusPush: MessageStatusPushDto = {
        messageId: msg.id,
        status: MessageStatus.DELIVERED,
        timestamp: new Date(),
      };
      this.gateway.sendToUser(senderId, 'chat:status', statusPush);
    }

    await this.conversationRepo.updateLastMessageAt(
      conversationId,
      msg.createdAt,
    );

    const dto = MessageResponseDto.fromEntity(msg);
    this.gateway.sendToUser(recipientId, 'chat:message', dto);

    this.eventEmitter.emit('chat.message.sent', {
      messageId: msg.id,
      conversationId,
      senderId,
      recipientId,
      createdAt: msg.createdAt,
    });

    return dto;
  }

  async getConversations(
    userId: string,
    query: ConversationQueryDto,
  ): Promise<PaginationResponse<ConversationResponseDto>> {
    const result = await this.conversationRepo.findByUser(
      userId,
      query.limit,
      query.offset,
    );

    const convIds = result.items.map((c) => c.id);
    const unreadMap = await this.messageRepo.batchCountUnread(convIds, userId);
    const items = result.items.map((conv) =>
      ConversationResponseDto.fromEntity(conv, userId, unreadMap[conv.id] ?? 0),
    );

    return { items, meta: result.meta };
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query: MessageQueryDto,
  ): Promise<CursorPaginationResponse<MessageResponseDto>> {
    await this.assertConversationParticipant(conversationId, userId);
    const result = await this.messageRepo.findByConversation(
      conversationId,
      query,
    );
    return {
      items: result.items.map((m) => MessageResponseDto.fromEntity(m)),
      nextCursor: result.nextCursor,
    };
  }

  async markConversationAsSeen(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await this.assertConversationParticipant(conversationId, userId);

    const affectedIds = await this.messageRepo.markConversationSeen(
      conversationId,
      userId,
    );

    if (affectedIds.length === 0) return;

    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) return;
    const senderId =
      conv.participantA === userId ? conv.participantB : conv.participantA;

    const timestamp = new Date();
    for (const messageId of affectedIds) {
      const statusPush: MessageStatusPushDto = {
        messageId,
        status: MessageStatus.SEEN,
        timestamp,
      };
      this.gateway.sendToUser(senderId, 'chat:status', statusPush);
    }

    this.eventEmitter.emit('chat.message.read', {
      conversationId,
      readBy: userId,
      readAt: timestamp,
    });
  }

  async getOtherParticipantId(
    conversationId: string,
    userId: string,
  ): Promise<string | null> {
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) return null;
    if (conv.participantA !== userId && conv.participantB !== userId)
      return null;
    return conv.participantA === userId ? conv.participantB : conv.participantA;
  }

  private async assertConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    this.assertParticipant(conv.participantA, conv.participantB, userId);
  }

  private assertParticipant(pA: string, pB: string, userId: string): void {
    if (pA !== userId && pB !== userId) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    try {
      const sockets = await this.gateway.server.in(userId).fetchSockets();
      return sockets.length > 0;
    } catch (err) {
      this.logger.warn(
        `fetchSockets failed for userId=${userId}: ${String(err)}`,
      );
      return false;
    }
  }
}
