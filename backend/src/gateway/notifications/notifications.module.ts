import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InAppNotificationsModule } from '../../in-app-notifications/in-app-notifications.module.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [InAppNotificationsModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [JwtAuthGuard],
})
export class NotificationsGatewayModule {}
