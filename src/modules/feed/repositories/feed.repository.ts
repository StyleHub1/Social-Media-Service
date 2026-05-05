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
  // FEED (PERSONAL)
  // -----------------------------------
  async findFeed(ownerId: string, limit: number, offset: number) {
    const qb = this.repository
      .createQueryBuilder('fi')
      // 1. Join the post
      .innerJoinAndSelect('fi.post', 'p', 'p.deletedAt IS NULL')
      
      // 2. Join the author relation (defined in Post entity)
      .leftJoinAndSelect('p.author', 'author')
      
      // 3. Join the profiles related to the author
      // Note: These relation names (userProfile/brandProfile) must match 
      // the property names inside your BaseUser entity.
      .leftJoinAndSelect('author.userProfile', 'up')
      .leftJoinAndSelect('author.brandProfile', 'bp')

      .where('fi.ownerId = :ownerId', { ownerId })
      .orderBy('fi.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    return qb.getManyAndCount();
  }

  // -----------------------------------
  // GLOBAL FEED
  // -----------------------------------
  async findGlobalPosts(limit: number, offset: number) {
    const qb = this.dataSource
      .getRepository(Post)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'author')
      .leftJoinAndSelect('author.userProfile', 'up')
      .leftJoinAndSelect('author.brandProfile', 'bp')
      .where('p.visibility = :visibility', {
        visibility: PostVisibility.PUBLIC,
      })
      .andWhere('p.deletedAt IS NULL')
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    return qb.getManyAndCount();
  }

  async deleteByPostId(postId: string): Promise<void> {
    await this.repository.delete({ postId });
  }

  async deleteByOwnerAndAuthor(ownerId: string, authorId: string): Promise<void> {
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