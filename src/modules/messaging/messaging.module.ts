import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { EventBridgeService } from './event-bridge.service';

@Module({
  providers: [MessagingService, EventBridgeService],
  exports: [MessagingService],
})
export class MessagingModule {}
