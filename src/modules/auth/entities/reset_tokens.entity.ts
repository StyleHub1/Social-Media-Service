import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Entity("ResetTokens")
export class ResetToken {
  @PrimaryGeneratedColumn('uuid')
  @Index({ unique: true })
  id: string;

  @Column()
  @Index({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role;

  @Column()
  token: string; // The 6-digit token

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}