export class CommentCreatedEvent {
  constructor(
    public readonly commentId: string,
    public readonly authorId: string,
    public readonly postId: string,
    public readonly postAuthorId: string,
    public readonly content: string,
    public readonly createdAt: Date,
  ) {}
}
