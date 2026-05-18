import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
