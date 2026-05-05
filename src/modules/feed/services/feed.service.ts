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

    const [feedItems, feedTotal] = await this.feedRepository.findFeed(
      userId,
      limit,
      offset,
    );

    const [globalPosts, globalTotal] = await this.feedRepository.findGlobalPosts(
      limit,
      offset,
    );

    const items: FeedItemResponseDto[] = [];

    // PERSONAL FEED
    if (feedItems.length > 0) {
      items.push(
        ...feedItems.map((fi: any) => ({
          id: fi.id,
          type: fi.type,
          createdAt: fi.createdAt,
          post: this.mapPost(fi.post, fi.post?.author),
        })),
      );
    }

    // GLOBAL FALLBACK
    const remainingSlots = limit - items.length;

    if (remainingSlots > 0) {
      items.push(
        ...globalPosts.slice(0, remainingSlots).map((p: any) => ({
          id: p.id,
          type: FeedItemType.GLOBAL,
          createdAt: p.createdAt,
          post: this.mapPost(p, (p as any).author),
        })),
      );
    }

    // ✅ FIXED TOTAL (NO DOUBLE COUNTING)
    const total =
      feedTotal > 0
        ? feedTotal
        : globalTotal;

    return {
      items,
      meta: {
        total,
        limit,
        offset,
      },
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
    await this.feedRepository.deleteByOwnerAndAuthor(
      followerId,
      followingId,
    );
  }

  async cleanupForDeletedPost(postId: string): Promise<void> {
    await this.feedRepository.deleteByPostId(postId);
  }

  // -----------------------------------
  // SAFE AUTHOR MAPPING (NO VIEW)
  // -----------------------------------
  private mapPost(post: Post, author: any): FeedPostDto {
    const isBrand = !!author?.brandName;

    const name = isBrand
      ? author.brandName
      : `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim();

    return {
      id: post.id,
      content: post.content,
      images: post.images,
      videos: post.videos,
      authorId: post.authorId,

      authorName: name || 'Unknown',
      authorImage: author?.profileImageUrl ?? null,

      visibility: post.visibility,
      reactionsCount: post.reactionsCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
    };
  }
}