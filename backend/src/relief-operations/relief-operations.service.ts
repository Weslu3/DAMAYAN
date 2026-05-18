import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateReliefOperationDto } from './dto/create-relief-operation.dto.js';
import { UpdateReliefOperationDto } from './dto/update-relief-operation.dto.js';

interface ReliefOperationRow {
  id: string;
  disaster_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  lead_agency_id: string | null;
  lead_officer_id: string | null;
  status: string | null;
  created_at: string | null;
}

@Injectable()
export class ReliefOperationsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string, disasterId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('relief_operations')
      .select('id, disaster_id, name, description, start_date, end_date, lead_agency_id, lead_officer_id, status, created_at')
      .order('start_date', { ascending: false });

    if (disasterId) {
      query = query.eq('disaster_id', disasterId);
    }

    const { data, error } = await query;

    if (error) {
      throw new NotFoundException(error.message);
    }

    const operations = ((data ?? []) as ReliefOperationRow[]).map((row) =>
      this.toReliefOperation(row),
    );

    if (!search) {
      return operations;
    }

    const searchText = search.toLowerCase();
    return operations.filter(
      (operation) =>
        operation.name.toLowerCase().includes(searchText) ||
        operation.status.toLowerCase().includes(searchText) ||
        operation.description?.toLowerCase().includes(searchText),
    );
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_operations')
      .select('id, disaster_id, name, description, start_date, end_date, lead_agency_id, lead_officer_id, status, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Relief operation with ID ${id} not found`);
    }

    return this.toReliefOperation(data as ReliefOperationRow);
  }

  async create(createReliefOperationDto: CreateReliefOperationDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_operations')
      .insert({
        disaster_id: createReliefOperationDto.disasterId,
        name: createReliefOperationDto.name,
        description: createReliefOperationDto.description ?? null,
        start_date: createReliefOperationDto.startDate,
        end_date: createReliefOperationDto.endDate ?? null,
        lead_agency_id: createReliefOperationDto.leadAgencyId ?? null,
        lead_officer_id: createReliefOperationDto.leadOfficerId,
        status: createReliefOperationDto.status ?? 'planned',
      })
      .select('id, disaster_id, name, description, start_date, end_date, lead_agency_id, lead_officer_id, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toReliefOperation(data as ReliefOperationRow);
  }

  async update(id: string, updateReliefOperationDto: UpdateReliefOperationDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_operations')
      .update({
        disaster_id: updateReliefOperationDto.disasterId ?? existing.disasterId,
        name: updateReliefOperationDto.name ?? existing.name,
        description: updateReliefOperationDto.description ?? existing.description ?? null,
        start_date: updateReliefOperationDto.startDate ?? existing.startDate,
        end_date: updateReliefOperationDto.endDate ?? existing.endDate ?? null,
        lead_agency_id: updateReliefOperationDto.leadAgencyId ?? existing.leadAgencyId ?? null,
        lead_officer_id: updateReliefOperationDto.leadOfficerId ?? existing.leadOfficerId ?? null,
        status: updateReliefOperationDto.status ?? existing.status,
      })
      .eq('id', id)
      .select('id, disaster_id, name, description, start_date, end_date, lead_agency_id, lead_officer_id, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toReliefOperation(data as ReliefOperationRow);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('relief_operations').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const operations = await this.findAll();
    return {
      totalOperations: operations.length,
      activeOperations: operations.filter((operation) =>
        ['active', 'ongoing', 'in-progress'].includes(operation.status.toLowerCase()),
      ).length,
      completedOperations: operations.filter((operation) =>
        ['completed', 'closed'].includes(operation.status.toLowerCase()),
      ).length,
    };
  }

  private toReliefOperation(row: ReliefOperationRow) {
    return {
      id: row.id,
      disasterId: row.disaster_id,
      name: row.name,
      description: row.description ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      leadAgencyId: row.lead_agency_id ?? undefined,
      leadOfficerId: row.lead_officer_id ?? undefined,
      status: row.status ?? 'planned',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
