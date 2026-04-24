import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './entities/follow.entity';
import { FollowRepository } from './repositories/follow.repository';
import { FollowService } from './services/follow.service';
import { FollowController } from './follow.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Follow]), AuthModule],
  providers: [FollowService, FollowRepository],
  controllers: [FollowController],
  exports: [FollowService],
})
export class FollowModule {}
