import { Role } from '@/modules/auth/entities/base-user.entity';
import {
  IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsEnum,
  IsNumber,
} from 'class-validator';
export class UserSearchResponseDto {
  @IsString()
  id: string;
  @IsEnum(Role)
  type: Role.USER;
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
  @IsString()
  firstName?: string;
  @IsString()
  lastName?: string;
  @IsNumber()
  score: number;
}