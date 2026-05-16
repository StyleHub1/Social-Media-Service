// src/modules/auth/dto/verify-reset-code.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetCodeDto {
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string; // The 6-digit code
}
