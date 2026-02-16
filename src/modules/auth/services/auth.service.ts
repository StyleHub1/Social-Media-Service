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
import { EmailService } from './email.service';
import { ResetTokenService } from './reset-token.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyResetCodeDto } from '../dto/verify-reset-code.dto'; // Make sure to create this DTO
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { response } from 'express';

@Injectable()
export class AuthService {
  private readonly userServiceMap: Map<Role, IBaseUserService<BaseAccount>>;

  constructor(
    private readonly userService: UserService,
    private readonly brandService: BrandService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly resetTokenService: ResetTokenService,
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

    // Send Welcome Email (Non-blocking)
    try {
      await this.emailService.sendWelcomeEmail(input.email, input.username);
    } catch (error) {
       console.error('Failed to send welcome email', error);
    }
    const response = this.buildAuthResponse(entity);
    return response;
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

  // ========================= PASSWORD RESET FLOW =========================

  // STEP 1: Request Code
  async forgotPassword(input: ForgotPasswordDto) {
    const service = this.getServiceOrThrow(input.role);
    const user = await service.findByEmail(input.email);
    
    // Security: Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If email exists, verification code sent.' };
    }

    // Generate and send the 6-digit code
    await this.resetTokenService.generateAndSendToken(input.email, input.role);
    
    return { message: 'Verification code sent.' };
  }

  // STEP 2: Verify Code (Check Only)
  // This is the function you requested to just check if the code is right
  async verifyResetCode(dto: VerifyResetCodeDto) {
    // This throws an error if invalid, otherwise returns true
    await this.resetTokenService.verifyToken(dto.email, dto.token, dto.role);

    return { 
      valid: true, 
      message: 'Code is valid. Please proceed to set a new password.' 
    };
  }

  // STEP 3: Change Password (Action)
  async resetPassword(dto: ResetPasswordDto) {
    // A. Verify the code AGAIN (Stateless security check)
    // We must ensure the code is valid at the moment of password change
    await this.resetTokenService.verifyToken(dto.email, dto.token, dto.role);

    // B. Hash new password
    const hashedPassword = await this.passwordService.hashPassword(dto.newPassword);
    
    // C. Update Password in DB
    const service = this.getServiceOrThrow(dto.role);
    // Ensure your user/brand services have this method
    await service.updatePassword(dto.email, hashedPassword); 

    // D. Clean up used code
    await this.resetTokenService.deleteCode(dto.email, dto.role);

    return { message: 'Password reset successful.' };
  }

  // ========================= PRIVATE HELPERS =========================

  private async resolveAccount(emailOrUsername: string): Promise<BaseAccount> {
    // Try to find user in all services (User, Brand, etc.)
    for (const service of this.userServiceMap.values()) {
      const entity = await service.findByEmailOrUsername(emailOrUsername);
      if (entity) return entity;
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  private buildAuthResponse(entity: BaseAccount): AuthResponseDto {
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
      firstName: entity.role === Role.USER ? (entity as any).firstName : undefined,
      lastName: entity.role === Role.USER ? (entity as any).lastName : undefined,
      brandName: entity.role === Role.BRAND ? (entity as any).brandName : undefined,
    };

    return {
      accessToken,
      user,
    };
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
    if (!service) throw new BadRequestException(`Unknown role: ${role}`);
    return service;
  }
}