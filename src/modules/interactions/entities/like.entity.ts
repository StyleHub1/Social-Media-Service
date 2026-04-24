import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity('likes')
@Unique(['userId', 'postId'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  postId: string;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: BaseUser;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
