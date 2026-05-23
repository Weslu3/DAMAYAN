import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { RpcToHttpExceptionFilter } from './common/filters/rpc-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredAllowedOrigins =
    process.env.API_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ??
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
    ];

  const isAllowedDevOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    if (configuredAllowedOrigins.includes(origin)) return true;

    try {
      const parsed = new URL(origin);
      const isDevPort = ['3000', '3001', '8081', '8082', '8083', '8084', '19006'].includes(parsed.port);
      const isLocalHost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        /^10\./.test(parsed.hostname) ||
        /^192\.168\./.test(parsed.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);

      return isDevPort && isLocalHost;
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, isAllowedDevOrigin(origin));
    },
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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n🚀 Gateway running on port ${port}\n`);
}
bootstrap();
