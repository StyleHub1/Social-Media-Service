import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatService } from './services/chat.service';
import { TypingService } from './services/typing.service';
import { ChatController } from './controllers/chat.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ChatMessage]),
    forwardRef(() => RealtimeModule),
  ],
  providers: [
    ConversationRepository,
    MessageRepository,
    ChatService,
    TypingService,
  ],
  controllers: [ChatController],
  exports: [ChatService, TypingService],
})
export class ChatModule {}
