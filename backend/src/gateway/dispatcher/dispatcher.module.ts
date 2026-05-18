import { Module } from '@nestjs/common';
import { GatewayClientsModule } from '../clients.module.js';
import { DispatcherIncidentReportsController } from './dispatcher-incident-reports.controller.js';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';

@Module({
  imports: [GatewayClientsModule],
  controllers: [DispatcherIncidentReportsController],
  providers: [SiteManagerProxyService],
})
export class DispatcherModule { }
