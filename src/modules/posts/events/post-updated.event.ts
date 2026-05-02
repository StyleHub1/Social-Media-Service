import { Post } from '../entities/post.entity';

export class PostUpdatedEvent {
  constructor(
    public readonly post: Post,
    public readonly authorId: string,
    public readonly updatedAt: Date,
  ) {}
}
