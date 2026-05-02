import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender } from '../enums/user-gender';

export class UserCompleteProfileDto {
  @IsString()
  username: string;
  @IsString()
  firstName?: string;
  @IsString()
  lastName?: string;
  @IsString()
  phoneNumber?: string;
  @IsString()
  @IsOptional()
  bio?: string;
  @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
  gender?: Gender;
}
