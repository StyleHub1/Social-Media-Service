import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { Role } from "src/modules/common/enums/role.enum";

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Email or username is required' })
  emailOrUsername: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;
  
  @IsEnum(Role, { message: 'Role must be either USER or BRAND' })
  role: Role;
}

