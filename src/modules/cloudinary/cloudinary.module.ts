import { forwardRef, Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { UserModule } from '../user/user.module';
import { BrandModule } from '../brand/brand.module';

@Module({
  imports: [
  forwardRef(() => UserModule),
  forwardRef(() => BrandModule),
  ],
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryProvider, CloudinaryService]
})
export class CloudinaryModule {}
