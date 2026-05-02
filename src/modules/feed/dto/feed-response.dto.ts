import { FeedItemType } from '../enums/feed-item-type.enum';
import { PostVisibility } from '../../posts/entities/post.entity';

export class FeedPostDto {
  id: string;
  content: string | null;
  images: string[];
  videos: string[];
  authorId: string;
  visibility: PostVisibility;
  reactionsCount: number;
  commentsCount: number;
  createdAt: Date;
}

export class FeedItemResponseDto {
  id: string;
  type: FeedItemType;
  createdAt: Date;
  post: FeedPostDto;
}
