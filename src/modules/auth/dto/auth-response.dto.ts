import { Expose, Type } from 'class-transformer';
import { Role } from 'src/modules/common/enums/role.enum';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: Role;

  @Expose()
  isProfileComplete: boolean;
}

export class AuthResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;

  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto;
}