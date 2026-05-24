import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { setDefaultResultOrder } from 'node:dns';
import { AuthServiceAppModule } from './auth-service.module.js';
import { MicroserviceRpcExceptionFilter } from './filters/rpc-exception.filter.js';

async function bootstrap() {
  // Prefer IPv4 first to reduce intermittent DNS/socket behavior on some local networks.
  setDefaultResultOrder('ipv4first');

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 4001);
  const app = await NestFactory.createMicroservice(AuthServiceAppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_SERVICE_HOST ?? '127.0.0.1',
      port,
    },
  });

  // Register RPC exception filter to properly serialize HTTP exceptions
  app.useGlobalFilters(new MicroserviceRpcExceptionFilter());

  await app.listen();
  console.log(`\n✅ AuthService running on port ${port}\n`);
}

bootstrap();
