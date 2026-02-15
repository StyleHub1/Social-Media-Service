import { Module } from '@nestjs/common';
import { BrandService } from './services/brand.service';
import { BrandController } from './brand.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from './entities/brand.entity';
import { BrandRepository } from './repositories/brand.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Brand])],
  providers: [BrandService,BrandRepository],
  controllers: [BrandController],
  exports: [BrandService]
})
export class BrandModule {}
