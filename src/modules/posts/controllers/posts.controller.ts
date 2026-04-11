import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PostsService } from '../services/posts.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { QueryPostsDto } from '../dto/query-posts.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Public } from '../../common/decorators/public.decorator';

@Controller('posts')
@Roles(Role.USER, Role.BRAND)

export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 5 },
      { name: 'videos', maxCount: 3 },
    ]),
  )
  async createPost(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    },
  ) {
    return this.postsService.createPost(user.sub, dto, files);
  }

  @Get()
  @Public()
  async getAllPosts(@Query() query: QueryPostsDto) {
    return this.postsService.getAllPosts(query);
  }

  @Get('me')
  async getMyPosts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPostsDto,
  ) {
    return this.postsService.getPostsByUser(user.sub, query);
  }

  @Get('user/:userId')
  async getPostsByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryPostsDto,
  ) {
    return this.postsService.getPostsByUser(userId, query);
  }

  @Get(':id')
  async getPostById(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.getPostById(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 5 },
      { name: 'videos', maxCount: 3 },
    ]),
  )
  async updatePost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.postsService.deletePost(user.sub, id);
  }
}