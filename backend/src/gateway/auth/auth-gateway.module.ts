import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthGatewayController } from './auth.controller.js';
import { AuthProxyService } from './auth.proxy.service.js';
import { GatewayClientsModule } from '../clients.module.js';
import { AUTH_SERVICE } from '../gateway.tokens.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';

@Module({
  imports: [GatewayClientsModule, JwtModule.register({})],
  controllers: [AuthGatewayController],
  providers: [
    {
      provide: AuthProxyService,
      useFactory: (authClient: any) => new AuthProxyService(authClient),
      inject: [AUTH_SERVICE],
    },
    JwtAuthGuard,
  ],
  exports: [AuthProxyService],
})
export class AuthGatewayModule { }
