import { Injectable } from '@nestjs/common';
import { FeedRepository, BulkFeedItem } from '../repositories/feed.repository';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { FeedItemResponseDto, FeedPostDto } from '../dto/feed-response.dto';
import { FeedItemType } from '../enums/feed-item-type.enum';
import { PaginationResponse } from '../../common/pagination/pagination.response';
import { Post } from '../../posts/entities/post.entity';

const BACKFILL_LIMIT = 20;

@Injectable()
export class FeedService {
  constructor(private readonly feedRepository: FeedRepository) {}

  async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<PaginationResponse<FeedItemResponseDto>> {
    const { limit, offset } = query;

    const [items, total] = await this.feedRepository.findFeed(
      userId,
      limit,
      offset,
    );

    if (total > 0) {
      return {
        items: items.map((fi) => ({
          id: fi.id,
          type: fi.type,
          createdAt: fi.createdAt,
          post: this.mapPost(fi.post),
        })),
        meta: { total, limit, offset },
      };
    }

    const [posts, globalTotal] = await this.feedRepository.findGlobalPosts(
      limit,
      offset,
    );
    return {
      items: posts.map((p) => ({
        id: p.id,
        type: FeedItemType.GLOBAL,
        createdAt: p.createdAt,
        post: this.mapPost(p),
      })),
      meta: { total: globalTotal, limit, offset },
    };
  }

  async fanOutPost(
    postId: string,
    authorId: string,
    createdAt: Date,
  ): Promise<void> {
    const followerIds = await this.feedRepository.getFollowerIds(authorId);
    const allOwners = [authorId, ...followerIds];

    const items: BulkFeedItem[] = allOwners.map((ownerId) => ({
      ownerId,
      postId,
      authorId,
      createdAt,
    }));

    await this.feedRepository.bulkInsert(items);
  }

  async backfillForFollow(
    followerId: string,
    followingId: string,
  ): Promise<void> {
    const posts = await this.feedRepository.getRecentPostsByAuthor(
      followingId,
      BACKFILL_LIMIT,
    );

    const items: BulkFeedItem[] = posts.map((p) => ({
      ownerId: followerId,
      postId: p.id,
      authorId: followingId,
      createdAt: p.createdAt,
    }));

    await this.feedRepository.bulkInsert(items);
  }

  async cleanupForUnfollow(
    followerId: string,
    followingId: string,
  ): Promise<void> {
    await this.feedRepository.deleteByOwnerAndAuthor(followerId, followingId);
  }

  async cleanupForDeletedPost(postId: string): Promise<void> {
    await this.feedRepository.deleteByPostId(postId);
  }

  private mapPost(post: Post): FeedPostDto {
    return {
      id: post.id,
      content: post.content,
      images: post.images,
      videos: post.videos,
      authorId: post.authorId,
      visibility: post.visibility,
      reactionsCount: post.reactionsCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
    };
  }
}
