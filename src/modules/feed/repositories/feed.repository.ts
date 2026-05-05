import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FeedItem } from '../entities/feed-item.entity';
import { FeedItemType } from '../enums/feed-item-type.enum';
import { Post, PostVisibility } from '../../posts/entities/post.entity';

export interface BulkFeedItem {
  ownerId: string;
  postId: string;
  authorId: string;
  createdAt: Date;
}

const CHUNK_SIZE = 500;

@Injectable()
export class FeedRepository {
  constructor(
    @InjectRepository(FeedItem)
    private readonly repository: Repository<FeedItem>,
    private readonly dataSource: DataSource,
  ) {}

  async bulkInsert(items: BulkFeedItem[]): Promise<void> {
    if (!items.length) return;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);

      await this.repository
        .createQueryBuilder()
        .insert()
        .into(FeedItem)
        .values(
          chunk.map((item) => ({
            ownerId: item.ownerId,
            postId: item.postId,
            authorId: item.authorId,
            type: FeedItemType.POST,
            createdAt: item.createdAt,
          })),
        )
        .orIgnore()
        .execute();
    }
  }

  async getFollowerIds(authorId: string): Promise<string[]> {
    const rows: { followerId: string }[] = await this.dataSource.query(
      `SELECT "followerId"
       FROM "follows"
       WHERE "followingId" = $1 AND "status" = 'ACTIVE'`,
      [authorId],
    );

    return rows.map((r) => r.followerId);
  }

  async getRecentPostsByAuthor(
    authorId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]> {
    const rows = await this.dataSource.query(
      `SELECT id, "createdAt"
       FROM "posts"
       WHERE "authorId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [authorId, limit],
    );

    return rows.map((r: any) => ({
      id: r.id,
      createdAt: new Date(r.createdAt),
    }));
  }

  // -----------------------------------
  // PERSONAL FEED JOIN (NO VIEW)
  // -----------------------------------
  async findFeed(
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<[any[], number]> {
    const qb = this.repository
      .createQueryBuilder('fi')
      .innerJoinAndSelect('fi.post', 'p', 'p.deletedAt IS NULL')

      // base user
      .innerJoin('base_users', 'bu', 'bu.id = p.authorId')

      // user profile
      .leftJoin('user_profiles', 'up', 'up.baseUserId = bu.id')

      // brand profile
      .leftJoin('brand_profiles', 'bp', 'bp.baseUserId = bu.id')

      .addSelect([
        'bu.id',
        'up.firstName',
        'up.lastName',
        'up.profileImageUrl',
        'bp.brandName',
        'bp.profileImageUrl',
      ])

      .where('fi.ownerId = :ownerId', { ownerId })
      .orderBy('fi.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    return qb.getManyAndCount();
  }

  // -----------------------------------
  // GLOBAL FEED JOIN (NO VIEW)
  // -----------------------------------
  async findGlobalPosts(
    limit: number,
    offset: number,
  ): Promise<[Post[], number]> {
    return this.dataSource
      .getRepository(Post)
      .createQueryBuilder('p')

      .innerJoin('base_users', 'bu', 'bu.id = p.authorId')
      .leftJoin('user_profiles', 'up', 'up.baseUserId = bu.id')
      .leftJoin('brand_profiles', 'bp', 'bp.baseUserId = bu.id')

      .addSelect([
        'bu.id',
        'up.firstName',
        'up.lastName',
        'up.profileImageUrl',
        'bp.brandName',
        'bp.profileImageUrl',
      ])

      .where('p.visibility = :visibility', {
        visibility: PostVisibility.PUBLIC,
      })
      .andWhere('p.deletedAt IS NULL')
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
  }

  async deleteByPostId(postId: string): Promise<void> {
    await this.repository.delete({ postId });
  }

  async deleteByOwnerAndAuthor(
    ownerId: string,
    authorId: string,
  ): Promise<void> {
    await this.repository.delete({ ownerId, authorId });
  }

  async deleteExpiredItems(before: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(FeedItem)
      .where('createdAt < :before', { before })
      .execute();

    return result.affected ?? 0;
  }
}