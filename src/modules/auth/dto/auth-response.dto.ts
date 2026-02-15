import { Expose, Type } from 'class-transformer';
import { Role } from 'src/modules/common/enums/role.enum';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  username: string;

  @Expose()
  role: Role;

  @Expose()
  firstName?: string;

  @Expose()
  lastName?: string;

  @Expose()
  brandName?: string;
}

export class AuthResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto;
}