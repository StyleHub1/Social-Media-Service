import { Role } from "../../..//modules/common/enums/role.enum";
import {
  IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, Matches
} from 'class-validator';
import { Match } from 'src/modules/common/decorators/match.decorator';

export class ResetPasswordDto {
    @IsEmail({}, { message: 'Email must be valid' })
    @IsNotEmpty()
    email: string;

    @IsEnum(Role, { message: 'Type must be either USER or BRAND' })
    role: Role;

    @IsString()
    @IsNotEmpty({ message: 'Verification token is required' })
    token: string; 

    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
    @Matches(/[@$!%*?&]/, {  message: 'Password must contain at least one special character (@$!%*?&)' })
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    @Match('newPassword', { message: 'Password confirmation does not match new password' }) // 👈 Fixed: matches 'newPassword', not 'password'
    newConfirmationPassword: string;
}