import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { BrandService } from 'src/modules/brand/services/brand.service';
import { Role } from 'src/modules/common/enums/role.enum';
import { UserService } from 'src/modules/user/services/user.service';
import { PasswordService } from './password.service';
import { RegistrationDto } from '../dto/registration.dto';
import { BaseAccount, IBaseUserService } from '../interfaces/base-user.interface';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from './jwt.service';
import { JwtPayload } from '../interfaces/jwt.interface';
import { AuthResponseDto, UserResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly userServiceMap: Map<Role, IBaseUserService<BaseAccount>>;

  constructor(
    private readonly userService: UserService,
    private readonly brandService: BrandService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {
    this.userServiceMap = new Map<Role, IBaseUserService<BaseAccount>>([
      [Role.USER, userService],
      [Role.BRAND, brandService],
    ]);
  }

  // ========================= REGISTER =========================

  async register(input: RegistrationDto): Promise<AuthResponseDto> {
    const service = this.getServiceOrThrow(input.role);

    await this.ensureEmailNotTaken(service, input.email);
    await this.ensureUsernameNotTaken(service, input.username);

    const hashedPassword = await this.passwordService.hashPassword(
      input.password,
    );

    const dtoWithHashed = { ...input, password: hashedPassword };

    const entity = await service.register(dtoWithHashed);

    return this.buildAuthResponse(entity);
  }

  // ========================= LOGIN =========================

  async login(input: LoginDto): Promise<AuthResponseDto> {
    const entity = await this.resolveAccount(input.emailOrUsername);

    const passwordValid = await this.passwordService.verifyPassword(
      input.password,
      entity.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(entity);
  }

  // ========================= PRIVATE HELPERS =========================

  private async resolveAccount(emailOrUsername: string,): Promise<BaseAccount> {
    for (const service of this.userServiceMap.values()) {
      const entity = await service.findByEmailOrUsername(emailOrUsername);
      if (entity) return entity;
    }
    throw new UnauthorizedException('Invalid credentials');
  }
  private buildAuthResponse(entity: BaseAccount):AuthResponseDto {
    const payload: JwtPayload = {
      sub: entity.id,
      role: entity.role,
      email: entity.email,
      username: entity.username,
    };

    const accessToken = this.jwtService.generateToken(payload);

  const user: UserResponseDto = {
    id: entity.id,
    email: entity.email,
    username: entity.username,
    role: entity.role,
    firstName: entity.role === Role.USER ? entity.firstName : undefined,
    lastName: entity.role === Role.USER ? entity.lastName : undefined,
    brandName: entity.role === Role.BRAND ? entity.brandName : undefined,
  };

  return Object.assign(new AuthResponseDto(), {
    accessToken,
    user,
  });
}

  private async ensureEmailNotTaken(
    service: IBaseUserService<BaseAccount>,
    email: string,
  ) {
    const exists = await service.findByEmail(email);
    if (exists) {
      throw new ConflictException('Email already exists');
    }
  }

  private async ensureUsernameNotTaken(
    service: IBaseUserService<BaseAccount>,
    username: string,
  ) {
    const exists = await service.findByUsername(username);
    if (exists) {
      throw new ConflictException('Username already exists');
    }
  }

  private getServiceOrThrow(role: Role): IBaseUserService<any> {
    const service = this.userServiceMap.get(role);
    if (!service) throw new BadRequestException('Unknown role');
    return service;
  }
}