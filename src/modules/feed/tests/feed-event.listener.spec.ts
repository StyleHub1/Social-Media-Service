import { Test, TestingModule } from '@nestjs/testing';
import { FeedEventListener } from '../listeners/feed-event.listener';
import { FeedService } from '../services/feed.service';
import { PostCreatedEvent } from '../../posts/events/post-created.event';
import { PostDeletedEvent } from '../../posts/events/post-deleted.event';
import { UserFollowedEvent } from '../../follow/events/user-followed.event';
import { UserUnfollowedEvent } from '../../follow/events/user-unfollowed.event';

const mockFeedService = () => ({
  fanOutPost: jest.fn(),
  cleanupForDeletedPost: jest.fn(),
  backfillForFollow: jest.fn(),
  cleanupForUnfollow: jest.fn(),
});

const makePost = (): any => ({ id: 'post-1' });

describe('FeedEventListener', () => {
  let listener: FeedEventListener;
  let feedService: ReturnType<typeof mockFeedService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedEventListener,
        { provide: FeedService, useFactory: mockFeedService },
      ],
    }).compile();

    listener = module.get(FeedEventListener);
    feedService = module.get(FeedService);
  });

  describe('onPostCreated', () => {
    it('calls fanOutPost with correct args', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      const event = new PostCreatedEvent(makePost(), 'author-1', createdAt);
      feedService.fanOutPost.mockResolvedValue(undefined);

      await listener.onPostCreated(event);

      expect(feedService.fanOutPost).toHaveBeenCalledWith(
        'post-1',
        'author-1',
        createdAt,
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = new PostCreatedEvent(makePost(), 'author-1', new Date());
      feedService.fanOutPost.mockRejectedValue(new Error('DB error'));

      await expect(listener.onPostCreated(event)).resolves.not.toThrow();
    });
  });

  describe('onPostDeleted', () => {
    it('calls cleanupForDeletedPost with correct postId', async () => {
      const event = new PostDeletedEvent('post-1', 'author-1');
      feedService.cleanupForDeletedPost.mockResolvedValue(undefined);

      await listener.onPostDeleted(event);

      expect(feedService.cleanupForDeletedPost).toHaveBeenCalledWith('post-1');
    });

    it('swallows errors without rethrowing', async () => {
      const event = new PostDeletedEvent('post-1', 'author-1');
      feedService.cleanupForDeletedPost.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(listener.onPostDeleted(event)).resolves.not.toThrow();
    });
  });

  describe('onUserFollowed', () => {
    it('calls backfillForFollow with followerId and followingId', async () => {
      const event = new UserFollowedEvent(
        'follow-1',
        'follower-1',
        'following-1',
        new Date(),
      );
      feedService.backfillForFollow.mockResolvedValue(undefined);

      await listener.onUserFollowed(event);

      expect(feedService.backfillForFollow).toHaveBeenCalledWith(
        'follower-1',
        'following-1',
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = new UserFollowedEvent(
        'follow-1',
        'follower-1',
        'following-1',
        new Date(),
      );
      feedService.backfillForFollow.mockRejectedValue(new Error('DB error'));

      await expect(listener.onUserFollowed(event)).resolves.not.toThrow();
    });
  });

  describe('onUserUnfollowed', () => {
    it('calls cleanupForUnfollow with followerId and followingId', async () => {
      const event = new UserUnfollowedEvent('follower-1', 'following-1');
      feedService.cleanupForUnfollow.mockResolvedValue(undefined);

      await listener.onUserUnfollowed(event);

      expect(feedService.cleanupForUnfollow).toHaveBeenCalledWith(
        'follower-1',
        'following-1',
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = new UserUnfollowedEvent('follower-1', 'following-1');
      feedService.cleanupForUnfollow.mockRejectedValue(new Error('DB error'));

      await expect(listener.onUserUnfollowed(event)).resolves.not.toThrow();
    });
  });
});
