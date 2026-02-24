import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserProfileDto } from './dto/user-profile.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt.interface';
import { UserRegisterDto } from './dto/user-registration.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('/profile')
  @Roles(Role.USER)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
     return await this.userService.getProfile(user.sub);
  }

  @Post('/register')
  @Roles(Role.USER)
  @HttpCode(HttpStatus.CREATED)
  async registerUserProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: UserRegisterDto,
  ) {
    return await this.userService.register(user.sub, body);
  }
}
