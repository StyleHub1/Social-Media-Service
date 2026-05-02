import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender } from '../enums/user-gender';

export class UserProfileUpdateDto {
  @IsString()
  @IsOptional()
  username?: string;
  @IsString()
  @IsOptional()
  firstName?: string;
  @IsString()
  @IsOptional()
  lastName?: string;
  @IsString()
  @IsOptional()
  phoneNumber?: string;
  @IsString()
  @IsOptional()
  bio?: string;
  @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
  @IsOptional()
  gender?: Gender;
}
