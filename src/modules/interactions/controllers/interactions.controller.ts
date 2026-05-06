import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InteractionsService } from '../services/interactions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../auth/interfaces/jwt.interface';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { GetInteractionsQueryDto } from '../dto/get-interactions-query.dto';

@Controller('interactions')
@Roles(Role.USER, Role.BRAND)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('reactions/:postId')
  react(
    @CurrentUser() user: JwtPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionsService.react(user.sub, user.role, postId);
  }

  @Delete('reactions/:postId')
  unreact(
    @CurrentUser() user: JwtPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionsService.unreact(user.sub, user.role, postId);
  }

  @Get('reactions/:postId/status')
  checkReactionStatus(
    @CurrentUser() user: JwtPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionsService.checkReactionStatus(user.sub, postId);
  }

  @Get('reactions/:postId')
  getPostReactions(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: GetInteractionsQueryDto,
  ) {
    return this.interactionsService.getPostReactions(postId, query);
  }

  @Post('comments')
  addComment(@CurrentUser() user: JwtPayload, @Body() dto: CreateCommentDto) {
    return this.interactionsService.addComment(user.sub, user.role, dto);
  }

  @Patch('comments/:commentId')
  updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.interactionsService.updateComment(user.sub, commentId, dto);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.interactionsService.deleteComment(user.sub, commentId);
  }

  @Get('comments/:postId')
  getPostComments(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: GetInteractionsQueryDto,
  ) {
    return this.interactionsService.getPostComments(postId, query);
  }
}
