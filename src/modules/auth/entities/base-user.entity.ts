import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserProfile } from '../../user/entities/user-profile.entity';
import { BrandProfile } from '../../brand/entities/brand-profile.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { ResetToken } from '../entities/reset-token.entity';

export enum Role {
  USER = 'USER',
  BRAND = 'BRAND',
  ADMIN = 'ADMIN',
}

@Entity('base_users')
export class BaseUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  followersCount: number;

  @Column({ default: 0 })
  followingCount: number;

  @Column({ default: 0 })
  postsCount: number;

  @OneToOne(() => UserProfile, (profile) => profile.baseUser)
  userProfile: UserProfile;

  @OneToOne(() => BrandProfile, (profile) => profile.baseUser)
  brandProfile: BrandProfile;

  @OneToMany(() => RefreshToken, (token) => token.baseUser)
  refreshTokens: RefreshToken[];

  @OneToMany(() => ResetToken, (token) => token.baseUser)
  resetTokens: ResetToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}