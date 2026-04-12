export class PostDeletedEvent {
  constructor(
    public readonly postId: string,
    public readonly authorId: string,
  ) {}
}
