import { MessageStatus } from '../enums/message-status.enum';
import { ChatMessage } from '../entities/chat-message.entity';
import { Conversation } from '../entities/conversation.entity';

export class MessageResponseDto {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: MessageStatus;
  seenAt: Date | null;
  createdAt: Date;

  static fromEntity(msg: ChatMessage): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = msg.id;
    dto.conversationId = msg.conversationId;
    dto.senderId = msg.senderId;
    dto.content = msg.content;
    dto.status = msg.status;
    dto.seenAt = msg.seenAt;
    dto.createdAt = msg.createdAt;
    return dto;
  }
}

export class ConversationResponseDto {
  id: string;
  /** The other participant's userId (not the caller) */
  otherParticipantId: string;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;

  static fromEntity(
    conv: Conversation,
    callerId: string,
    unreadCount: number,
  ): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = conv.id;
    dto.otherParticipantId =
      conv.participantA === callerId ? conv.participantB : conv.participantA;
    dto.lastMessageAt = conv.lastMessageAt;
    dto.unreadCount = unreadCount;
    dto.createdAt = conv.createdAt;
    return dto;
  }
}

export class MessageStatusPushDto {
  messageId: string;
  status: MessageStatus;
  timestamp: Date;
}
