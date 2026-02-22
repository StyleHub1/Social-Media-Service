// src/modules/auth/services/jwt.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtPayload, JwtServiceInterface } from '../interfaces/jwt.interface';
import { AuthConfig } from '@/config/auth.config';
import { TypedConfigService } from '@/config/typed-config.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtService implements JwtServiceInterface {
  private readonly jwtConfig: AuthConfig['jwt'];

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly config: ConfigService,
  ) {
    const auth = this.config.get<AuthConfig>('auth');
    if (!auth) throw new Error('Auth config not found!');
    this.jwtConfig = auth.jwt;
  }

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.jwtConfig.secret,
      expiresIn: this.jwtConfig.expiresIn, 
    });
  }
  generateRefreshToken(payload: JwtPayload): { refreshToken: string; expiresIn: string } {
    const refreshToken=this.jwtService.sign(payload, {
      secret: this.jwtConfig.refreshSecret, // separate secret for refresh tokens
      expiresIn: this.jwtConfig.refreshExpiresIn, // e.g., '7d'
    });
    return { refreshToken : refreshToken, expiresIn: this.jwtConfig.refreshExpiresIn };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: this.jwtConfig.secret,
      }) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: this.jwtConfig.refreshSecret,
      }) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  decodeToken(token: string): JwtPayload {
    return this.jwtService.decode(token) as JwtPayload;
  }
}