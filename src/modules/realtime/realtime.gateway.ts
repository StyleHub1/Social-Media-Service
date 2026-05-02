import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../auth/services/jwt.service';
import { ChatService } from '../chat/services/chat.service';
import { TypingService } from '../chat/services/typing.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => TypingService))
    private readonly typingService: TypingService,
  ) {}

  handleConnection(socket: Socket): void {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.disconnect();
        return;
      }
      const payload = this.jwtService.verifyToken(token);
      const userId = payload.sub;
      (socket.data as { userId: string }).userId = userId;
      void socket.join(userId);
      this.logger.debug(
        `Client connected: socketId=${socket.id} userId=${userId}`,
      );
    } catch {
      // Invalid or expired token — reject silently
      socket.disconnect();
    }
  }

  afterInit(): void {
    // Register auto-stop callback: when typing timer fires, emit isTyping:false
    // to the other participant. Async because it requires a DB lookup.
    this.typingService.setAutoStopCallback(
      (userId: string, conversationId: string) => {
        void this.chatService
          .getOtherParticipantId(conversationId, userId)
          .then((recipientId) => {
            if (recipientId) {
              this.sendToUser(recipientId, 'chat:typing', {
                userId,
                conversationId,
                isTyping: false,
              });
            }
          });
      },
    );
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Client disconnected: socketId=${socket.id}`);

    const userId = (socket.data as { userId?: string }).userId;
    if (userId) {
      // Clear any active typing sessions and notify the other participants
      const activeConversations = this.typingService.clearUserState(userId);
      for (const conversationId of activeConversations) {
        void this.chatService
          .getOtherParticipantId(conversationId, userId)
          .then((recipientId) => {
            if (recipientId) {
              this.sendToUser(recipientId, 'chat:typing', {
                userId,
                conversationId,
                isTyping: false,
              });
            }
          });
      }
    }
    // Socket.IO removes the socket from all rooms automatically on disconnect
  }

  // ─── Chat WebSocket handlers ────────────────────────────────────────────────

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string; content: string },
  ): Promise<void> {
    const userId = (socket.data as { userId: string }).userId;
    try {
      await this.chatService.sendMessage(
        userId,
        payload.conversationId,
        payload.content,
      );
    } catch (err) {
      this.logger.error(`chat:send failed userId=${userId}: ${String(err)}`);
      socket.emit('chat:error', { message: String(err) });
    }
  }

  @SubscribeMessage('chat:typing')
  async handleChatTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = (socket.data as { userId: string }).userId;
    const { shouldForward } = this.typingService.handleTyping(
      userId,
      payload.conversationId,
      payload.isTyping,
    );

    if (!shouldForward) return;

    const recipientId = await this.chatService.getOtherParticipantId(
      payload.conversationId,
      userId,
    );
    if (recipientId) {
      this.sendToUser(recipientId, 'chat:typing', {
        userId,
        conversationId: payload.conversationId,
        isTyping: payload.isTyping,
      });
    }
  }

  @SubscribeMessage('chat:seen')
  async handleChatSeen(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const userId = (socket.data as { userId: string }).userId;
    try {
      await this.chatService.markConversationAsSeen(
        userId,
        payload.conversationId,
      );
    } catch (err) {
      this.logger.error(`chat:seen failed userId=${userId}: ${String(err)}`);
    }
  }

  /**
   * Emit an event to every socket in a user's room (multi-device safe).
   * If the user is offline the call is a no-op — DB is the source of truth.
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    this.server.to(userId).emit(event, data);
  }

  private extractToken(socket: Socket): string | null {
    const fromAuth = (socket.handshake.auth as Record<string, unknown>)?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    const fromQuery = socket.handshake.query?.token;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;

    return null;
  }
}
