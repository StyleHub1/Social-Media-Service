import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtPayload, JwtServiceInterface } from '../interfaces/jwt.interface';

@Injectable()
export class JwtService implements JwtServiceInterface {
  constructor(
    private readonly jwtService: NestJwtService,
  ) {}

  generateToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  decodeToken(token: string): JwtPayload {
    return this.jwtService.decode(token) as JwtPayload;
  }
}
