import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { BaseUser } from './base-user.entity';

@Entity('reset_tokens')
export class ResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column()
  baseUserId: string;

  @ManyToOne(() => BaseUser, (user) => user.resetTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'baseUserId' })
  baseUser: BaseUser;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}