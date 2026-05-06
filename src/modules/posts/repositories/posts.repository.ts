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
    const qb = this.repository
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .leftJoin('author.userProfile', 'userProfile')
      .leftJoin('author.brandProfile', 'brandProfile')
      .select([
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
      .addSelect('author.role')
      .addSelect([
        'userProfile.firstName',
        'userProfile.lastName',
        'userProfile.username',
        'userProfile.profileImageUrl',
      ])
      .addSelect([
        'brandProfile.brandName',
        'brandProfile.username',
        'brandProfile.profileImageUrl',
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
    return this.repository
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .leftJoin('author.userProfile', 'userProfile')
      .leftJoin('author.brandProfile', 'brandProfile')
      .select([
        'post.id',
        'post.content',
        'post.images',
        'post.videos',
        'post.visibility',
        'post.authorId',
        'post.reactionsCount',
        'post.commentsCount',
        'post.createdAt',
        'post.updatedAt',
      ])
      .addSelect('author.role')
      .addSelect([
        'userProfile.firstName',
        'userProfile.lastName',
        'userProfile.username',
        'userProfile.profileImageUrl',
      ])
      .addSelect([
        'brandProfile.brandName',
        'brandProfile.username',
        'brandProfile.profileImageUrl',
      ])
      .where('post.id = :id', { id })
      .andWhere('post.deletedAt IS NULL')
      .getOne();
  }

  async findByUser(
    authorId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Post>> {
    const qb = this.repository
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .leftJoin('author.userProfile', 'userProfile')
      .leftJoin('author.brandProfile', 'brandProfile')
      .select([
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
      .addSelect('author.role')
      .addSelect([
        'userProfile.firstName',
        'userProfile.lastName',
        'userProfile.username',
        'userProfile.profileImageUrl',
      ])
      .addSelect([
        'brandProfile.brandName',
        'brandProfile.username',
        'brandProfile.profileImageUrl',
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
