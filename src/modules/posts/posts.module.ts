import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostsRepository } from './repositories/posts.repository';
import { PostsService } from './services/posts.service';
import { PostsController } from './controllers/posts.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), CloudinaryModule],
  providers: [PostsService, PostsRepository],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
