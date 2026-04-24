import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class CommentRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repository: Repository<Comment>,
  ) {}

  async createComment(
    authorId: string,
    postId: string,
    content: string,
  ): Promise<Comment> {
    const comment = this.repository.create({ authorId, postId, content });
    return await this.repository.save(comment);
  }

  async findById(id: string): Promise<Comment | null> {
    return await this.repository.findOne({
      where: { id, deletedAt: null as any },
    });
  }

  async updateComment(comment: Comment, content: string): Promise<Comment> {
    comment.content = content;
    return await this.repository.save(comment);
  }

  async softDeleteComment(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  async findByPost(
    postId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Comment>> {
    const [items, total] = await this.repository.findAndCount({
      where: { postId },
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { items, meta: { total, limit, offset } };
  }
}
