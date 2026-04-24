export class UserFollowedEvent {
  constructor(
    public readonly followId: string,
    public readonly followerId: string,
    public readonly followingId: string,
    public readonly createdAt: Date,
  ) {}
}
