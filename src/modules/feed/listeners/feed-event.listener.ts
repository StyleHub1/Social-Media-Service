import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeedService } from '../services/feed.service';
import { PostCreatedEvent } from '../../posts/events/post-created.event';
import { PostDeletedEvent } from '../../posts/events/post-deleted.event';
import { UserFollowedEvent } from '../../follow/events/user-followed.event';
import { UserUnfollowedEvent } from '../../follow/events/user-unfollowed.event';

@Injectable()
export class FeedEventListener {
  private readonly logger = new Logger(FeedEventListener.name);

  constructor(private readonly feedService: FeedService) {}

  @OnEvent('post.created', { async: true })
  async onPostCreated(event: PostCreatedEvent): Promise<void> {
    try {
      await this.feedService.fanOutPost(
        event.post.id,
        event.authorId,
        event.createdAt,
      );
    } catch (err) {
      this.logger.error(
        `Feed fan-out failed for post ${event.post.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.deleted', { async: true })
  async onPostDeleted(event: PostDeletedEvent): Promise<void> {
    try {
      await this.feedService.cleanupForDeletedPost(event.postId);
    } catch (err) {
      this.logger.error(
        `Feed cleanup failed for deleted post ${event.postId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('follow.followed', { async: true })
  async onUserFollowed(event: UserFollowedEvent): Promise<void> {
    try {
      await this.feedService.backfillForFollow(
        event.followerId,
        event.followingId,
      );
    } catch (err) {
      this.logger.error(
        `Feed backfill failed for follow ${event.followerId} -> ${event.followingId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('follow.unfollowed', { async: true })
  async onUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    try {
      await this.feedService.cleanupForUnfollow(
        event.followerId,
        event.followingId,
      );
    } catch (err) {
      this.logger.error(
        `Feed unfollow cleanup failed ${event.followerId} -> ${event.followingId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
