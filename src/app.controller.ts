import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Get('/debug-sentry')
  getError() {
    throw new Error('testing fourth sentry error');
  }
}
