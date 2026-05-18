import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
