import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BrandService } from './services/brand.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt.interface';
import { BrandProfileDto } from './dto/brand-profile.dto';
import { BrandCompleteProfileDto } from './dto/brand-complete-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/file.interceptor';
import { BrandProfileUpdateDto } from './dto/brand-profile-update.dto';
import { Headers } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaginationParams } from '../common/pagination/pagination.params';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getAllBrands(@Query() params: PaginationParams) {
    return await this.brandService.getAllBrands(params);
  }

  @Get('/profile')
  @Roles(Role.BRAND)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<BrandProfileDto> {
    return await this.brandService.getProfile(user.sub);
  }
  @Post('/complete-profile')
  @Roles(Role.BRAND)
  @HttpCode(HttpStatus.CREATED)
  async completeBrandProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: BrandCompleteProfileDto,
  ) {
    return await this.brandService.completeProfile(user.sub, body);
  }
  @Post('/profile/image')
  @Roles(Role.BRAND)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 4 * 1024 * 1024, // 4MB
      },
    }),
  )
  async uploadProfileImage(
    @CurrentUser() user: JwtPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp)$/,
          }),
          new MaxFileSizeValidator({
            maxSize: 4 * 1024 * 1024,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.brandService.updateProfileImage(user.sub, file);
    return {
      message: 'Image uploaded successfully',
    };
  }
  @Get('/profile/image')
  @Roles(Role.BRAND)
  async getProfileImage(@CurrentUser() user: JwtPayload) {
    return await this.brandService.getProfileImage(user.sub);
  }

  @Patch('/profile')
  @Roles(Role.BRAND)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updates: Partial<BrandProfileUpdateDto>,
  ): Promise<BrandProfileDto> {
    return this.brandService.updateProfile(user.sub, updates);
  }
  @Delete('/account')
  @Roles(Role.BRAND)
  async deleteProfile(@CurrentUser() user: JwtPayload) {
    await this.brandService.deleteProfile(user.sub);
    return { message: 'Account deleted successfully' };
  }
}
