import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from '../services/chat.service';
import {
  CreateConversationDto,
  SendDirectMessageDto,
  SendMessageDto,
} from '../dto/send-message.dto';
import { ConversationQueryDto } from '../dto/conversation-query.dto';
import { MessageQueryDto } from '../dto/message-query.dto';
import {
  ConversationResponseDto,
  MessageResponseDto,
} from '../dto/chat-response.dto';
import { CursorPaginationResponse } from '../dto/cursor-pagination.dto';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Controller('chat')
@Roles(Role.USER, Role.BRAND)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Send a message — creates the conversation automatically if it doesn't exist.
   */
  @Post('messages')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async sendDirect(
    @CurrentUser('sub') senderId: string,
    @Body() body: SendDirectMessageDto,
  ): Promise<MessageResponseDto> {
    const conv = await this.chatService.getOrCreateConversation(
      senderId,
      body.recipientId,
    );
    return this.chatService.sendMessage(senderId, conv.id, body.content);
  }

  /** List current user's conversations ordered by most recent activity. */
  @Get('conversations')
  getConversations(
    @CurrentUser('sub') userId: string,
    @Query() query: ConversationQueryDto,
  ): Promise<PaginationResponse<ConversationResponseDto>> {
    return this.chatService.getConversations(userId, query);
  }

  /** Get or create a specific conversation by participant. */
  @Post('conversations')
  getOrCreate(
    @CurrentUser('sub') callerId: string,
    @Body() body: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.chatService.getOrCreateConversation(
      callerId,
      body.participantId,
    );
  }

  /** Get message history for a conversation (cursor-paginated). */
  @Get('conversations/:id/messages')
  getMessages(
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
    @Query() query: MessageQueryDto,
  ): Promise<CursorPaginationResponse<MessageResponseDto>> {
    return this.chatService.getMessages(userId, conversationId, query);
  }

  /** Send a message into an existing conversation. */
  @Post('conversations/:id/messages')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  sendMessage(
    @CurrentUser('sub') senderId: string,
    @Param('id') conversationId: string,
    @Body() body: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(senderId, conversationId, body.content);
  }

  /** Mark all messages in a conversation as seen. */
  @Patch('conversations/:id/seen')
  markAsSeen(
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
  ): Promise<void> {
    return this.chatService.markConversationAsSeen(userId, conversationId);
  }
}
