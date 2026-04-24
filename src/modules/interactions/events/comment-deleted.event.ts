export class CommentDeletedEvent {
  constructor(
    public readonly commentId: string,
    public readonly authorId: string,
    public readonly postId: string,
    public readonly postAuthorId: string,
  ) {}
}
