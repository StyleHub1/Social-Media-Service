import { UserResponseDto } from "./auth-response.dto";

export class RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}