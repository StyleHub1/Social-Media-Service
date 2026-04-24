export class UserRegisteredEvent {
  constructor(
    public readonly email: string,
    public readonly verificationToken: string,
    public readonly name: string,
  ) {}
}
