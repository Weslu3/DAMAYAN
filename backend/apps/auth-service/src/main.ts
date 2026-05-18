import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AuthServiceAppModule } from './auth-service.module.js';
import { MicroserviceRpcExceptionFilter } from './filters/rpc-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AuthServiceAppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_SERVICE_HOST ?? '127.0.0.1',
      port: Number(process.env.AUTH_SERVICE_PORT ?? 4001),
    },
  });

  // Register RPC exception filter to properly serialize HTTP exceptions
  app.useGlobalFilters(new MicroserviceRpcExceptionFilter());

  await app.listen();
}

bootstrap();
