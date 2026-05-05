import { Injectable } from '@nestjs/common';
import { FeedRepository, BulkFeedItem } from '../repositories/feed.repository';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { FeedItemResponseDto, FeedPostDto } from '../dto/feed-response.dto';
import { FeedItemType } from '../enums/feed-item-type.enum';
import { PaginationResponse } from '../../common/pagination/pagination.response';
import { Post } from '../../posts/entities/post.entity';
import { BaseUser } from '@/modules/auth/entities/base-user.entity';

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

    // -----------------------
    // PERSONAL FEED FIRST
    // -----------------------
    const mappedPersonal = feedItems.map((fi: any) => ({
      id: fi.id,
      type: fi.type,
      createdAt: fi.createdAt,
      post: this.mapPost(fi.post, fi.post?.author),
    }));

    items.push(...mappedPersonal);

    // -----------------------
    // GLOBAL FALLBACK
    // -----------------------
    const remainingSlots = limit - items.length;

    if (remainingSlots > 0) {
      const mappedGlobal = globalPosts
        .slice(0, remainingSlots)
        .map((p: any) => ({
          id: p.id,
          type: FeedItemType.GLOBAL,
          createdAt: p.createdAt,
          post: this.mapPost(p, (p as any).author),
        }));

      items.push(...mappedGlobal);
    }

    // -----------------------
    // FIXED TOTAL LOGIC
    // -----------------------
    const hasPersonal = feedTotal > 0;

    const total = hasPersonal
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

  async fanOutPost(postId: string, authorId: string, createdAt: Date) {
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

  async backfillForFollow(followerId: string, followingId: string) {
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

  async cleanupForUnfollow(followerId: string, followingId: string) {
    await this.feedRepository.deleteByOwnerAndAuthor(
      followerId,
      followingId,
    );
  }

  async cleanupForDeletedPost(postId: string) {
    await this.feedRepository.deleteByPostId(postId);
  }

  // -----------------------
  // SAFE AUTHOR MAPPING
  // -----------------------
  private mapPost(post: Post, author: BaseUser): FeedPostDto {
  // Access the profiles nested inside the author object
  const brand = author?.brandProfile;
  const user = author?.userProfile;

  const isBrand = !!brand?.brandName;

  const name = isBrand
    ? brand.brandName
    : `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const image = isBrand 
    ? brand?.profileImageUrl 
    : user?.profileImageUrl;

  return {
    id: post.id,
    content: post.content,
    images: post.images,
    videos: post.videos,
    authorId: post.authorId,
    authorName: name || 'Unknown',
    authorImage: image || null,
    visibility: post.visibility,
    reactionsCount: post.reactionsCount,
    commentsCount: post.commentsCount,
    createdAt: post.createdAt,
  };
}
}