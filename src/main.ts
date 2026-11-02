import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './common/filters/validation-exception.factory.js';
import type { AppEnv } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);

  // 코어 웹과 어드민 두 주소에서 오는 요청을 받는다
  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }).split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
