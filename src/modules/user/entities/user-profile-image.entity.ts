import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { UserProfile } from './user-profile.entity';

@Entity('user_profile_images')
export class UserProfileImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => UserProfile, (user) => user.profileImage, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userProfileId' })
  userProfile: UserProfile;

  @Column({ type: 'bytea', nullable: true }) // store image as binary
  imageData?: Buffer;

  @Column({ nullable: true })
  mimeType?: string; // store file type: image/png, image/jpeg

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}