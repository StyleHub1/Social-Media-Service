import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { FollowRepository } from '../repositories/follow.repository';
import { Follow } from '../entities/follow.entity';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { BaseUsersService } from '../../auth/services/base-user.service';
import {
  FollowResponseDto,
  FollowAccountDto,
} from '../dto/follow-response.dto';
import { UserFollowedEvent } from '../events/user-followed.event';
import { UserUnfollowedEvent } from '../events/user-unfollowed.event';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name);

  constructor(
    private readonly followRepository: FollowRepository,
    private readonly baseUsersService: BaseUsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async follow(
    followerId: string,
    followingId: string,
  ): Promise<FollowResponseDto> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    await this.baseUsersService.findById(followingId);

    this.logger.log(`User ${followerId} attempting to follow ${followingId}`);

    let follow: Follow;
    try {
      follow = await this.dataSource.transaction(async (manager) => {
        const entity = manager.create(Follow, { followerId, followingId });
        const saved = await manager.save(entity);
        await manager.increment(
          BaseUser,
          { id: followingId },
          'followersCount',
          1,
        );
        await manager.increment(
          BaseUser,
          { id: followerId },
          'followingCount',
          1,
        );
        return saved;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('You are already following this account');
      }
      throw error;
    }

    this.eventEmitter.emit(
      'follow.followed',
      new UserFollowedEvent(
        follow.id,
        followerId,
        followingId,
        follow.createdAt,
      ),
    );

    this.logger.log(`User ${followerId} now follows ${followingId}`);

    return {
      id: follow.id,
      followerId: follow.followerId,
      followingId: follow.followingId,
      status: follow.status,
      createdAt: follow.createdAt,
    };
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.followRepository.findByFollowerAndFollowing(
      followerId,
      followingId,
    );

    if (!existing) {
      throw new NotFoundException('You are not following this account');
    }

    this.logger.log(`User ${followerId} unfollow ${followingId}`);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Follow, { followerId, followingId });
      await manager.increment(
        BaseUser,
        { id: followingId },
        'followersCount',
        -1,
      );
      await manager.increment(
        BaseUser,
        { id: followerId },
        'followingCount',
        -1,
      );
    });

    this.eventEmitter.emit(
      'follow.unfollowed',
      new UserUnfollowedEvent(followerId, followingId),
    );

    this.logger.log(`User ${followerId} unfollowed ${followingId}`);
  }

  async getFollowers(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<FollowAccountDto>> {
    this.logger.log(`Fetching followers for user ${userId}`);
    return await this.followRepository.findFollowers(userId, limit, offset);
  }

  async getFollowing(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<FollowAccountDto>> {
    this.logger.log(`Fetching following list for user ${userId}`);
    return await this.followRepository.findFollowing(userId, limit, offset);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followRepository.findByFollowerAndFollowing(
      followerId,
      followingId,
    );
    return follow !== null;
  }
}
