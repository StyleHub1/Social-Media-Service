import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseUsersService } from '../services/base-user.service';
import { PostCreatedEvent } from '@/modules/posts/events/post-created.event';

@Injectable()
export class PostEventListener {
  private readonly logger = new Logger(PostEventListener.name);

  constructor(private readonly baseUserService: BaseUsersService) {}

  @OnEvent('post.created', { async: true })
  async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    this.logger.log(`Handling post.created event for post ID: ${event.post.id}`);
    const authorId = event.authorId;

    try {
      await this.baseUserService.incrementPosts(authorId);
      this.logger.log(`Successfully incremented post count for user ID: ${authorId}`);
    } catch (err) {
      this.logger.error(
        `Failed to increment post count for user ID: ${authorId}`,
        err,
      );
    }

  }
}
