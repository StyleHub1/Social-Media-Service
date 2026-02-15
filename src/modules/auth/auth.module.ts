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
import { BrandService } from '../brand/services/brand.service';
import { PasswordService } from './services/password.service';
import { UserService } from '../user/services/user.service';
import { JwtService } from './services/jwt.service';
import { BrandModule } from '../brand/brand.module';
import { UserModule } from '../user/user.module';
import { AuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    BrandModule,
    UserModule,
    TypeOrmModule.forFeature([Brand, User]),

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
  providers: [AuthService,PasswordService,JwtService,AuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}