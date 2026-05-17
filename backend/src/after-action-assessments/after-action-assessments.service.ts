import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { GetAfterActionAssessmentDto } from './dto/get-after-action-assessment.dto.js';
import { UpsertAfterActionAssessmentDto } from './dto/upsert-after-action-assessment.dto.js';

interface AfterActionAssessmentRow {
  id: string;
  disaster_id: string;
  infra_status: string;
  estimated_cost: number;
  relief_needed: number;
  duration_days: number;
  shelter_rating: number;
  success_notes: string;
  bottlenecks: string;
  submitted_by: string | null;
  submitted_at: string;
  updated_at: string;
}

@Injectable()
export class AfterActionAssessmentsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async getLatest(query: GetAfterActionAssessmentDto) {
    const supabase = this.supabaseService.getClient() as any;
    let request = supabase
      .from('after_action_assessments')
      .select(
        'id, disaster_id, infra_status, estimated_cost, relief_needed, duration_days, shelter_rating, success_notes, bottlenecks, submitted_by, submitted_at, updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(1);

    if (query.disasterId) {
      request = request.eq('disaster_id', query.disasterId);
    }

    const { data, error } = await request.maybeSingle();

    if (error) {
      throw new NotFoundException(error.message);
    }

    if (!data) {
      return null;
    }

    return this.toAssessment(data as AfterActionAssessmentRow);
  }

  async upsert(payload: UpsertAfterActionAssessmentDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('after_action_assessments')
      .upsert(
        {
          disaster_id: payload.disasterId,
          infra_status: payload.infraStatus,
          estimated_cost: payload.estimatedCost,
          relief_needed: payload.reliefNeeded,
          duration_days: payload.durationDays,
          shelter_rating: payload.shelterRating,
          success_notes: payload.successNotes,
          bottlenecks: payload.bottlenecks,
          submitted_by: payload.submittedBy ?? null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'disaster_id' },
      )
      .select(
        'id, disaster_id, infra_status, estimated_cost, relief_needed, duration_days, shelter_rating, success_notes, bottlenecks, submitted_by, submitted_at, updated_at',
      )
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toAssessment(data as AfterActionAssessmentRow);
  }

  private toAssessment(row: AfterActionAssessmentRow) {
    return {
      id: row.id,
      disasterId: row.disaster_id,
      infraStatus: row.infra_status,
      estimatedCost: row.estimated_cost,
      reliefNeeded: row.relief_needed,
      durationDays: row.duration_days,
      shelterRating: row.shelter_rating,
      successNotes: row.success_notes,
      bottlenecks: row.bottlenecks,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }
}
