// src/modules/auth/guards/rt.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../services/jwt.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { Request } from 'express';

@Injectable()
export class RTGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Refresh token not provided');
    }
    const token = authHeader.split(' ')[1];

    try {
      // Verify the refresh token and decode payload
      const payload = this.jwtService.verifyRefreshToken(token);

      // Check if the token exists in DB and is valid
      const storedToken = await this.refreshTokenService.findValidToken(
        payload.sub,
        token,
      );
      if (!storedToken) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      // Attach payload & stored token to request
      request['user'] = payload;
      request['refreshToken'] = storedToken;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
