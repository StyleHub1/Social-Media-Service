import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { LikeRepository } from './repositories/like.repository';
import { CommentRepository } from './repositories/comment.repository';
import { InteractionsService } from './services/interactions.service';
import { InteractionsController } from './controllers/interactions.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Comment]), PostsModule],
  providers: [InteractionsService, LikeRepository, CommentRepository],
  controllers: [InteractionsController],
  exports: [InteractionsService],
})
export class InteractionsModule {}
