import { Role } from 'src/modules/common/enums/role.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { UserStatus } from '../enums/user-status.enum';
import { Gender } from '../enums/user-gender';
import { Exclude, Expose } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @Expose()//
  id: string;

  // Authentication Fields
  @Index({ unique: true })// Ensure email uniqueness at the database level
  @Column({ length: 255 })
  @Expose() // Expose email in serialization to allow API responses to include it
  email: string;

  @Column({ select: false })// Exclude password from query results by default
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })                        // Define user roles with a default of 'USER'
  @Expose() // Expose role in serialization to allow API responses to include it
  role: Role;

  @Column({ default: false })// Indicates whether the user's email has been verified
  @Expose() // Expose email verification status in serialization to allow API responses to include it
  isEmailVerified: boolean;

  @Column({ nullable: true, select: false })// Store the refresh token for session management, excluded from query results by default
  @Expose()
  refreshToken?: string;

  // Profile Fields
  @Column({ length: 100, nullable: true }) //
  @Expose() // Expose firstName in serialization to allow API responses to include it
  firstName?: string;

  @Column({ length: 100, nullable: true })
  @Expose() // Expose lastName in serialization to allow API responses to include it
  lastName?: string;
  
  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  @Expose()
  gender?: Gender;

  @Index({ unique: true })
  @Column({ length: 100 })
  @Expose()
  username: string;

  @Column({ nullable: true })
  @Expose()
  phoneNumber?: string;

  @Column({ nullable: true })
  @Expose()
  bio?: string;

  @Column({ nullable: true })
  @Expose()
  profileImageUrl?: string;

  // Status & Control
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  @Expose()
  status: UserStatus;

  @Column({ nullable: true })// Store the date and time of the user's last login
  @Expose()
  lastLogin?: Date;

  // Audit Fields
  @CreateDateColumn()
  @Expose()
  createdAt: Date;

  @UpdateDateColumn()
  @Expose()
  updatedAt: Date;

  @DeleteDateColumn()
  @Expose()
  deletedAt?: Date;
}

