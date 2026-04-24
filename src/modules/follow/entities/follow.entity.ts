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
import { FollowStatus } from '../enums/follow-status.enum';

@Entity('follows')
@Unique(['followerId', 'followingId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  followerId: string;

  @Index()
  @Column()
  followingId: string;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId' })
  follower: BaseUser;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId' })
  following: BaseUser;

  @Column({ type: 'enum', enum: FollowStatus, default: FollowStatus.ACTIVE })
  status: FollowStatus;

  @CreateDateColumn()
  createdAt: Date;
}
