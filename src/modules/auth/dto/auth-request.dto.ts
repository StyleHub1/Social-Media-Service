import { Role } from "@/modules/common/enums/role.enum";

export interface AuthRequestDto {
    user:{
      sub: string;
      role: Role;
      email: string;
      username: string;
    };
}
