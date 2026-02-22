import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('health')
  @Public()
  healthCheck(): string {
    return 'The service is healthy';
  }
}
