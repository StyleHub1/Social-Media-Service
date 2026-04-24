export class UserProfileDeletedEvent {
  constructor(
    public readonly userId: string,
    public readonly username: string
  ) {}
}