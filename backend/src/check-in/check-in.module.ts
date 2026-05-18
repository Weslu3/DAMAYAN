import { Module } from '@nestjs/common';
import { CheckInService } from './check-in.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
