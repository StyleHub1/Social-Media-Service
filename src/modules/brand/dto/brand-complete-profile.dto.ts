import { IsEnum, IsOptional, IsString } from "class-validator";

export class BrandCompleteProfileDto {
  @IsString()
  brandName: string;
  @IsString()
  username: string;
  @IsString()
  @IsOptional()
  websiteUrl?: string;
  @IsString()
  @IsOptional()
  bio?: string;
  @IsString()
  phoneNumber?: string;
}