import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  ArrayMaxSize,
} from 'class-validator';
import { PostVisibility } from '../entities/post.entity';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;
}
