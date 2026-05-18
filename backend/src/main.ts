import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { RpcToHttpExceptionFilter } from './common/filters/rpc-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins =
    process.env.API_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ??
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
    ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new RpcToHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
