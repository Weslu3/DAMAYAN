import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GatewayClientsModule } from '../clients.module.js';
import { DispatcherIncidentReportsController } from './dispatcher-incident-reports.controller.js';
import { DispatcherOperationsController } from './dispatcher-operations.controller.js';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { DispatcherService } from './dispatcher.service.js';
import { BayanihubVolunteersService } from './bayanihub-volunteers.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { InAppNotificationsModule } from '../../in-app-notifications/in-app-notifications.module.js';

@Module({
  imports: [GatewayClientsModule, SupabaseModule, InAppNotificationsModule, JwtModule.register({})],
  controllers: [DispatcherIncidentReportsController],
  providers: [SiteManagerProxyService, DispatcherService, BayanihubVolunteersService, JwtAuthGuard, RolesGuard],
})
export class DispatcherModule { }
