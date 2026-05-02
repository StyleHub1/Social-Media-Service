import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationResponseDto } from '../dto/notification-response.dto';

@Injectable()
export class NotificationRealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  /**
   * Push a notification to all active sockets for a user.
   * If the user is offline this is a no-op — the DB record already exists
   * and will be fetched via REST on next load.
   */
  sendToUser(recipientId: string, notification: NotificationResponseDto): void {
    this.gateway.sendToUser(recipientId, 'notification', notification);
  }
}
