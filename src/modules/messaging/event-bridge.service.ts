import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessagingService } from './messaging.service';
import { UserProfileCompletedEvent } from '../user/events/user-profile-completed.event';
import { BrandProfileCompletedEvent } from '../brand/events/brand-profile-completed.event';

import { PostCreatedEvent } from '../posts/events/post-created.event';
import { PostUpdatedEvent } from '../posts/events/post-updated.event';
import { PostDeletedEvent } from '../posts/events/post-deleted.event';
import { UserFollowedEvent } from '../follow/events/user-followed.event';
import { UserUnfollowedEvent } from '../follow/events/user-unfollowed.event';
import { PostReactedEvent } from '../interactions/events/post-reacted.event';
import { PostUnreactedEvent } from '../interactions/events/post-unreacted.event';
import { CommentCreatedEvent } from '../interactions/events/comment-created.event';
import { BrandProfileUpdatedEvent } from '../brand/events/brand-profile-updated.event';
import { BrandProfileDeletedEvent } from '../brand/events/brand-profile-deleted.event';
import { UserProfileUpdatedEvent } from '../user/events/user-profile-updated.event';
import { UserProfileDeletedEvent } from '../user/events/user-profile-deleted.event';

@Injectable()
export class EventBridgeService {
  private readonly logger = new Logger(EventBridgeService.name);

  constructor(private readonly messagingService: MessagingService) {}

