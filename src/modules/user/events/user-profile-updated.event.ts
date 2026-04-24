export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly username?: string,
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly bio?: string,
    public readonly profileImageUrl?: string,
    public readonly gender?: string,
    public readonly phoneNumber?: string
  ) {}
}