import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from 'src/modules/common/enums/role.enum';
import { UserService } from 'src/modules/user/services/user.service';
import { PasswordService } from './password.service';
import { RegistrationDto } from '../dto/registration.dto';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from './jwt.service';
import { JwtPayload } from '../interfaces/jwt.interface';
import { AuthResponseDto, UserResponseDto } from '../dto/auth-response.dto';
import { EmailService } from './email.service';
import { ResetTokenService } from './reset-token.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyResetCodeDto } from '../dto/verify-reset-code.dto'; // Make sure to create this DTO
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { BaseUsersService } from './base-user.service';
import { BaseUser } from '../entities/base-user.entity';

@Injectable()
export class AuthService {

  constructor(
    private readonly baseUserService: BaseUsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly resetTokenService: ResetTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
  }

  // ========================= REGISTER =========================

  async register(input: RegistrationDto): Promise<AuthResponseDto> {
    if(input.role==Role.ADMIN){
      throw new BadRequestException('Cannot register as admin');
    }
    await this.ensureEmailNotTaken(input.email);

    const hashedPassword = await this.passwordService.hashPassword(
      input.password,
    );

    const dtoWithHashed = { ...input, password: hashedPassword };

    const entity = await this.baseUserService.createBaseUser(dtoWithHashed);

    // Send Welcome Email (Non-blocking)
    try {
      await this.emailService.sendWelcomeEmail(input.email, input.email);
    } catch (error) {
      console.error('Failed to send welcome email');
    }
    const response = this.buildAuthResponse(entity);
    return response;
  }

  // ========================= LOGIN =========================

  async login(input: LoginDto): Promise<AuthResponseDto> {
    const entity = await this.baseUserService.findByEmail(input.email);
    if (!entity) {
      throw new UnauthorizedException('Invalid credentials');
    }
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
    const BaseUser = await this.baseUserService.findByEmail(input.email);

    // Security: Always return success to prevent email enumeration
    if (!BaseUser) {
      return { message: 'If email exists, verification code sent.' };
    }

    // Generate and send the 6-digit code
    await this.resetTokenService.generateAndSendToken(BaseUser.id, input.email);

    return { message: 'Verification code sent.' };
  }

  // STEP 2: Verify Code (Check Only)
  // This is the function you requested to just check if the code is right
  async verifyResetCode(dto: VerifyResetCodeDto) {
    // This throws an error if invalid, otherwise returns true
    const BaseUser = await this.baseUserService.findByEmail(dto.email);
    if (!BaseUser) {
      throw new BadRequestException('Invalid email or code.');
    }
    await this.resetTokenService.verifyToken(BaseUser.id, dto.token);
    return {
      valid: true,
      message: 'Code is valid. Please proceed to set a new password.',
    };
  }

  // STEP 3: Change Password (Action)
  async resetPassword(dto: ResetPasswordDto) {
    const BaseUser = await this.baseUserService.findByEmail(dto.email);
    if (!BaseUser) {
      throw new BadRequestException('Invalid email or code.');
    }
    await this.resetTokenService.verifyToken(BaseUser.id, dto.token);
    // B. Hash new password
    const hashedPassword = await this.passwordService.hashPassword(
      dto.newPassword,
    );
    // C. Update Password in D
    await this.baseUserService.updatePassword(BaseUser.id, hashedPassword);

    // D. Clean up used code
    await this.resetTokenService.deleteCode(BaseUser.id);

    return { message: 'Password reset successful.' };
  }

  //`========================= LOGOUT =========================
  async logout(id: string, role: Role): Promise<void> {
    try {
      await this.refreshTokenService.revokeAllTokensForEntity(id);
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
        expiresIn: newRefreshTokenData.expiresIn,
      });
    } catch (error) {
      console.error('Failed to store new refresh token', error);
      throw new BadRequestException('Failed to create new refresh token');
    }

    // 5️⃣ Fetch user data
    const entity = await this.baseUserService.findById(entityId);
    if (!entity) {
      throw new UnauthorizedException('User not found');
    }

    const user: UserResponseDto = {
      id: entity.id,
      email: entity.email,
      role: entity.role,
    };

    // 6️⃣ Return new tokens + user info
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenData.refreshToken,
      user,
    };
  }
  // ========================= PRIVATE HELPERS =========================
  private async buildAuthResponse(
    entity: BaseUser,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: entity.id,
      role: entity.role,
      email: entity.email,
    };
    try {
      await this.refreshTokenService.revokeAllTokensForEntity(
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
        expiresIn: refreshTokenData.expiresIn,
      });
    } catch (error) {
      console.error('Failed to create refresh token', error);
      throw new BadRequestException('Failed to create refresh token');
    }
    const user: UserResponseDto = {
      id: entity.id,
      email: entity.email,
      role: entity.role,
    };

    return {
      accessToken,
      refreshToken: refreshTokenData.refreshToken,
      user,
    };
  }

  private async ensureEmailNotTaken(
    email: string,
  ) {
    const exists = await this.baseUserService.findByEmail(email);
    if (exists) {
      throw new ConflictException('Email already exists');
    }
  }
}
