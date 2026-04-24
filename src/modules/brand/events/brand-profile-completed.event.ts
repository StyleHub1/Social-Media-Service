export class BrandProfileCompletedEvent {
  constructor(
    public readonly brandId: string,
    public readonly brandName: string,
    public readonly username: string,
    public readonly bio: string,
    public readonly websiteUrl: string
  ) {}
}

