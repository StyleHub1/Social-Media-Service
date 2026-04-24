import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedItem } from './entities/feed-item.entity';
import { FeedRepository } from './repositories/feed.repository';
import { FeedService } from './services/feed.service';
import { FeedController } from './controllers/feed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeedItem])],
  providers: [FeedService, FeedRepository],
  controllers: [FeedController],
  exports: [FeedService],
})
export class FeedModule {}
