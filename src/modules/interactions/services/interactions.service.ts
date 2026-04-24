import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { LikeRepository } from '../repositories/like.repository';
import { CommentRepository } from '../repositories/comment.repository';
import { PostsService } from '../../posts/services/posts.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { GetInteractionsQueryDto } from '../dto/get-interactions-query.dto';
import { Like } from '../entities/like.entity';
import { Comment } from '../entities/comment.entity';
import { Post } from '../../posts/entities/post.entity';
import { Role } from '../../common/enums/role.enum';
import { PostReactedEvent } from '../events/post-reacted.event';
import { PostUnreactedEvent } from '../events/post-unreacted.event';
import { CommentCreatedEvent } from '../events/comment-created.event';
import { CommentDeletedEvent } from '../events/comment-deleted.event';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class InteractionsService {
  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly commentRepository: CommentRepository,
    private readonly postsService: PostsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async react(userId: string, userRole: Role, postId: string): Promise<Like> {
    const post = await this.postsService.getPostById(postId);
    this.assertCanInteract(userId, userRole, post);

    const existing = await this.likeRepository.findByUserAndPost(
      userId,
      postId,
    );
    if (existing) {
      throw new ConflictException('You have already reacted to this post');
    }

    let like!: Like;
    await this.dataSource.transaction(async (manager) => {// Transaction ensures that like creation and post reaction count increment happen atomically, preventing data inconsistencies in case of errors during either operation. 
      like = manager.create(Like, { userId, postId });
      like = await manager.save(like);
      await manager.increment(Post, { id: postId }, 'reactionsCount', 1);
    });

    this.eventEmitter.emit(
      'post.reacted',
      new PostReactedEvent(
        like.id,
        userId,
        postId,
        post.authorId,
        like.createdAt,
      ),
    );

    return like;
  }

  async unreact(userId: string, userRole: Role, postId: string): Promise<void> {
    const post = await this.postsService.getPostById(postId);
    this.assertCanInteract(userId, userRole, post);

    const existing = await this.likeRepository.findByUserAndPost(
      userId,
      postId,
    );
    if (!existing) {
      throw new NotFoundException('Reaction not found');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Like, { userId, postId });
      await manager.decrement(Post, { id: postId }, 'reactionsCount', 1);
    });

    this.eventEmitter.emit(
      'post.unreacted',
      new PostUnreactedEvent(userId, postId, post.authorId),
    );
  }

  async getPostReactions(
    postId: string,
    query: GetInteractionsQueryDto,
  ): Promise<PaginationResponse<Like>> {
    await this.postsService.getPostById(postId);
    return this.likeRepository.findByPost(postId, query.limit, query.offset);
  }

  async addComment(
    authorId: string,
    userRole: Role,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.postsService.getPostById(dto.postId);
    this.assertCanInteract(authorId, userRole, post);

    let comment!: Comment;
    await this.dataSource.transaction(async (manager) => {
      comment = manager.create(Comment, {
        authorId,
        postId: dto.postId,
        content: dto.content,
      });
      comment = await manager.save(comment);
      await manager.increment(Post, { id: dto.postId }, 'commentsCount', 1);
    });

    this.eventEmitter.emit(
      'comment.created',
      new CommentCreatedEvent(
        comment.id,
        authorId,
        dto.postId,
        post.authorId,
        dto.content,
        comment.createdAt,
      ),
    );

    return comment;
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findCommentOrFail(commentId);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You are not allowed to edit this comment');
    }

    return this.commentRepository.updateComment(comment, dto.content);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.findCommentOrFail(commentId);
    const post = await this.postsService.getPostById(comment.postId);

    const isAuthor = comment.authorId === userId;
    const isPostOwner = post.authorId === userId;

    if (!isAuthor && !isPostOwner) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.softDelete(Comment, { id: commentId });
      await manager.decrement(Post, { id: comment.postId }, 'commentsCount', 1);
    });

    this.eventEmitter.emit(
      'comment.deleted',
      new CommentDeletedEvent(
        commentId,
        comment.authorId,
        comment.postId,
        post.authorId,
      ),
    );
  }

  async getPostComments(
    postId: string,
    query: GetInteractionsQueryDto,
  ): Promise<PaginationResponse<Comment>> {
    await this.postsService.getPostById(postId);
    return this.commentRepository.findByPost(postId, query.limit, query.offset);
  }

  private assertCanInteract(userId: string, userRole: Role, post: Post): void {
    if (userRole === Role.BRAND && post.authorId !== userId) {
      throw new ForbiddenException(
        'Brands can only interact with their own posts',
      );
    }
  }

  private async findCommentOrFail(commentId: string): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}
