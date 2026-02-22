import {
  IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsEnum, IsUrl, ValidateIf, 
  Matches,
  IsNumber
} from 'class-validator';
import { Gender } from 'src/modules/user/enums/user-gender';
export class UserProfileDto {
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

  @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
  gender?: Gender;

  @IsNumber()
  numberOfFollowers?: number;

  @IsNumber()
  numberOfFollowing?: number;

  @IsNumber()
  numberOfPosts?: number;

}