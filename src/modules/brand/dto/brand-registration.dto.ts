import { IsEnum, IsString } from "class-validator";

export class BrandRegisterDto {
  @IsString()
  brandName: string;
  @IsString()
  username: string;
  @IsString()
  websiteUrl?: string;
  @IsString()
  bio?: string;
  @IsString()
  phoneNumber?: string;
}