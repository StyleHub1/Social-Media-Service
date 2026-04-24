import { FeedItemType } from '../enums/feed-item-type.enum';

export class FeedResponseDto {
  id: string;
  ownerId: string;
  postId: string;
  type: FeedItemType;
  createdAt: Date;
}
