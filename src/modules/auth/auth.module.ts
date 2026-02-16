import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from '../brand/entities/brand.entity';
import { User } from '../user/entities/user.entity';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypedConfigService } from 'src/config/typed-config.service';
import { AuthConfig } from 'src/config/auth.config';
import { StringValue } from 'ms';
import { PasswordService } from './services/password.service';
import { JwtService } from './services/jwt.service';
import { BrandModule } from '../brand/brand.module';
import { UserModule } from '../user/user.module';
import { AuthGuard } from './guards/jwt-auth.guard';
import { EmailService } from './services/email.service';
import { ResetTokenService } from './services/reset-token.service';
import { ResetToken } from './entities/reset_tokens.entity';
import { ResetTokenRepository } from './repositories/reset-token.repository';
import { emailConfig } from 'src/config/email.config';


@Module({
  imports: [
    BrandModule,
    UserModule,
    TypeOrmModule.forFeature([Brand, User,ResetToken]),
    ConfigModule.forFeature(emailConfig),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: TypedConfigService,
      ): JwtModuleOptions => {
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
  providers: [AuthService,PasswordService,JwtService,AuthGuard,EmailService,TypedConfigService,ResetTokenService,ResetTokenRepository],
  controllers: [AuthController],
})
export class AuthModule {}