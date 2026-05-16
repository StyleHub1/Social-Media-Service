// src/modules/auth/dto/forgot-password.dto.ts
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty()
  email: string;
}
