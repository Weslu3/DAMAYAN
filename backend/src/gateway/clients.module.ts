import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AUTH_SERVICE, OPERATIONS_SERVICE } from './gateway.tokens.js';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('AUTH_SERVICE_HOST') ?? '127.0.0.1',
            port: Number(configService.get<string>('AUTH_SERVICE_PORT') ?? 4001),
          },
        }),
      },
      {
        name: OPERATIONS_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host:
              configService.get<string>('OPERATIONS_SERVICE_HOST') ?? '127.0.0.1',
            port: Number(configService.get<string>('OPERATIONS_SERVICE_PORT') ?? 4002),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GatewayClientsModule {}
