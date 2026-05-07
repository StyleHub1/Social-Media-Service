import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { FollowService } from './services/follow.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt.interface';
import { CreateFollowDto } from './dto/create-follow.dto';
import { GetFollowsQueryDto } from './dto/get-follows-query.dto';

@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post()
  @Roles(Role.USER)
  @HttpCode(HttpStatus.CREATED)
  async follow(@CurrentUser() user: JwtPayload, @Body() body: CreateFollowDto) {
    return await this.followService.follow(user.sub, body.followingId);
  }

  @Delete(':followingId')
  @Roles(Role.USER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @CurrentUser() user: JwtPayload,
    @Param('followingId', ParseUUIDPipe) followingId: string,
  ) {
    await this.followService.unfollow(user.sub, followingId);
  }

  @Get('followers')
  @Roles(Role.USER, Role.BRAND)
  async getMyFollowers(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetFollowsQueryDto,
  ) {
    return await this.followService.getFollowers(
      user.sub,
      query.limit,
      query.offset,
    );
  }

  @Get('following')
  @Roles(Role.USER, Role.BRAND)
  async getMyFollowing(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetFollowsQueryDto,
  ) {
    return await this.followService.getFollowing(
      user.sub,
      query.limit,
      query.offset,
    );
  }

  @Get(':userId/followers')
  @Roles(Role.USER, Role.BRAND)
  async getUserFollowers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetFollowsQueryDto,
  ) {
    return await this.followService.getFollowers(
      userId,
      query.limit,
      query.offset,
    );
  }

  @Get(':userId/following')
  @Roles(Role.USER, Role.BRAND)
  async getUserFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetFollowsQueryDto,
  ) {
    return await this.followService.getFollowing(
      userId,
      query.limit,
      query.offset,
    );
  }

  @Get('status/:followingId')
  @Roles(Role.USER, Role.BRAND)
  async getFollowStatus(
    @CurrentUser() user: JwtPayload,
    @Param('followingId', ParseUUIDPipe) followingId: string,
  ) {
    const isFollowing = await this.followService.isFollowing(
      user.sub,
      followingId,
    );
    return { isFollowing };
  }
}
