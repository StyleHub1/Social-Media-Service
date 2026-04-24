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
import { on } from 'events';
import { BrandProfileDeletedEvent } from '../brand/events/brand-profile-deleted.event';
import { UserProfileUpdatedEvent } from '../user/events/user-profile-updated.event';
import { UserProfileDeletedEvent } from '../user/events/user-profile-deleted.event';

@Injectable()
export class EventBridgeService {
  private readonly logger = new Logger(EventBridgeService.name);

  constructor(private readonly messagingService: MessagingService) {}

  @OnEvent('user.profile.completed')
  onUserProfileCompleted(event: UserProfileCompletedEvent): void {
    this.logger.debug(`user.profile.completed → userId=${event.userId}`);
    this.messagingService.publish('social.user.profile-completed', {
      userId: event.userId,
      username: event.username,
      firstName: event.firstName,
      lastName: event.lastName,
      phoneNumber: event.phoneNumber,
      gender: event.gender,
    });
  }

  @OnEvent('user.profile.updated')
  onUserProfileUpdated(event: UserProfileUpdatedEvent): void {
    this.logger.debug(`user.profile.updated → userId=${event.userId}`);
    this.messagingService.publish('social.user.profile-updated', {
      userId: event.userId,
      username: event.username,
      firstName: event.firstName,
      lastName: event.lastName,
      bio: event.bio,
      profileImageUrl: event.profileImageUrl,
      gender: event.gender,
      phoneNumber: event.phoneNumber
    });
  }

  @OnEvent('user.profile.deleted')
  onUserProfileDeleted(event: UserProfileDeletedEvent): void {
    this.logger.debug(`user.profile.deleted → userId=${event.userId}`);
    this.messagingService.publish('social.user.profile-deleted', {
      userId: event.userId,
      username: event.username
    });
  }

  @OnEvent('brand.profile.completed')
  onBrandProfileCompleted(event: BrandProfileCompletedEvent): void {
    this.logger.debug(`brand.profile.completed → brandId=${event.brandId}`);
    this.messagingService.publish('social.brand.profile-completed', {
      brandId: event.brandId,
      brandName: event.brandName,
      username: event.username,
      bio: event.bio,
      websiteUrl: event.websiteUrl
    });
  }

  @OnEvent('brand.profile.updated')
  onBrandProfileUpdated(event: BrandProfileUpdatedEvent): void {
    this.logger.debug(`brand.profile.updated → brandId=${event.brandId}`);
    this.messagingService.publish('social.brand.profile-updated', {
      brandId: event.brandId,
      brandName: event.brandName,
      username: event.username,
      bio: event.bio,
      websiteUrl: event.websiteUrl,
      profileImageUrl: event.profileImageUrl
    });
  }

  @OnEvent('brand.profile.deleted')
  onBrandProfileDeleted(event: BrandProfileDeletedEvent): void {
    this.logger.debug(`brand.profile.deleted → brandId=${event.brandId}`);
    this.messagingService.publish('social.brand.profile-deleted', {
      brandId: event.brandId,
      username: event.username
    });
  }

  @OnEvent('post.created')
  onPostCreated(event: PostCreatedEvent): void {
    this.logger.debug(
      `post.created → postId=${event.post.id} authorId=${event.authorId}`,
    );
    this.messagingService.publish('social.post.created', {
      postId: event.post.id,
      authorId: event.authorId,
      visibility: event.post.visibility,
      createdAt: event.post.createdAt,
    });
  }

  @OnEvent('post.updated')
  onPostUpdated(event: PostUpdatedEvent): void {
    this.logger.debug(
      `post.updated → postId=${event.post.id} authorId=${event.authorId}`,
    );
    this.messagingService.publish('social.post.updated', {
      postId: event.post.id,
      authorId: event.authorId,
      updatedAt: event.post.updatedAt,
    });
  }

  @OnEvent('post.deleted')
  onPostDeleted(event: PostDeletedEvent): void {
    this.logger.debug(
      `post.deleted → postId=${event.postId} authorId=${event.authorId}`,
    );
    this.messagingService.publish('social.post.deleted', {
      postId: event.postId,
      authorId: event.authorId,
    });
  }

  @OnEvent('follow.followed')
  onUserFollowed(event: UserFollowedEvent): void {
    this.logger.debug(
      `follow.followed → followerId=${event.followerId} followingId=${event.followingId}`,
    );
    this.messagingService.publish('social.follow.followed', {
      followId: event.followId,
      followerId: event.followerId,
      followingId: event.followingId,
      createdAt: event.createdAt,
    });
  }

  @OnEvent('follow.unfollowed')
  onUserUnfollowed(event: UserUnfollowedEvent): void {
    this.logger.debug(
      `follow.unfollowed → followerId=${event.followerId} followingId=${event.followingId}`,
    );
    this.messagingService.publish('social.follow.unfollowed', {
      followerId: event.followerId,
      followingId: event.followingId,
    });
  }

  @OnEvent('post.reacted')
  onPostReacted(event: PostReactedEvent): void {
    this.logger.debug(
      `post.reacted → userId=${event.userId} postId=${event.postId}`,
    );
    this.messagingService.publish('social.interaction.reacted', {
      likeId: event.likeId,
      userId: event.userId,
      postId: event.postId,
      authorId: event.postAuthorId,
      createdAt: event.createdAt,
    });
  }

  @OnEvent('post.unreacted')
  onPostUnreacted(event: PostUnreactedEvent): void {
    this.logger.debug(
      `post.unreacted → userId=${event.userId} postId=${event.postId}`,
    );
    this.messagingService.publish('social.interaction.unreacted', {
      userId: event.userId,
      postId: event.postId,
      authorId: event.postAuthorId,
    });
  }

  @OnEvent('comment.created')
  onCommentCreated(event: CommentCreatedEvent): void {
    this.logger.debug(
      `comment.created → commentId=${event.commentId} authorId=${event.authorId} postId=${event.postId}`,
    );
    this.messagingService.publish('social.interaction.commented', {
      commentId: event.commentId,
      authorId: event.authorId,
      postId: event.postId,
      postAuthorId: event.postAuthorId,
      createdAt: event.createdAt,
    });
  }
}
