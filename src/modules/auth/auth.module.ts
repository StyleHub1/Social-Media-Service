import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypedConfigService } from 'src/config/typed-config.service';
import { authConfig, AuthConfig } from 'src/config/auth.config';
import { StringValue } from 'ms';
import { PasswordService } from './services/password.service';
import { JwtService } from './services/jwt.service';
import { BrandModule } from '../brand/brand.module';
import { UserModule } from '../user/user.module';
import { ATGuard } from './guards/AT.guard';
import { EmailService } from './services/email.service';
import { ResetTokenService } from './services/reset-token.service';
import { ResetToken } from './entities/reset-token.entity';
import { ResetTokenRepository } from './repositories/reset-token.repository';
import { emailConfig } from 'src/config/email.config';
import { AtStrategy, RtStrategy } from './strategies';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { RefreshTokenService } from './services/refresh-token.service';
import { BaseUser } from './entities/base-user.entity';
import { BaseUsersService } from './services/base-user.service';
import { BaseUsersRepository } from './repositories/base-user.repository';
import { EmailListenerService } from './services/email-listener.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => BrandModule),
    TypeOrmModule.forFeature([ResetToken, RefreshToken, BaseUser]),
    ConfigModule.forFeature(emailConfig),
    ConfigModule.forFeature(authConfig),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: TypedConfigService): JwtModuleOptions => {
        const { jwt } = config.get<AuthConfig>('auth')!;

        return {
          secret: jwt.secret,
          signOptions: {
            expiresIn: jwt.expiresIn as StringValue,
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    PasswordService,
    JwtService,
    ATGuard,
    EmailService,
    EmailListenerService,
    ResetTokenService,
    ResetTokenRepository,
    AtStrategy,
    RtStrategy,
    RefreshTokenService,
    RefreshTokenRepository,
    BaseUsersService,
    BaseUsersRepository,
  ],
  controllers: [AuthController],
  exports: [
    JwtService,
    RefreshTokenRepository,
    BaseUsersService,
    BaseUsersRepository,
  ],
})
export class AuthModule {}
