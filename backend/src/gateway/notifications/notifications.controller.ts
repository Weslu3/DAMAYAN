import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service.js';

interface AuthedRequest extends Request {
  user: { sub: string; email: string; role: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(InAppNotificationsService)
    private readonly notificationsService: InAppNotificationsService,
  ) {}

  @Get()
  getNotifications(@Req() req: AuthedRequest) {
    return this.notificationsService.findByUser(req.user.sub);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthedRequest) {
    const count = await this.notificationsService.unreadCount(req.user.sub);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.notificationsService.markRead(id, req.user.sub);
    return { ok: true };
  }

  @Patch('read-all')
  async markAllRead(@Req() req: AuthedRequest) {
    await this.notificationsService.markAllRead(req.user.sub);
    return { ok: true };
  }
}
