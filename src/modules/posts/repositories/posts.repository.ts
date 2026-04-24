import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class PostsRepository {
  constructor(
    @InjectRepository(Post)
    private readonly repository: Repository<Post>,
  ) {}

  async create(data: Partial<Post>): Promise<Post> {
    const post = this.repository.create(data);
    return await this.repository.save(post);
  }

  async findAll(
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Post>> {
    const qb = this.repository.createQueryBuilder('post');

    qb.select([
      'post.id',
      'post.content',
      'post.images',
      'post.reactionsCount',
      'post.commentsCount',
      'post.videos',
      'post.visibility',
      'post.authorId',
      'post.createdAt',
    ])
      .where('post.deletedAt IS NULL')
      .andWhere('post.visibility = :visibility', { visibility: 'PUBLIC' })
      .orderBy('post.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [items, total] = await qb.getManyAndCount();

    return { items, meta: { total, limit, offset } };
  }

  async findById(id: string): Promise<Post | null> {
    const qb = this.repository.createQueryBuilder('post');

    qb.where('post.id = :id', { id })
      .andWhere('post.deletedAt IS NULL');

    return await qb.getOne();
  }

  async findByUser(
    authorId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Post>> {
    const qb = this.repository.createQueryBuilder('post');

    qb.select([
      'post.id',
      'post.content',
      'post.images',
      'post.videos',
      'post.visibility',
      'post.authorId',
      'post.createdAt',
      'post.reactionsCount',
      'post.commentsCount',
    ])
      .where('post.authorId = :authorId', { authorId })
      .andWhere('post.deletedAt IS NULL')
      .orderBy('post.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [items, total] = await qb.getManyAndCount();

    return { items, meta: { total, limit, offset } };
  }

  async update(post: Post): Promise<Post> {
    return await this.repository.save(post);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}