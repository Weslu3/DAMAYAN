import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { IncidentReportsService } from './incident-reports.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [IncidentReportsService],
  exports: [IncidentReportsService],
})
export class IncidentReportsModule {}
