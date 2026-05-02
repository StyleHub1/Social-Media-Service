import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedItem } from './entities/feed-item.entity';
import { FeedRepository } from './repositories/feed.repository';
import { FeedService } from './services/feed.service';
import { FeedController } from './controllers/feed.controller';
import { FeedEventListener } from './listeners/feed-event.listener';
import { FeedCleanupJob } from './jobs/feed-cleanup.job';

@Module({
  imports: [TypeOrmModule.forFeature([FeedItem])],
  providers: [FeedService, FeedRepository, FeedEventListener, FeedCleanupJob],
  controllers: [FeedController],
  exports: [FeedService],
})
export class FeedModule {}
