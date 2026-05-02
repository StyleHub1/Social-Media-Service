export class UserProfileCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phoneNumber: string,
    public readonly bio?: string,
    public readonly gender?: string,
  ) {}
}
