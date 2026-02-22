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
import {
  BaseAccount,
  IBaseUserService,
} from '../interfaces/base-user.interface';
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
import { RefreshTokenService } from './refresh-token.service';
import { RefreshResponseDto } from '../dto/refresh-response.dto';

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
    private readonly refreshTokenService: RefreshTokenService,
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
      message: 'Code is valid. Please proceed to set a new password.',
    };
  }

  // STEP 3: Change Password (Action)
  async resetPassword(dto: ResetPasswordDto) {
    // A. Verify the code AGAIN (Stateless security check)
    // We must ensure the code is valid at the moment of password change
    await this.resetTokenService.verifyToken(dto.email, dto.token, dto.role);

    // B. Hash new password
    const hashedPassword = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    // C. Update Password in DB
    const service = this.getServiceOrThrow(dto.role);
    // Ensure your user/brand services have this method
    await service.updatePassword(dto.email, hashedPassword);

    // D. Clean up used code
    await this.resetTokenService.deleteCode(dto.email, dto.role);

    return { message: 'Password reset successful.' };
  }

  //`========================= LOGOUT =========================
  async logout(id: string, role: Role): Promise<void> {
    try {
      await this.refreshTokenService.revokeAllTokensForEntity(role, id);
    } catch (error) {
      console.error('Failed to revoke refresh tokens on logout', error);
      throw new BadRequestException('Logout failed');
    }
  }

  // ========================= REFRESH TOKEN =========================
  async refreshToken(
    payload: JwtPayload,
    storedRTToken: any,
  ): Promise<RefreshResponseDto> {
    const { sub: entityId, role, email } = payload;
    if (!storedRTToken) {
      throw new UnauthorizedException(
        'Refresh token not found, revoked, or expired',
      );
    }
    try {
      await this.refreshTokenService.revokeRefreshToken(
        storedRTToken.tokenHash,
      );
    } catch (error) {
      console.error('Failed to revoke old refresh token', error);
      throw new BadRequestException('Could not revoke old refresh token');
    }
    const userPayload: JwtPayload = {
      sub: entityId,
      role,
      email,
    };

    // 3️⃣ Generate new tokens
    const newAccessToken = this.jwtService.generateAccessToken(userPayload);
    const newRefreshTokenData = this.jwtService.generateRefreshToken(userPayload);

    // 4️⃣ Store the new refresh token
    try {
      await this.refreshTokenService.createRefreshToken({
        rawToken: newRefreshTokenData.refreshToken,
        entityId,
        role,
        expiresIn: newRefreshTokenData.expiresIn,
      });
    } catch (error) {
      console.error('Failed to store new refresh token', error);
      throw new BadRequestException('Failed to create new refresh token');
    }

    // 5️⃣ Fetch user data
    const service = this.getServiceOrThrow(role);
    const entity = await service.findById(entityId);
    if (!entity) {
      throw new UnauthorizedException('User not found');
    }

    const user: UserResponseDto = {
      id: entity.id,
      email: entity.email,
      username: entity.username,
      role: entity.role,
      firstName: role === Role.USER ? (entity as any).firstName : undefined,
      lastName: role === Role.USER ? (entity as any).lastName : undefined,
      brandName: role === Role.BRAND ? (entity as any).brandName : undefined,
    };

    // 6️⃣ Return new tokens + user info
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenData.refreshToken,
      user,
    };
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

  private async buildAuthResponse(
    entity: BaseAccount,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: entity.id,
      role: entity.role,
      email: entity.email,
    };
    try {
      await this.refreshTokenService.revokeAllTokensForEntity(
        entity.role,
        entity.id,
      );
    } catch (error) {
      console.error('Failed to revoke old refresh tokens', error);
    }
    const accessToken = this.jwtService.generateAccessToken(payload);
    const refreshTokenData = this.jwtService.generateRefreshToken(payload);
    try {
      await this.refreshTokenService.createRefreshToken({
        rawToken: refreshTokenData.refreshToken,
        entityId: entity.id,
        role: entity.role,
        expiresIn: refreshTokenData.expiresIn,
      });
    } catch (error) {
      console.error('Failed to create refresh token', error);
      throw new BadRequestException('Failed to create refresh token');
    }
    const user: UserResponseDto = {
      id: entity.id,
      email: entity.email,
      username: entity.username,
      role: entity.role,
      firstName:
        entity.role === Role.USER ? (entity as any).firstName : undefined,
      lastName:
        entity.role === Role.USER ? (entity as any).lastName : undefined,
      brandName:
        entity.role === Role.BRAND ? (entity as any).brandName : undefined,
    };

    return {
      accessToken,
      refreshToken: refreshTokenData.refreshToken,
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
