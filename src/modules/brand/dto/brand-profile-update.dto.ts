import { IsEnum, IsOptional, IsString } from "class-validator";
export class BrandProfileUpdateDto {
  @IsString()
  @IsOptional()
  brandName?: string;
  @IsString()
  @IsOptional()
  username?: string;
  @IsString()
  @IsOptional()
  phoneNumber?: string;
  @IsString()
  @IsOptional()
  bio?: string;
  @IsString()
  @IsOptional()
  websiteUrl?: string;
}