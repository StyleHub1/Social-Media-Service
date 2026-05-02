import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

/**
 * Shared real-time module. Import this wherever you need to push events
 * over WebSocket (notifications, chat, etc.).
 *
 * forwardRef breaks the circular dependency:
 *   RealtimeModule → ChatModule → RealtimeModule
 */
@Module({
  imports: [AuthModule, forwardRef(() => ChatModule)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
