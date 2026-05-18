import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { DisasterEventsService } from './disaster-events.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [DisasterEventsService],
  exports: [DisasterEventsService],
})
export class DisasterEventsModule {}
