import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Post } from '../../posts/entities/post.entity';
import { FeedItemType } from '../enums/feed-item-type.enum';

@Entity('feed_items')
@Index(['ownerId', 'createdAt'])
export class FeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  ownerId: string;

  @Column()
  postId: string;

  @Column({ type: 'enum', enum: FeedItemType, default: FeedItemType.POST })
  type: FeedItemType;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: BaseUser;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
