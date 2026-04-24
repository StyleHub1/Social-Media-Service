import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from '../entities/like.entity';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class LikeRepository {
  constructor(
    @InjectRepository(Like)
    private readonly repository: Repository<Like>,
  ) {}

  async createLike(userId: string, postId: string): Promise<Like> {
    const like = this.repository.create({ userId, postId });
    return await this.repository.save(like);
  }

  async deleteLike(userId: string, postId: string): Promise<void> {
    await this.repository.delete({ userId, postId });
  }

  async findByUserAndPost(
    userId: string,
    postId: string,
  ): Promise<Like | null> {
    return await this.repository.findOne({ where: { userId, postId } });
  }

  async findByPost(
    postId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Like>> {
    const [items, total] = await this.repository.findAndCount({
      where: { postId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, meta: { total, limit, offset } };
  }
}
