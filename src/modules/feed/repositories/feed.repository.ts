import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedItem } from '../entities/feed-item.entity';

@Injectable()
export class FeedRepository {
  constructor(
    @InjectRepository(FeedItem)
    private readonly repository: Repository<FeedItem>,
  ) {}
}
