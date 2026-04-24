export class PostReactedEvent {
  constructor(
    public readonly likeId: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly postAuthorId: string,
    public readonly createdAt: Date,
  ) {}
}
