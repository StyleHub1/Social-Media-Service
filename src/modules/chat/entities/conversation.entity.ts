import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('conversations')
@Unique('UQ_conversations_participants', ['participantA', 'participantB'])
@Index(['participantA', 'lastMessageAt'])
@Index(['participantB', 'lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Always the lexicographically smaller of the two participant UUIDs.
   * Enforced by the service layer before every insert.
   */
  @Column({ type: 'uuid' })
  participantA: string;

  /**
   * Always the lexicographically larger of the two participant UUIDs.
   */
  @Column({ type: 'uuid' })
  participantB: string;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })

  @JoinColumn({ name: 'participantA' })

  userA: BaseUser;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })

  @JoinColumn({ name: 'participantB' })

  userB: BaseUser;

  @OneToMany(() => ChatMessage, (msg) => msg.conversation)
  messages: ChatMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
