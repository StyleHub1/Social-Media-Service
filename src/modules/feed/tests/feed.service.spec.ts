import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from '../services/feed.service';
import { FeedRepository } from '../repositories/feed.repository';
import { FeedItemType } from '../enums/feed-item-type.enum';
import { PostVisibility } from '../../posts/entities/post.entity';

const mockFeedRepository = () => ({
  getFollowerIds: jest.fn(),
  bulkInsert: jest.fn(),
  getRecentPostsByAuthor: jest.fn(),
  deleteByOwnerAndAuthor: jest.fn(),
  deleteByPostId: jest.fn(),
  findFeed: jest.fn(),
  findGlobalPosts: jest.fn(),
  deleteExpiredItems: jest.fn(),
});

const makePost = (overrides = {}) => ({
  id: 'post-1',
  content: 'Hello',
  images: [],
  videos: [],
  authorId: 'author-1',
  visibility: PostVisibility.PUBLIC,
  reactionsCount: 0,
  commentsCount: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeFeedItem = (overrides = {}) => ({
  id: 'fi-1',
  type: FeedItemType.POST,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  post: makePost(),
  ...overrides,
});

describe('FeedService', () => {
  let service: FeedService;
  let repo: ReturnType<typeof mockFeedRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: FeedRepository, useFactory: mockFeedRepository },
      ],
    }).compile();

    service = module.get(FeedService);
    repo = module.get(FeedRepository);
  });

  describe('fanOutPost', () => {
    it('inserts feed item for the author and all followers', async () => {
      repo.getFollowerIds.mockResolvedValue(['follower-1', 'follower-2']);
      repo.bulkInsert.mockResolvedValue(undefined);

      await service.fanOutPost('post-1', 'author-1', new Date());

      expect(repo.getFollowerIds).toHaveBeenCalledWith('author-1');
      expect(repo.bulkInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ ownerId: 'author-1', postId: 'post-1' }),
          expect.objectContaining({ ownerId: 'follower-1', postId: 'post-1' }),
          expect.objectContaining({ ownerId: 'follower-2', postId: 'post-1' }),
        ]),
      );
      const insertedItems = (repo.bulkInsert.mock.calls[0] as [unknown[]])[0];
      expect(insertedItems).toHaveLength(3);
    });

    it('inserts only self feed item when author has no followers', async () => {
      repo.getFollowerIds.mockResolvedValue([]);
      repo.bulkInsert.mockResolvedValue(undefined);

      await service.fanOutPost('post-1', 'author-1', new Date());

      expect(repo.bulkInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          ownerId: 'author-1',
          postId: 'post-1',
          authorId: 'author-1',
        }),
      ]);
    });
  });

  describe('backfillForFollow', () => {
    it('fetches up to 20 recent posts and inserts feed items for the new follower', async () => {
      const posts = Array.from({ length: 20 }, (_, i) => ({
        id: `post-${i}`,
        createdAt: new Date(),
      }));
      repo.getRecentPostsByAuthor.mockResolvedValue(posts);
      repo.bulkInsert.mockResolvedValue(undefined);

      await service.backfillForFollow('follower-1', 'following-1');

      expect(repo.getRecentPostsByAuthor).toHaveBeenCalledWith(
        'following-1',
        20,
      );
      expect(repo.bulkInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            ownerId: 'follower-1',
            authorId: 'following-1',
          }),
        ]),
      );
      const insertedItems = (repo.bulkInsert.mock.calls[0] as [unknown[]])[0];
      expect(insertedItems).toHaveLength(20);
    });

    it('handles followed user with no posts gracefully', async () => {
      repo.getRecentPostsByAuthor.mockResolvedValue([]);
      repo.bulkInsert.mockResolvedValue(undefined);

      await service.backfillForFollow('follower-1', 'following-1');

      expect(repo.bulkInsert).toHaveBeenCalledWith([]);
    });
  });

  describe('cleanupForUnfollow', () => {
    it('delegates to deleteByOwnerAndAuthor with correct args', async () => {
      repo.deleteByOwnerAndAuthor.mockResolvedValue(undefined);

      await service.cleanupForUnfollow('follower-1', 'following-1');

      expect(repo.deleteByOwnerAndAuthor).toHaveBeenCalledWith(
        'follower-1',
        'following-1',
      );
    });
  });

  describe('cleanupForDeletedPost', () => {
    it('delegates to deleteByPostId with correct postId', async () => {
      repo.deleteByPostId.mockResolvedValue(undefined);

      await service.cleanupForDeletedPost('post-1');

      expect(repo.deleteByPostId).toHaveBeenCalledWith('post-1');
    });
  });

  describe('getFeed', () => {
    const query = { limit: 10, offset: 0 };

    it('returns paginated feed items when feed is non-empty', async () => {
      const item = makeFeedItem();
      repo.findFeed.mockResolvedValue([[item], 1]);

      const result = await service.getFeed('user-1', query);

      expect(result.meta.total).toBe(1);
      expect(result.items[0].type).toBe(FeedItemType.POST);
      expect(result.items[0].post.id).toBe('post-1');
      expect(repo.findGlobalPosts).not.toHaveBeenCalled();
    });

    it('falls back to global posts when personal feed is empty', async () => {
      repo.findFeed.mockResolvedValue([[], 0]);
      const post = makePost();
      repo.findGlobalPosts.mockResolvedValue([[post], 5]);

      const result = await service.getFeed('user-1', query);

      expect(repo.findGlobalPosts).toHaveBeenCalledWith(10, 0);
      expect(result.meta.total).toBe(5);
      expect(result.items[0].type).toBe(FeedItemType.GLOBAL);
    });

    it('returns GLOBAL type for all fallback items', async () => {
      repo.findFeed.mockResolvedValue([[], 0]);
      repo.findGlobalPosts.mockResolvedValue([
        [makePost(), makePost({ id: 'post-2' })],
        2,
      ]);

      const result = await service.getFeed('user-1', query);

      expect(result.items.every((i) => i.type === FeedItemType.GLOBAL)).toBe(
        true,
      );
    });

    it('returns correct meta pagination values', async () => {
      const item = makeFeedItem();
      repo.findFeed.mockResolvedValue([[item], 42]);

      const result = await service.getFeed('user-1', { limit: 5, offset: 10 });

      expect(result.meta).toEqual({ total: 42, limit: 5, offset: 10 });
    });
  });
});
