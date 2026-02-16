// src/modules/auth/dto/verify-reset-code.dto.ts
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Role } from '../../../modules/common/enums/role.enum';

export class VerifyResetCodeDto {
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty()
  email: string;

  @IsEnum(Role, { message: 'Role must be either USER or BRAND' })
  role: Role;

  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string; // The 6-digit code
}