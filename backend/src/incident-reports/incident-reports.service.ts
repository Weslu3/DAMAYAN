import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateIncidentReportDto } from './dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from './dto/update-incident-report.dto.js';

interface IncidentReportRow {
  id: string;
  disaster_id: string;
  reported_by: string;
  title: string;
  content: string;
  severity: string;
  location: string;
  attachment_keys: string[] | null;
  status: string | null;
  created_at: string | null;
}

@Injectable()
export class IncidentReportsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string, disasterId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('incident_reports')
      .select('id, disaster_id, reported_by, title, content, severity, location, attachment_keys, status, created_at')
      .order('created_at', { ascending: false });

    if (disasterId) {
      query = query.eq('disaster_id', disasterId);
    }

    const { data, error } = await query;

    if (error) {
      throw new NotFoundException(error.message);
    }

    const reports = ((data ?? []) as IncidentReportRow[]).map((row) =>
      this.toIncidentReport(row),
    );

    if (!search) {
      return reports;
    }

    const searchText = search.toLowerCase();
    return reports.filter(
      (report) =>
        report.title.toLowerCase().includes(searchText) ||
        report.content.toLowerCase().includes(searchText) ||
        report.severity.toLowerCase().includes(searchText) ||
        report.location.toLowerCase().includes(searchText),
    );
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('incident_reports')
      .select('id, disaster_id, reported_by, title, content, severity, location, attachment_keys, status, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Incident report with ID ${id} not found`);
    }

    return this.toIncidentReport(data as IncidentReportRow);
  }

  async create(createIncidentReportDto: CreateIncidentReportDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('incident_reports')
      .insert({
        disaster_id: createIncidentReportDto.disasterId,
        reported_by: createIncidentReportDto.reportedBy,
        title: createIncidentReportDto.title,
        content: createIncidentReportDto.content,
        severity: createIncidentReportDto.severity,
        location: createIncidentReportDto.location,
        attachment_keys: createIncidentReportDto.attachmentKeys ?? [],
        status: createIncidentReportDto.status ?? 'pending',
      })
      .select('id, disaster_id, reported_by, title, content, severity, location, attachment_keys, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toIncidentReport(data as IncidentReportRow);
  }

  async update(id: string, updateIncidentReportDto: UpdateIncidentReportDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('incident_reports')
      .update({
        disaster_id: updateIncidentReportDto.disasterId ?? existing.disasterId,
        reported_by: updateIncidentReportDto.reportedBy ?? existing.reportedBy,
        title: updateIncidentReportDto.title ?? existing.title,
        content: updateIncidentReportDto.content ?? existing.content,
        severity: updateIncidentReportDto.severity ?? existing.severity,
        location: updateIncidentReportDto.location ?? existing.location,
        attachment_keys: updateIncidentReportDto.attachmentKeys ?? existing.attachmentKeys,
        status: updateIncidentReportDto.status ?? existing.status,
      })
      .eq('id', id)
      .select('id, disaster_id, reported_by, title, content, severity, location, attachment_keys, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toIncidentReport(data as IncidentReportRow);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('incident_reports').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const reports = await this.findAll();
    return {
      totalReports: reports.length,
      pendingReports: reports.filter((report) => report.status.toLowerCase() === 'pending').length,
      highSeverityReports: reports.filter((report) =>
        ['high', 'critical'].includes(report.severity.toLowerCase()),
      ).length,
    };
  }

  private toIncidentReport(row: IncidentReportRow) {
    return {
      id: row.id,
      disasterId: row.disaster_id,
      reportedBy: row.reported_by,
      title: row.title,
      content: row.content,
      severity: row.severity,
      location: row.location,
      attachmentKeys: row.attachment_keys ?? [],
      status: row.status ?? 'pending',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
