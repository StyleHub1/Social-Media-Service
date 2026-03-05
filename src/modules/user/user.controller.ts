import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserProfileDto } from './dto/user-profile.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt.interface';
import { UserUpdateProfileDto } from './dto/user-complete-profile.dto';
import { UserProfileUpdateDto } from './dto/user-profile-update.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('/profile')
  @Roles(Role.USER)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
     return await this.userService.getProfile(user.sub);
  }
  @Post('/complete-profile')
  @Roles(Role.USER)
  @HttpCode(HttpStatus.CREATED)
  async completeUserProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: UserUpdateProfileDto,
  ) {
    return await this.userService.completeProfile(user.sub, body);
  }
  @Patch('/profile')
  @Roles(Role.USER)
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() updates:UserProfileUpdateDto) : Promise<UserProfileDto> {
    return this.userService.updateProfile(user.sub, updates);
  }
  @Delete('/profile')
  @Roles(Role.USER)
  async deleteProfile(@CurrentUser() user: JwtPayload) {
    await this.userService.deleteProfile(user.sub);
    return { message: 'Profile deleted successfully' };
  }
    //   @Post('/profile/image')
    // @Roles(Role.USER)
    // @UseInterceptors(FileInterceptor('file'))
    // async uploadProfileImage(
    //   @CurrentUser() user: JwtPayload,
    //   @UploadedFile() file: Express.Multer.File[],
    // ) {
    //   await this.userProfileImageService.uploadProfileImage(user.sub, file);
    //   return { message: 'Image uploaded successfully' };
    // }

    // @Get('/profile/image')
    // @Roles(Role.USER)
    // async getProfileImage(@CurrentUser() user: JwtPayload) {
    //   return await this.userProfileImageService.getProfileImage(user.sub);
    // }
}
