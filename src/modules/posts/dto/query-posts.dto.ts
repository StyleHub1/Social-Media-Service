import { IsEnum, IsOptional } from 'class-validator';
import { PaginationParams } from '../../common/pagination/pagination.params';
import { PostVisibility } from '../entities/post.entity';

export class QueryPostsDto extends PaginationParams {
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;
}
