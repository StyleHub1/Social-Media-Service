import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from '../entities/follow.entity';
import { PaginationResponse } from '../../common/pagination/pagination.response';
import { FollowAccountDto } from '../dto/follow-response.dto';

@Injectable()
export class FollowRepository {
  constructor(
    @InjectRepository(Follow)
    private readonly repository: Repository<Follow>,
  ) {}

  async create(followerId: string, followingId: string): Promise<Follow> {
    const follow = this.repository.create({ followerId, followingId });
    return await this.repository.save(follow);
  }

  async findByFollowerAndFollowing(
    followerId: string,
    followingId: string,
  ): Promise<Follow | null> {
    return await this.repository
      .createQueryBuilder('follow')
      .where('follow.followerId = :followerId', { followerId })
      .andWhere('follow.followingId = :followingId', { followingId })
      .getOne();
  }

  async delete(followerId: string, followingId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(Follow)
      .where('followerId = :followerId', { followerId })
      .andWhere('followingId = :followingId', { followingId })
      .execute();
  }

  async findFollowers(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<FollowAccountDto>> {
    const qb = this.repository
      .createQueryBuilder('follow')
      .innerJoin('follow.follower', 'follower')
      .leftJoin('follower.userProfile', 'userProfile')
      .select([
        'follow.followerId AS id',
        'userProfile.username AS username',
        'userProfile.profileImageUrl AS "profileImageUrl"',
      ])
      .where('follow.followingId = :userId', { userId })
      .orderBy('follow.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    const [raw, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const items: FollowAccountDto[] = raw.map((r) => ({
      id: r.id,
      username: r.username ?? null,
      profileImageUrl: r.profileImageUrl ?? null,
    }));

    return { items, meta: { total, limit, offset } };
  }

  async findFollowing(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<FollowAccountDto>> {
    const qb = this.repository
      .createQueryBuilder('follow')
      .innerJoin('follow.following', 'following')
      .leftJoin('following.userProfile', 'userProfile')
      .leftJoin('following.brandProfile', 'brandProfile')
      .select([
        'follow.followingId AS id',
        'COALESCE(userProfile.username, brandProfile.username) AS username',
        'COALESCE(userProfile.profileImageUrl, brandProfile.profileImageUrl) AS "profileImageUrl"',
      ])
      .where('follow.followerId = :userId', { userId })
      .orderBy('follow.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    const [raw, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const items: FollowAccountDto[] = raw.map((r) => ({
      id: r.id,
      username: r.username ?? null,
      profileImageUrl: r.profileImageUrl ?? null,
    }));

    return { items, meta: { total, limit, offset } };
  }
}