  @OnEvent('user.profile.completed')
  async onUserProfileCompleted(
    event: UserProfileCompletedEvent,
  ): Promise<void> {
    this.logger.debug(`user.profile.completed → userId=${event.userId}`);
    try {
      await this.messagingService.publish('social.user.profile-completed', {
        userId: event.userId,
        email: event.email,
        username: event.username,
        firstName: event.firstName,
        lastName: event.lastName,
        phoneNumber: event.phoneNumber,
        bio: event.bio,
        gender: event.gender,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish user.profile.completed userId=${event.userId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('user.profile.updated')
  async onUserProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    this.logger.debug(`user.profile.updated → userId=${event.userId}`);
    try {
      await this.messagingService.publish('social.user.profile-updated', {
        userId: event.userId,
        email: event.email,
        username: event.username,
        firstName: event.firstName,
        lastName: event.lastName,
        bio: event.bio,
        profileImageUrl: event.profileImageUrl,
        gender: event.gender,
        phoneNumber: event.phoneNumber,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish user.profile.updated userId=${event.userId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('user.profile.deleted')
  async onUserProfileDeleted(event: UserProfileDeletedEvent): Promise<void> {
    this.logger.debug(`user.profile.deleted → userId=${event.userId}`);
    try {
      await this.messagingService.publish('social.user.profile-deleted', {
        userId: event.userId,
        username: event.username,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish user.profile.deleted userId=${event.userId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('brand.profile.completed')
  async onBrandProfileCompleted(
    event: BrandProfileCompletedEvent,
  ): Promise<void> {
    this.logger.debug(`brand.profile.completed → brandId=${event.brandId}`);
    try {
      await this.messagingService.publish('social.brand.profile-completed', {
        brandId: event.brandId,
        email: event.email,
        brandName: event.brandName,
        username: event.username,
        bio: event.bio,
        websiteUrl: event.websiteUrl,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish brand.profile.completed brandId=${event.brandId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('brand.profile.updated')
  async onBrandProfileUpdated(event: BrandProfileUpdatedEvent): Promise<void> {
    this.logger.debug(`brand.profile.updated → brandId=${event.brandId}`);
    try {
      await this.messagingService.publish('social.brand.profile-updated', {
        brandId: event.brandId,
        email: event.email,
        brandName: event.brandName,
        username: event.username,
        bio: event.bio,
        websiteUrl: event.websiteUrl,
        profileImageUrl: event.profileImageUrl,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish brand.profile.updated brandId=${event.brandId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('brand.profile.deleted')
  async onBrandProfileDeleted(event: BrandProfileDeletedEvent): Promise<void> {
    this.logger.debug(`brand.profile.deleted → brandId=${event.brandId}`);
    try {
      await this.messagingService.publish('social.brand.profile-deleted', {
        brandId: event.brandId,
        username: event.username,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish brand.profile.deleted brandId=${event.brandId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.created')
  async onPostCreated(event: PostCreatedEvent): Promise<void> {
    this.logger.debug(
      `post.created → postId=${event.post.id} authorId=${event.authorId}`,
    );
    try {
      await this.messagingService.publish('social.post.created', {
        postId: event.post.id,
        authorId: event.authorId,
        visibility: event.post.visibility,
        createdAt: event.post.createdAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish post.created postId=${event.post.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.updated')
  async onPostUpdated(event: PostUpdatedEvent): Promise<void> {
    this.logger.debug(
      `post.updated → postId=${event.post.id} authorId=${event.authorId}`,
    );
    try {
      await this.messagingService.publish('social.post.updated', {
        postId: event.post.id,
        authorId: event.authorId,
        updatedAt: event.post.updatedAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish post.updated postId=${event.post.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.deleted')
  async onPostDeleted(event: PostDeletedEvent): Promise<void> {
    this.logger.debug(
      `post.deleted → postId=${event.postId} authorId=${event.authorId}`,
    );
    try {
      await this.messagingService.publish('social.post.deleted', {
        postId: event.postId,
        authorId: event.authorId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish post.deleted postId=${event.postId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('follow.followed')
  async onUserFollowed(event: UserFollowedEvent): Promise<void> {
    this.logger.debug(
      `follow.followed → followerId=${event.followerId} followingId=${event.followingId}`,
    );
    try {
      await this.messagingService.publish('social.follow.followed', {
        followId: event.followId,
        followerId: event.followerId,
        followingId: event.followingId,
        createdAt: event.createdAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish follow.followed followerId=${event.followerId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('follow.unfollowed')
  async onUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    this.logger.debug(
      `follow.unfollowed → followerId=${event.followerId} followingId=${event.followingId}`,
    );
    try {
      await this.messagingService.publish('social.follow.unfollowed', {
        followerId: event.followerId,
        followingId: event.followingId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish follow.unfollowed followerId=${event.followerId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.reacted')
  async onPostReacted(event: PostReactedEvent): Promise<void> {
    this.logger.debug(
      `post.reacted → userId=${event.userId} postId=${event.postId}`,
    );
    try {
      await this.messagingService.publish('social.interaction.reacted', {
        likeId: event.likeId,
        userId: event.userId,
        postId: event.postId,
        authorId: event.postAuthorId,
        createdAt: event.createdAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish post.reacted postId=${event.postId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('post.unreacted')
  async onPostUnreacted(event: PostUnreactedEvent): Promise<void> {
    this.logger.debug(
      `post.unreacted → userId=${event.userId} postId=${event.postId}`,
    );
    try {
      await this.messagingService.publish('social.interaction.unreacted', {
        userId: event.userId,
        postId: event.postId,
        authorId: event.postAuthorId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish post.unreacted postId=${event.postId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('comment.created')
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    this.logger.debug(
      `comment.created → commentId=${event.commentId} authorId=${event.authorId} postId=${event.postId}`,
    );
    try {
      await this.messagingService.publish('social.interaction.commented', {
        commentId: event.commentId,
        authorId: event.authorId,
        postId: event.postId,
        postAuthorId: event.postAuthorId,
        createdAt: event.createdAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish comment.created commentId=${event.commentId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('chat.message.sent')
  async onChatMessageSent(event: {
    messageId: string;
    conversationId: string;
    senderId: string;
    recipientId: string;
    createdAt: Date;
  }): Promise<void> {
    this.logger.debug(
      `chat.message.sent → messageId=${event.messageId} senderId=${event.senderId}`,
    );
    try {
      await this.messagingService.publish('social.chat.message-sent', {
        messageId: event.messageId,
        conversationId: event.conversationId,
        senderId: event.senderId,
        recipientId: event.recipientId,
        createdAt: event.createdAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish chat.message.sent messageId=${event.messageId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  @OnEvent('chat.message.read')
  async onChatMessageRead(event: {
    conversationId: string;
    readBy: string;
    readAt: Date;
  }): Promise<void> {
    this.logger.debug(
      `chat.message.read → conversationId=${event.conversationId} readBy=${event.readBy}`,
    );
    try {
      await this.messagingService.publish('social.chat.message-read', {
        conversationId: event.conversationId,
        readBy: event.readBy,
        readAt: event.readAt,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish chat.message.read conversationId=${event.conversationId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
