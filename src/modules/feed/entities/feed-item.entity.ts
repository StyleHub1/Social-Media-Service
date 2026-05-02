import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Post } from '../../posts/entities/post.entity';
import { FeedItemType } from '../enums/feed-item-type.enum';

@Entity('feed_items')
@Index(['ownerId', 'createdAt'])
@Index(['ownerId', 'authorId'])
@Index('IDX_feed_items_postId', ['postId'])
@Unique(['ownerId', 'postId'])
export class FeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  postId: string;

  @Column()
  authorId: string;

  @Column({ type: 'enum', enum: FeedItemType, default: FeedItemType.POST })
  type: FeedItemType;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: BaseUser;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: BaseUser;

  @CreateDateColumn()
  createdAt: Date;
}
