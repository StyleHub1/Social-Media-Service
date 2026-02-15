import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { appConfigSchema, ConfigType } from './config/config.types';
import { typeOrmConfig } from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TypedConfigService } from './config/typed-config.service';
import { UserModule } from './modules/user/user.module';
import { BrandModule } from './modules/brand/brand.module';
import { AuthModule } from './modules/auth/auth.module';
import { authConfig } from './config/auth.config';
import { PasswordService } from './modules/auth/services/password.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync(
      {
        imports: [ConfigModule],
        inject:[ConfigService],
        useFactory: (configService: TypedConfigService) => {
          const dbConfig = configService.get('database');
          return {
            ...dbConfig,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            autoLoadEntities: true, // الأفضل
          };
        }
      }
    ),
    ConfigModule.forRoot({
      load: [appConfig,typeOrmConfig,authConfig],
      validationSchema: appConfigSchema,
      validationOptions: {
        abortEarly: true,// stop validation on the first error and every error will be reported
      }
    }),
    UserModule,
    BrandModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
    provide: TypedConfigService,
    useExisting: ConfigService,
    },
    PasswordService,

],
})
export class AppModule {}
// This code defines the main application module for a NestJS application. It imports necessary modules, sets up configuration management, and configures TypeORM for database interactions. The AppController and AppService are registered as controllers and providers, respectively.
//typeorm configuration is done asynchronously to allow dynamic configuration based on environment variables, and the ConfigModule is used to manage application configuration with validation using Joi.
//why not typeOrmConfig directly in TypeOrmModule.forRoot()?
//Using TypeOrmModule.forRootAsync allows us to configure TypeORM dynamically based on environment variables or other runtime conditions. This is particularly useful when we want to load configuration values from a configuration service (like ConfigService) that may depend on environment variables or other sources of configuration. By using forRootAsync, we can inject the ConfigService and access the database configuration at runtime, ensuring that our application can adapt to different environments without needing to hardcode values in the TypeOrmModule.forRoot() method.