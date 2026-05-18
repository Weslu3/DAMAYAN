import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { DispatchOrdersService } from './dispatch-orders.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [DispatchOrdersService],
  exports: [DispatchOrdersService],
})
export class DispatchOrdersModule {}
