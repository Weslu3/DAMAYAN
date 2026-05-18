import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GatewayClientsModule } from '../clients.module.js';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { AdminController } from './admin.controller.js';
import { AdminProxyService } from './admin.proxy.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { NotificationsModule } from '../../notifications/notifications.module.js';
import { InAppNotificationsModule } from '../../in-app-notifications/in-app-notifications.module.js';

@Module({
  imports: [GatewayClientsModule, SupabaseModule, NotificationsModule, InAppNotificationsModule, JwtModule.register({})],
  controllers: [AdminController],
  providers: [SiteManagerProxyService, AdminProxyService, JwtAuthGuard, RolesGuard],
})
export class AdminGatewayModule { }
