import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GatewayClientsModule } from '../clients.module.js';
import { SiteManagerController } from './site-manager.controller.js';
import { SiteManagerProxyService } from './site-manager.proxy.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { ApiCenterModule } from '../../apicenter/apicenter.module.js';

@Module({
  imports: [GatewayClientsModule, JwtModule.register({}), ApiCenterModule],
  controllers: [SiteManagerController],
  providers: [SiteManagerProxyService, JwtAuthGuard, RolesGuard],
  exports: [SiteManagerProxyService],
})
export class SiteManagerGatewayModule { }
