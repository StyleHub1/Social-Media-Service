import { Role } from "src/modules/common/enums/role.enum";

export interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
}

export interface JwtServiceInterface {
  verifyToken(token: string): JwtPayload;
  decodeToken(token: string): JwtPayload;
}
