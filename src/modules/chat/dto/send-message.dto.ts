import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Used on POST /chat/messages (initiates or reuses a conversation) */
export class SendDirectMessageDto {
  @IsUUID()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

/** Used on POST /chat/conversations/:id/messages (conversation already exists) */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
