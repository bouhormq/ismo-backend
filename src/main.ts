import './instrument';

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import { JwtGuard } from './auth/guard';
import { CORS_CONFIG } from './utils/constants/config.constants';
import { ZodValidationPipe } from '@anatine/zod-nestjs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors(CORS_CONFIG);
  app.use(cookieParser());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ZodValidationPipe());

  const reflector = app.get(Reflector);

  app.useGlobalGuards(new JwtGuard(reflector));

  const config = new DocumentBuilder()
    .setTitle('ISMO API')
    .setDescription('Ismo api swagger UI')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
