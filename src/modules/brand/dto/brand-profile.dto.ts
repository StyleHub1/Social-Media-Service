import { Role } from '@/modules/common/enums/role.enum';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class BrandProfileDto {
  @IsString()
  id: string;
  @IsEnum(Role)
  type: Role.BRAND;
  @IsString()
  brandName: string;
  @IsString()
  username: string;
  @IsString()
  websiteUrl?: string;
  @IsString()
  bio?: string;
  @IsString()
  profileImageUrl?: string;
  @IsString()
  phoneNumber?: string;
  @IsNumber()
  numberOfFollowers?: number;
  @IsNumber()
  numberOfFollowing?: number;
  @IsNumber()
  numberOfPosts?: number;
  @IsNumber()
  score?: number; // Optional score field for search results
}
