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
import { rabbitmqConfig } from './config/rabbitmq.config';
import { MessagingModule } from './modules/messaging/messaging.module';
import { PasswordService } from './modules/auth/services/password.service';
import { ATGuard } from './modules/auth/guards/AT.guard';
import { RTGuard } from './modules/auth/guards/RT.guard';
import { RolesGuard } from './modules/common/guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { SearchModule } from './modules/search/search.module';
import { PostsModule } from './modules/posts/posts.module';
import { FollowModule } from './modules/follow/follow.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { FeedModule } from './modules/feed/feed.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { ChatModule } from './modules/chat/chat.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: TypedConfigService) => {
        const dbConfig = configService.get('database');
        return {
          ...dbConfig,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          autoLoadEntities: true,
        };
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, typeOrmConfig, authConfig, rabbitmqConfig],
      validationSchema: appConfigSchema,
      validationOptions: {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      },
    }),
    UserModule,
    BrandModule,
    AuthModule,
    CloudinaryModule,
    SearchModule,
    PostsModule,
    FollowModule,
    InteractionsModule,
    FeedModule,
    NotificationModule,
    ChatModule,
    MessagingModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: TypedConfigService,
      useExisting: ConfigService,
    },
    PasswordService,
    {
      provide: APP_GUARD,
      useClass: ATGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
