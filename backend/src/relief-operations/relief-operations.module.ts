import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { ReliefOperationsService } from './relief-operations.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [ReliefOperationsService],
  exports: [ReliefOperationsService],
})
export class ReliefOperationsModule {}
