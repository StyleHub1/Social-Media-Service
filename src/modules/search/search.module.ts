import { forwardRef, Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { BrandModule } from '../brand/brand.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [forwardRef(() => BrandModule), forwardRef(() => UserModule)],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
