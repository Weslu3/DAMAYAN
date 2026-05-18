import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { InAppNotificationsService } from './in-app-notifications.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [InAppNotificationsService],
  exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
