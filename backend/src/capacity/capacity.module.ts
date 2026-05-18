import { Module } from '@nestjs/common';
import { CapacityService } from './capacity.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
