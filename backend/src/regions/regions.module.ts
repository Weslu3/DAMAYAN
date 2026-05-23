import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { RegionsController } from './regions.controller.js';
import { PublicRegionsController } from './public-regions.controller.js';
import { RegionsService } from './regions.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [RegionsController, PublicRegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
