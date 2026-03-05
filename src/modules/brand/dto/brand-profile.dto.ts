import { IsEnum, IsNumber, IsString } from 'class-validator';

export class BrandProfileDto {
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
  @IsNumber()
  numberOfFollowers?: number;
  @IsNumber()
  numberOfPosts?: number;
}
