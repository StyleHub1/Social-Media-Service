import { IsEnum, IsString } from "class-validator";
import { Gender } from "../enums/user-gender";

export class UserProfileUpdateDto {
  @IsString()
  username?: string;
  @IsString()
  firstName?: string;
  @IsString()
  lastName?: string;
  @IsString()
  phoneNumber?: string;
  @IsString()
  bio?: string;
  @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
  gender?: Gender;
}