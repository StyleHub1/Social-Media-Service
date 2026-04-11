import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostsRepository } from '../repositories/posts.repository';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { QueryPostsDto } from '../dto/query-posts.dto';
import { Post, PostVisibility } from '../entities/post.entity';
import { PostCreatedEvent } from '../events/post-created.event';
import { PostUpdatedEvent } from '../events/post-updated.event';
import { PostDeletedEvent } from '../events/post-deleted.event';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPost(
    authorId: string,
    dto: CreatePostDto,
    files: any
  ): Promise<Post> {
    const hasContent = dto.content && dto.content.trim().length > 0;
    const hasImages = files?.images?.length > 0;
    const hasVideos = files?.videos?.length > 0;

    if (!hasContent && !hasImages && !hasVideos) {
      throw new BadRequestException(
        'A post must have at least content, an image, or a video',
      );
    }

    const uploadedImageUrls = await this.uploadFiles(files?.images, 'Posts/images');
    const uploadedVideoUrls = await this.uploadFiles(files?.videos, 'Posts/videos');

    const post = await this.postsRepository.create({
      authorId,
      content: dto.content ?? null,
      images: uploadedImageUrls,
      videos: uploadedVideoUrls,
      visibility: dto.visibility ?? PostVisibility.PUBLIC,
    });

    this.eventEmitter.emit('post.created', new PostCreatedEvent(post, authorId));

    return post;
  }

  async getAllPosts(query: QueryPostsDto): Promise<PaginationResponse<Post>> {
    const { limit, offset } = query;
    return await this.postsRepository.findAll(limit, offset);
  }

  async getPostById(id: string): Promise<Post> {
    const post = await this.postsRepository.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async updatePost(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.getPostById(postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You are not allowed to update this post');
    }

    Object.assign(post, dto);

    const updated = await this.postsRepository.update(post);

    this.eventEmitter.emit('post.updated', new PostUpdatedEvent(updated, userId));

    return updated;
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.getPostById(postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You are not allowed to delete this post');
    }

    await this.postsRepository.softDelete(postId);

    this.eventEmitter.emit('post.deleted', new PostDeletedEvent(postId, userId));
  }

  async getPostsByUser(
    userId: string,
    query: QueryPostsDto,
  ): Promise<PaginationResponse<Post>> {
    const { limit, offset } = query;
    return await this.postsRepository.findByUser(userId, limit, offset);
  }

  private async uploadFiles(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const uploads = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadFile(file, folder)),
    );
    return uploads.map((result) => result.secure_url);
  }
}
