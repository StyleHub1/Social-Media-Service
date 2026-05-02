import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsUrl,
  ValidateIf,
  Matches,
} from 'class-validator';
import { Match } from 'src/modules/common/decorators/match.decorator';
import { Role } from 'src/modules/common/enums/role.enum';
import { Gender } from 'src/modules/user/enums/user-gender';

export class RegistrationDto {
  @IsEnum(Role, { message: 'Type must be either USER or BRAND' })
  role: Role;

  @IsEmail({}, { message: 'Email must be valid' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[#@$!%*?&]/, {
    message: 'Password must contain at least one special character (@$!%*?&)',
  })
  password: string;

  @IsString()
  @MinLength(6, { message: 'Username must be at least 6 characters' })
  @Match('password', {
    message: 'Password confirmation does not match password',
  })
  confirmationPassword: string;
}
