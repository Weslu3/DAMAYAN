import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { SystemPhase } from './dto/update-phase.dto.js';

@Injectable()
export class SystemSettingsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async getPhase(): Promise<{ currentPhase: SystemPhase; updatedAt: string }> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .select('current_phase, updated_at')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new NotFoundException('System settings not found. Ensure the system_settings table has a row with id=1.');
    }

    return { currentPhase: data.current_phase as SystemPhase, updatedAt: data.updated_at };
  }

  async updatePhase(
    newPhase: SystemPhase,
    changedBy: string,
  ): Promise<{ message: string; previousPhase: SystemPhase; currentPhase: SystemPhase }> {
    const { data: current, error: fetchError } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .select('current_phase')
      .eq('id', 1)
      .single();

    if (fetchError || !current) {
      throw new NotFoundException('System settings not found. Ensure the system_settings table has a row with id=1.');
    }

    const previousPhase = current.current_phase as SystemPhase;

    const { error: updateError } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .update({ current_phase: newPhase, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (updateError) {
      throw new InternalServerErrorException(`Failed to update phase: ${updateError.message}`);
    }

    // Log the phase change for post-disaster audit trail
    await this.supabaseService
      .getClient()
      .from('phase_history_logs')
      .insert({
        previous_phase: previousPhase,
        new_phase: newPhase,
        changed_by: changedBy,
        changed_at: new Date().toISOString(),
      });

    return {
      message: `System phase successfully shifted from ${previousPhase} to ${newPhase}`,
      previousPhase,
      currentPhase: newPhase,
    };
  }
}
