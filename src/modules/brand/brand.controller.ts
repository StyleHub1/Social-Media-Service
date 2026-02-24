import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { BrandService } from './services/brand.service';
import { UserRegisterDto } from '../user/dto/user-registration.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UserProfileDto } from '../user/dto/user-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt.interface';
import { BrandProfileDto } from './dto/brand-profile.dto';
import { BrandRegisterDto } from './dto/brand-registration.dto';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('/profile')
  @Roles(Role.BRAND)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<BrandProfileDto> {
    return await this.brandService.getProfile(user.sub);
  }
  @Post('/register')
  @Roles(Role.BRAND)
  @HttpCode(HttpStatus.CREATED)
  async registerUserProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: BrandRegisterDto,
  ) {
    return await this.brandService.register(user.sub, body);
  }
}
