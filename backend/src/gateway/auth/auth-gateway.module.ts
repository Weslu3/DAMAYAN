import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { AuthGatewayController } from './auth.controller.js';
import { AuthProxyService } from './auth.proxy.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { UploadsModule } from '../../uploads/uploads.module.js';

@Module({
  imports: [
    UploadsModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST || '127.0.0.1',
          port: process.env.AUTH_SERVICE_PORT ? parseInt(process.env.AUTH_SERVICE_PORT) : 4001,
          retryAttempts: 5,
          retryDelay: 1000,
        },
      },
    ]),
  ],
  controllers: [AuthGatewayController],
  providers: [
    {
      provide: AuthProxyService,
      useFactory: (authClient: any) => new AuthProxyService(authClient),
      inject: ['AUTH_SERVICE'],
    },
    JwtAuthGuard,
  ],
  exports: [AuthProxyService],
})
export class AuthGatewayModule { }
