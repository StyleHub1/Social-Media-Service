import { IsUUID } from 'class-validator';

export class CreateFollowDto {
  @IsUUID()
  followingId: string;
}
