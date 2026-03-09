import { forwardRef, Module } from '@nestjs/common';
import { BrandService } from './services/brand.service';
import { BrandController } from './brand.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandProfile } from './entities/brand-profile.entity';
import { BrandRepository } from './repositories/brand.repository';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([BrandProfile])
  ,forwardRef(() => AuthModule),
  forwardRef(() => CloudinaryModule)],
  providers: [BrandService,BrandRepository],
  controllers: [BrandController],
  exports: [BrandService]
})
export class BrandModule {}
