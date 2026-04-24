import { FollowStatus } from '../enums/follow-status.enum';

export class FollowResponseDto {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: Date;
}

export class FollowAccountDto {
  id: string;
  username: string | null;
  profileImageUrl: string | null;
}
