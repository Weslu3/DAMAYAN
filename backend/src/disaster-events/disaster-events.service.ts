import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateDisasterEventDto } from './dto/create-disaster-event.dto.js';
import { UpdateDisasterEventDto } from './dto/update-disaster-event.dto.js';

interface DisasterEventRow {
  id: string;
  name: string;
  type: string;
  severity_level: string;
  affected_areas: string[] | null;
  province: string | null;
  date_started: string;
  date_ended: string | null;
  status: string | null;
  declared_by: string | null;
  cover_image_key: string | null;
  notes: string | null;
  created_at: string | null;
}

@Injectable()
export class DisasterEventsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('disaster_events')
      .select('id, name, type, severity_level, affected_areas, province, date_started, date_ended, status, declared_by, cover_image_key, notes, created_at')
      .order('date_started', { ascending: false });

    if (error) {
      throw new NotFoundException(error.message);
    }

    const events = ((data ?? []) as DisasterEventRow[]).map((row) => this.toEvent(row));

    if (!search) {
      return events;
    }

    const query = search.toLowerCase();
    return events.filter(
      (event) =>
        event.name.toLowerCase().includes(query) ||
        event.type.toLowerCase().includes(query) ||
        event.status.toLowerCase().includes(query) ||
        event.province.toLowerCase().includes(query) ||
        event.affectedAreas.some((area: string) => area.toLowerCase().includes(query)),
    );
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('disaster_events')
      .select('id, name, type, severity_level, affected_areas, province, date_started, date_ended, status, declared_by, cover_image_key, notes, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Disaster event with ID ${id} not found`);
    }

    return this.toEvent(data as DisasterEventRow);
  }

  async create(createDisasterEventDto: CreateDisasterEventDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('disaster_events')
      .insert({
        name: createDisasterEventDto.name,
        type: createDisasterEventDto.type,
        severity_level: createDisasterEventDto.severityLevel,
        affected_areas: createDisasterEventDto.affectedAreas,
        province: createDisasterEventDto.province,
        date_started: createDisasterEventDto.dateStarted,
        date_ended: createDisasterEventDto.dateEnded ?? null,
        status: createDisasterEventDto.status ?? 'monitoring',
        declared_by: createDisasterEventDto.declaredBy,
        cover_image_key: createDisasterEventDto.coverImageKey ?? null,
        notes: createDisasterEventDto.notes ?? null,
      })
      .select('id, name, type, severity_level, affected_areas, province, date_started, date_ended, status, declared_by, cover_image_key, notes, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toEvent(data as DisasterEventRow);
  }

  async update(id: string, updateDisasterEventDto: UpdateDisasterEventDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('disaster_events')
      .update({
        name: updateDisasterEventDto.name ?? existing.name,
        type: updateDisasterEventDto.type ?? existing.type,
        severity_level: updateDisasterEventDto.severityLevel ?? existing.severityLevel,
        affected_areas: updateDisasterEventDto.affectedAreas ?? existing.affectedAreas,
        province: updateDisasterEventDto.province ?? existing.province,
        date_started: updateDisasterEventDto.dateStarted ?? existing.dateStarted,
        date_ended: updateDisasterEventDto.dateEnded ?? existing.dateEnded ?? null,
        status: updateDisasterEventDto.status ?? existing.status,
        declared_by: updateDisasterEventDto.declaredBy ?? existing.declaredBy ?? null,
        cover_image_key: updateDisasterEventDto.coverImageKey ?? existing.coverImageKey ?? null,
        notes: updateDisasterEventDto.notes ?? existing.notes ?? null,
      })
      .eq('id', id)
      .select('id, name, type, severity_level, affected_areas, province, date_started, date_ended, status, declared_by, cover_image_key, notes, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toEvent(data as DisasterEventRow);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('disaster_events').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const events = await this.findAll();
    return {
      totalEvents: events.length,
      activeEvents: events.filter((event) => event.status.toLowerCase() === 'active').length,
      severeEvents: events.filter((event) =>
        ['high', 'severe', 'critical'].includes(event.severityLevel.toLowerCase()),
      ).length,
    };
  }

  async findActive() {
    const events = await this.findAll();
    // Return first 'active' or just the most recent one if none marked active
    let active = events.find(e => e.status?.toLowerCase() === 'active') || events[0];
    if (!active) {
      try {
        active = await this.create({
          name: 'Super Typhoon Pepito',
          type: 'Typhoon',
          severityLevel: 'Severe',
          affectedAreas: ['Metro Manila', 'Brgy. 102'],
          province: 'Metro Manila',
          dateStarted: new Date().toISOString(),
          status: 'active',
          declaredBy: 'PAGASA',
          notes: 'Automatically generated active disaster event.',
        });
      } catch (err) {
        console.error('Failed to auto-create active disaster event:', err);
      }
    }
    return active;
  }

  private toEvent(row: DisasterEventRow) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      severityLevel: row.severity_level,
      affectedAreas: row.affected_areas ?? [],
      province: row.province ?? 'Unknown Province',
      dateStarted: row.date_started,
      dateEnded: row.date_ended ?? undefined,
      status: row.status ?? 'monitoring',
      declaredBy: row.declared_by ?? undefined,
      coverImageKey: row.cover_image_key ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
