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
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notifications')
@Index(['recipientId', 'createdAt'])
@Index(['recipientId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipientId: string;

  @Column({ nullable: true, type: 'uuid' })
  actorId: string | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ nullable: true, type: 'uuid' })
  postId: string | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  readAt: Date | null;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient: BaseUser;

  @ManyToOne(() => BaseUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: BaseUser | null;

  @ManyToOne(() => Post, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'postId' })
  post: Post | null;

  @CreateDateColumn()
  createdAt: Date;
}
