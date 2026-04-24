import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity('comments')
@Index(['postId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  authorId: string;

  @Index()
  @Column()
  postId: string;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: BaseUser;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
