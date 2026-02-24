import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Gender } from '../enums/user-gender';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ type: 'enum', enum: Gender})
  gender: Gender;

  @Column({ nullable: true })
  profileImageUrl: string;

  @Column({ default: 'PENDING_VERIFICATION' })
  status: string;

  @OneToOne(() => BaseUser, (baseUser) => baseUser.userProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'baseUserId' })
  baseUser: BaseUser;

  @Column({ unique: true })
  baseUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}