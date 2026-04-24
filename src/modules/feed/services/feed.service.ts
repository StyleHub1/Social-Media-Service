import { Injectable } from '@nestjs/common';
import { FeedRepository } from '../repositories/feed.repository';

@Injectable()
export class FeedService {
  constructor(private readonly feedRepository: FeedRepository) {}
}
