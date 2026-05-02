import { Post } from '../entities/post.entity';

export class PostCreatedEvent {
  constructor(
    public readonly post: Post,
    public readonly authorId: string,
    public readonly createdAt: Date,
  ) {}
}
