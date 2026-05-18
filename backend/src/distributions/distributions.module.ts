import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { DistributionsService } from './distributions.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [DistributionsService],
  exports: [DistributionsService],
})
export class DistributionsModule {}
