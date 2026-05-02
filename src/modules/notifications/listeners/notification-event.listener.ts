import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import { NotificationType } from '../enums/notification-type.enum';
import { UserFollowedEvent } from '../../follow/events/user-followed.event';
import { PostReactedEvent } from '../../interactions/events/post-reacted.event';
import { CommentCreatedEvent } from '../../interactions/events/comment-created.event';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('follow.followed', { async: true })
  async handleFollowFollowed(event: UserFollowedEvent): Promise<void> {
    if (event.followerId === event.followingId) return;

    try {
      await this.notificationService.createAndDeliver({
        recipientId: event.followingId,
        actorId: event.followerId,
        type: NotificationType.NEW_FOLLOWER,
        postId: null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create NEW_FOLLOWER notification followingId=${event.followingId}`,
        err,
      );
    }
  }

  @OnEvent('post.reacted', { async: true })
  async handlePostReacted(event: PostReactedEvent): Promise<void> {
    // Skip self-reactions
    if (event.userId === event.postAuthorId) return;

    try {
      await this.notificationService.createAndDeliver({
        recipientId: event.postAuthorId,
        actorId: event.userId,
        type: NotificationType.POST_LIKED,
        postId: event.postId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create POST_LIKED notification postAuthorId=${event.postAuthorId}`,
        err,
      );
    }
  }

  @OnEvent('comment.created', { async: true })
  async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    // Skip self-comments on own post
    if (event.authorId === event.postAuthorId) return;

    try {
      await this.notificationService.createAndDeliver({
        recipientId: event.postAuthorId,
        actorId: event.authorId,
        type: NotificationType.POST_COMMENTED,
        postId: event.postId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create POST_COMMENTED notification postAuthorId=${event.postAuthorId}`,
        err,
      );
    }
  }
}
