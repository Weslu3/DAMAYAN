import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SystemSettingsController } from './system-settings.controller.js';
import { SystemSettingsService } from './system-settings.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';

@Module({
  imports: [SupabaseModule, JwtModule.register({})],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, JwtAuthGuard, RolesGuard],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
