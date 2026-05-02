// src/modules/auth/dto/forgot-password.dto.ts
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../modules/common/enums/role.enum';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty()
  email: string;

  @IsEnum(Role, { message: 'Role must be either USER or BRAND' })
  role: Role;
}
