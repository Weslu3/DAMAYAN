import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CitizenController } from './citizen.controller.js';
import { CitizenProxyService } from './citizen.proxy.service.js';
import { GatewayClientsModule } from '../clients.module.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';

@Module({
  imports: [GatewayClientsModule, JwtModule.register({})],
  controllers: [CitizenController],
  providers: [CitizenProxyService, JwtAuthGuard, RolesGuard],
})
export class CitizenGatewayModule {}
