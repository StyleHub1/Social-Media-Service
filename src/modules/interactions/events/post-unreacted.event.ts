export class PostUnreactedEvent {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
    public readonly postAuthorId: string,
  ) {}
}
