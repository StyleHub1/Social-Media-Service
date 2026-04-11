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

export enum PostVisibility {
  PUBLIC = 'PUBLIC',
  FOLLOWERS = 'FOLLOWERS',
  PRIVATE = 'PRIVATE',
}

@Entity('posts')
@Index(['authorId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', array: true, default: [] })
  images: string[];

  @Column({ type: 'text', array: true, default: [] })
  videos: string[];

  @Index()
  @Column()
  authorId: string;

  @Column({ type: 'enum', enum: PostVisibility, default: PostVisibility.PUBLIC })
  visibility: PostVisibility;

  @ManyToOne(() => BaseUser, (baseUser) => baseUser.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: BaseUser;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
