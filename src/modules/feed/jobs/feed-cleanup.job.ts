import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FeedRepository } from '../repositories/feed.repository';

const RETENTION_DAYS = 30;

@Injectable()
export class FeedCleanupJob {
  private readonly logger = new Logger(FeedCleanupJob.name);

  constructor(private readonly feedRepository: FeedRepository) {}

  @Cron('0 3 * * *')
  async run(): Promise<void> {
    const before = new Date();
    before.setDate(before.getDate() - RETENTION_DAYS);

    try {
      const deleted = await this.feedRepository.deleteExpiredItems(before);
      this.logger.log(
        `Feed cleanup: deleted ${deleted} items older than ${RETENTION_DAYS} days`,
      );
    } catch (err) {
      this.logger.error(
        'Feed cleanup job failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
