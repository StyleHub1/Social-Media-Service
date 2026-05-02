import { Role } from '@/modules/auth/entities/base-user.entity';
import { IsNotEmpty, IsString, IsEnum, IsNumber } from 'class-validator';
export class BrandSearchResponseDto {
  @IsString()
  id: string;
  @IsEnum(Role)
  type: Role.BRAND;
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
  @IsString()
  profileImageUrl?: string;
  @IsString()
  brandName?: string;
  @IsNumber()
  score: number;
}
