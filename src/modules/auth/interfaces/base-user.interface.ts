import { Role } from "src/modules/common/enums/role.enum";

export interface BaseAccount {
  id: string;
  email: string;
  role: Role;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  brandName?: string; 
}
export interface IBaseUserService<T > {
  register(dto: T): Promise<T>;
  findByEmail(email: string): Promise<T | null>;
  findByUsername(username: string): Promise<T | null>;
  findByEmailOrUsername(emailOrUsername: string): Promise<T | null>;
  updatePassword(email: string, hashedPassword: string): Promise<void>;
}