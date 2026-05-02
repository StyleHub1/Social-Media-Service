export class BrandProfileDeletedEvent {
  constructor(
    public readonly brandId: string,
    public readonly username: string,
  ) {}
}
