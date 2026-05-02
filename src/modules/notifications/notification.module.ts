import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationService } from './services/notification.service';
import { NotificationRealtimeService } from './services/notification-realtime.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NotificationController } from './controllers/notification.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), RealtimeModule],
  providers: [
    NotificationRepository,
    NotificationService,
    NotificationRealtimeService,
    NotificationEventListener,
  ],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
