import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './services/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './repositories/user.repository';
import { UserProfile } from './entities/user-profile.entity';

@Module({
  imports:[TypeOrmModule.forFeature([UserProfile])],
  controllers: [UserController],
  providers: [UserService,UserRepository],
  exports: [UserService,UserRepository]
})
export class UserModule {}
