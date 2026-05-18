import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { OperationsServiceAppModule } from './operations-service.module.js';

async function bootstrap() {
  const port = Number(process.env.OPERATIONS_SERVICE_PORT ?? 4002);
  const app = await NestFactory.createMicroservice(OperationsServiceAppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.OPERATIONS_SERVICE_HOST ?? '127.0.0.1',
      port,
    },
  });

  await app.listen();
  console.log(`\n✅ OperationsService running on port ${port}\n`);
}

bootstrap();
