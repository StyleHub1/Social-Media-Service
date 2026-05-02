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
    if (items.length === 0) return;

    const chunks: BulkFeedItem[][] = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
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
      `SELECT "followerId" FROM "follows"
       WHERE "followingId" = $1 AND "status" = 'ACTIVE'`,
      [authorId],
    );
    return rows.map((r) => r.followerId);
  }

  async getRecentPostsByAuthor(
    authorId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]> {
    return this.dataSource.query(
      `SELECT id, "createdAt" FROM "posts"
       WHERE "authorId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [authorId, limit],
    );
  }

  async findFeed(
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<[FeedItem[], number]> {
    return this.repository
      .createQueryBuilder('fi')
      .innerJoinAndSelect('fi.post', 'p', 'p.deletedAt IS NULL')
      .where('fi.ownerId = :ownerId', { ownerId })
      .orderBy('fi.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
  }

  async findGlobalPosts(
    limit: number,
    offset: number,
  ): Promise<[Post[], number]> {
    return this.dataSource
      .getRepository(Post)
      .createQueryBuilder('p')
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
