import { Role } from '@/modules/auth/entities/base-user.entity';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Gender } from 'src/modules/user/enums/user-gender';
export class UserProfileDto {
  @IsString()
  id: string;
  @IsEnum(Role)
  type: Role.USER;
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsString()
  firstName?: string;

  @IsString()
  lastName?: string;

  @IsString()
  phoneNumber?: string;

  @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
  gender?: Gender;

  @IsNumber()
  numberOfFollowers?: number;

  @IsNumber()
  numberOfFollowing?: number;

  @IsNumber()
  numberOfPosts?: number;

  @IsNumber()
  score?: number; // Optional score field for search results
}
