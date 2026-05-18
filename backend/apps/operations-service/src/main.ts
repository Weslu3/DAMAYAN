import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { OperationsServiceAppModule } from './operations-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(OperationsServiceAppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.OPERATIONS_SERVICE_HOST ?? '127.0.0.1',
      port: Number(process.env.OPERATIONS_SERVICE_PORT ?? 4002),
    },
  });

  await app.listen();
}

bootstrap();
