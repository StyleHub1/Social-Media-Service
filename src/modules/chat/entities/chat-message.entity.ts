import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseUser } from '../../auth/entities/base-user.entity';
import { Conversation } from './conversation.entity';
import { MessageStatus } from '../enums/message-status.enum';

@Entity('chat_messages')
@Index(['conversationId', 'createdAt', 'id'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({ type: 'timestamp', nullable: true })
  seenAt: Date | null;

  @ManyToOne(() => Conversation, (conv) => conv.messages, {
    onDelete: 'CASCADE',
  })
  conversation: Conversation;

  @ManyToOne(() => BaseUser, { onDelete: 'CASCADE' })
  sender: BaseUser;

  @CreateDateColumn()
  createdAt: Date;
}
