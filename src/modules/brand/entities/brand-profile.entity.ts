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

@Entity('brand_profiles')
export class BrandProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  brandName: string;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  websiteUrl: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  profileImageUrl: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: 'PENDING_VERIFICATION' })
  status: string;

  @OneToOne(() => BaseUser, (baseUser) => baseUser.brandProfile, {
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
