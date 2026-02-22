import { Role } from '../../common/enums/role.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BrandStatus } from '../enums/brand-status.enum';
import { Expose } from 'class-transformer';
import { RefreshToken } from '../../auth/entities/refresh_tokens.entity';

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  // ----------------------------
  // Authentication Fields
  // ----------------------------
  @Index({ unique: true })
  @Column({ length: 255 })
  @Expose()
  email: string;

  @Column({ select: false })
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.BRAND,
  })
  @Expose()
  role: Role;

  @Column({ default: false })
  @Expose()
  isEmailVerified: boolean;

  // ----------------------------
  // Brand Profile Fields
  // ----------------------------
  @Column({ length: 255 })
  @Expose()
  brandName: string;

  @Index({ unique: true })
  @Column({ length: 100 })
  @Expose()
  username: string;

  @Column({ length: 255, nullable: true })
  @Expose()
  websiteUrl?: string;

  @Column({ nullable: true })
  @Expose()
  bio?: string;

  @Column({ nullable: true })
  @Expose()
  profileImageUrl?: string;

  @Column({ nullable: true })
  @Expose()
  phoneNumber?: string;

  // ----------------------------
  // Status & Control
  // ----------------------------
  @Column({
    type: 'enum',
    enum: BrandStatus,
    default: BrandStatus.PENDING_VERIFICATION,
  })
  @Expose()
  status: BrandStatus;

  @Column({ default: false })
  @Expose()
  isVerified: boolean; // for official brand verification

  // ----------------------------
  // Audit Fields
  // ----------------------------
  @CreateDateColumn()
  @Expose()
  createdAt: Date;

  @UpdateDateColumn()
  @Expose()
  updatedAt: Date;

  @DeleteDateColumn()
  @Expose()
  deletedAt?: Date;

  @OneToMany(() => RefreshToken, (token) => token.brand)
  refreshTokens: RefreshToken[];  
}