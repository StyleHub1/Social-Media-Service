export class BrandProfileUpdatedEvent {
  constructor(
    public readonly brandId?: string,
    public readonly email?: string,
    public readonly brandName?: string,
    public readonly username?: string,
    public readonly bio?: string,
    public readonly websiteUrl?: string,
    public readonly profileImageUrl?: string,
  ) {}
}
