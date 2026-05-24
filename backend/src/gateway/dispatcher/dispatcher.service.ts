import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service.js';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from '../../dispatch-orders/dto/update-dispatch-order.dto.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../incident-reports/dto/update-incident-report.dto.js';
import { CreateDispatcherBroadcastDto } from './dto/create-dispatcher-broadcast.dto.js';
import { BayanihubVolunteersService } from './bayanihub-volunteers.service.js';

interface UserProfileRow {
  auth_user_id?: string | null;
}

interface PhCityCatalogRow {
  psgc_code: string;
  city_name: string;
  province_name: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
}

interface TeamStatusRow {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  duty_status: string;
  municipality: string | null;
  province: string | null;
  barangay: string | null;
  address: string | null;
}

interface DispatcherResourceRow {
  id: string;
  name: string;
  type: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  verified: boolean;
}

interface DispatcherProfileRow {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  created_at: string | null;
}

@Injectable()
export class DispatcherService {
  constructor(
    @Inject(SiteManagerProxyService)
    private readonly siteManagerProxyService: SiteManagerProxyService,
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
    @Inject(InAppNotificationsService)
    private readonly inAppNotificationsService: InAppNotificationsService,
    @Inject(BayanihubVolunteersService)
    private readonly bayanihubVolunteersService: BayanihubVolunteersService,
  ) {}

  async getOverview(search?: string, disasterId?: string) {
    const [incidentReports, dispatchOrders, organizations, disasterEvents, reliefOperations, volunteerUnits, volunteerTeams] =
      await Promise.all([
        this.siteManagerProxyService.findIncidentReports(search, disasterId).catch((error: unknown) => {
          console.warn(`[DispatcherService] findIncidentReports failed: ${error instanceof Error ? error.message : error}`);
          return [];
        }),
        this.siteManagerProxyService.findDispatchOrders(undefined, undefined, disasterId).catch((error: unknown) => {
          console.warn(`[DispatcherService] findDispatchOrders failed: ${error instanceof Error ? error.message : error}`);
          return [];
        }),
        this.findResources().catch((error: unknown) => {
          console.warn(`[DispatcherService] findResources failed: ${error instanceof Error ? error.message : error}`);
          return [];
        }),
        this.siteManagerProxyService.findDisasterEvents().catch((error: unknown) => {
          console.warn(`[DispatcherService] findDisasterEvents failed: ${error instanceof Error ? error.message : error}`);
          return [];
        }),
        this.siteManagerProxyService.findReliefOperations(undefined, disasterId).catch((error: unknown) => {
          console.warn(`[DispatcherService] findReliefOperations failed: ${error instanceof Error ? error.message : error}`);
          return [];
        }),
        this.bayanihubVolunteersService.findVolunteerUnits().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown Bayanihub volunteer loading error';
          console.warn(`[DispatcherService] ${message}`);
          return [];
        }),
        this.bayanihubVolunteersService.findVolunteerRoleTeams().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown Bayanihub volunteer role loading error';
          console.warn(`[DispatcherService] ${message}`);
          return [];
        }),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      incidentReports,
      dispatchOrders,
      organizations,
      disasterEvents,
      reliefOperations,
      volunteerUnits,
      volunteerTeams,
    };
  }

  async getProfile(dispatcherAuthUserId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const [{ data: profile, error: profileError }, authResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, auth_user_id, first_name, last_name, phone, address, barangay, municipality, province, created_at')
        .eq('auth_user_id', dispatcherAuthUserId)
        .maybeSingle(),
      supabase.auth.admin.getUserById(dispatcherAuthUserId),
    ]);

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    if (!profile) {
      throw new BadRequestException('Dispatcher profile not found');
    }

    const row = profile as DispatcherProfileRow;
    const totalDispatches = await this.countDispatches(dispatcherAuthUserId);
    const resolvedToday = await this.countResolvedToday(dispatcherAuthUserId);
    const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
    const initials = `${row.first_name?.[0] ?? ''}${row.last_name?.[0] ?? ''}`.toUpperCase() || 'DS';

    return {
      id: row.id,
      authUserId: row.auth_user_id,
      name: fullName,
      username: authResult?.data?.user?.email?.split('@')[0] ?? fullName.toLowerCase().replace(/\s+/g, '.'),
      email: authResult?.data?.user?.email ?? '',
      phone: row.phone ?? '',
      badge: this.buildBadge(row),
      rank: this.resolveRank(totalDispatches),
      cluster: this.resolveCluster(row),
      station: this.resolveStation(row),
      initials,
      joinedDate: this.formatJoinedDate(row.created_at),
      totalDispatches,
      resolvedToday,
    };
  }

  findIncidentReports(search?: string, disasterId?: string) {
    return this.siteManagerProxyService.findIncidentReports(search, disasterId);
  }

  createIncidentReport(payload: CreateIncidentReportDto) {
    return this.siteManagerProxyService.createIncidentReport(payload);
  }

  updateIncidentReport(id: string, payload: UpdateIncidentReportDto) {
    return this.siteManagerProxyService.updateIncidentReport(id, payload);
  }

  deleteIncidentReport(id: string) {
    return this.siteManagerProxyService.deleteIncidentReport(id);
  }

  createDispatchOrder(payload: CreateDispatchOrderDto) {
    return this.siteManagerProxyService.createDispatchOrder(payload);
  }

  findDispatchOrders(search?: string, operationId?: string, disasterId?: string) {
    return this.siteManagerProxyService.findDispatchOrders(search, operationId, disasterId);
  }

  updateDispatchOrder(id: string, payload: UpdateDispatchOrderDto) {
    return this.siteManagerProxyService.updateDispatchOrder(id, payload);
  }

  deleteDispatchOrder(id: string) {
    return this.siteManagerProxyService.deleteDispatchOrder(id);
  }

  async findResources(search?: string): Promise<DispatcherResourceRow[]> {
    const [units, teams] = await Promise.all([
      this.bayanihubVolunteersService.findVolunteerUnits(search),
      this.bayanihubVolunteersService.findVolunteerRoleTeams(search),
    ]);

    const mappedUnits: DispatcherResourceRow[] = units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      contactEmail: '',
      contactPhone: unit.contact,
      address: unit.station,
      verified: unit.status !== 'Offline',
    }));

    const mappedTeams: DispatcherResourceRow[] = teams.map((team) => ({
      id: team.id,
      name: team.name,
      type: team.type,
      contactEmail: '',
      contactPhone: team.contact,
      address: team.station,
      verified: team.status !== 'Offline',
    }));

    const merged = [...mappedUnits, ...mappedTeams];
    const deduped = new Map<string, DispatcherResourceRow>();
    for (const item of merged) {
      deduped.set(item.id, item);
    }
    return Array.from(deduped.values());
  }

  findVolunteerUnits(search?: string) {
    return this.bayanihubVolunteersService.findVolunteerUnits(search);
  }

  findVolunteerTeams(search?: string) {
    return this.bayanihubVolunteersService.findVolunteerRoleTeams(search);
  }

  async getBarangayData(province?: string) {
    const supabase = this.supabaseService.getClient() as any;

    let query = supabase
      .from('ph_city_catalog')
      .select('psgc_code, city_name, province_name, region_name, latitude, longitude')
      .order('city_name', { ascending: true });

    if (province) {
      query = query.ilike('province_name', `%${province}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new BadRequestException(error.message);
    }

    return ((data ?? []) as PhCityCatalogRow[]).map((row) => ({
      psgcCode: row.psgc_code,
      name: row.city_name,
      province: row.province_name ?? null,
      region: row.region_name ?? null,
      coordinates: [row.latitude, row.longitude] as [number, number],
    }));
  }

  async getTeamStatus() {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, role, duty_status, municipality, province, barangay, address')
      .eq('role', 'line_manager')
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return ((data ?? []) as TeamStatusRow[]).map((row) => ({
      id: row.id,
      authUserId: row.auth_user_id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      role: 'Site Manager',
      location: row.municipality || row.province || row.barangay || row.address || 'Unassigned',
      dutyStatus: row.duty_status as 'on_duty' | 'off_duty',
    }));
  }

  async setDutyStatus(targetAuthUserId: string, dutyStatus: 'on_duty' | 'off_duty') {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase
      .from('user_profiles')
      .update({ duty_status: dutyStatus, updated_at: new Date().toISOString() })
      .eq('auth_user_id', targetAuthUserId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { authUserId: targetAuthUserId, dutyStatus };
  }

  private async countDispatches(dispatcherAuthUserId: string): Promise<number> {
    const supabase = this.supabaseService.getClient() as any;
    const { count, error } = await supabase
      .from('dispatch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', dispatcherAuthUserId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return count ?? 0;
  }

  private async countResolvedToday(dispatcherAuthUserId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const supabase = this.supabaseService.getClient() as any;
    const { count, error } = await supabase
      .from('dispatch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', dispatcherAuthUserId)
      .eq('status', 'completed')
      .gte('updated_at', start.toISOString());

    if (error) {
      throw new BadRequestException(error.message);
    }

    return count ?? 0;
  }

  private buildBadge(profile: DispatcherProfileRow): string {
    const source = profile.id || profile.auth_user_id;
    return `DS-${source.replace(/-/g, '').slice(-4).toUpperCase()}`;
  }

  private resolveRank(totalDispatches: number): string {
    if (totalDispatches >= 1000) return 'Senior Dispatcher';
    if (totalDispatches >= 250) return 'Dispatcher II';
    return 'Dispatcher I';
  }

  private resolveCluster(profile: DispatcherProfileRow): string {
    return profile.municipality || profile.province || profile.barangay || 'Unassigned Cluster';
  }

  private resolveStation(profile: DispatcherProfileRow): string {
    if (profile.address) return profile.address;
    if (profile.municipality) return `${profile.municipality} Command Center`;
    return 'Unassigned Command Center';
  }

  private formatJoinedDate(createdAt: string | null): string {
    if (!createdAt) return 'Not recorded';
    return new Date(createdAt).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async createVolunteerDispatch(payload: {
    reportId: string;
    assignedTo: string;
    volunteerName?: string;
    priority?: string;
    instructions?: string;
    disasterId?: string;
  }) {
    const priorityMap: Record<string, string> = {
      low: 'low', medium: 'normal', high: 'urgent', critical: 'critical',
    };
    const dbPriority = priorityMap[payload.priority?.toLowerCase() ?? ''] ?? 'normal';

    const instructionParts: string[] = [];
    if (payload.volunteerName) instructionParts.push(`Volunteer: ${payload.volunteerName}`);
    if (payload.instructions) instructionParts.push(payload.instructions);
    const instructions = instructionParts.join(' | ') || null;

    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('dispatch_orders')
      .insert({
        report_id: payload.reportId,
        assigned_to: payload.assignedTo,
        external_volunteer_id: null,
        priority: dbPriority,
        instructions,
        disaster_id: payload.disasterId ?? null,
        operation_id: null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { id: (data as { id: string }).id };
  }

  async broadcast(dispatcherAuthUserId: string, payload: CreateDispatcherBroadcastDto) {
    const message = payload.message?.trim();
    if (!message) {
      throw new BadRequestException('Broadcast message is required');
    }

    const severity = payload.severity ?? 'warning';
    const type = payload.type ?? 'Dispatcher Broadcast';
    const title = payload.title?.trim() || `${severity.toUpperCase()} ${type}`;
    const areas = payload.areas?.filter(Boolean) ?? [];
    const supabase = this.supabaseService.getClient() as any;

    const { error: alertError } = await supabase.from('drm_alerts').insert({
      id: randomUUID(),
      dispatcher_id: dispatcherAuthUserId,
      scope: areas.length > 0 ? 'barangay' : 'all',
      target: areas.length > 0 ? areas.join(', ') : null,
      title,
      message,
      severity,
      disaster_type: type,
      evacuation_center: null,
      instructions: [message],
    });

    if (alertError) {
      throw new BadRequestException(alertError.message);
    }

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('auth_user_id')
      .not('auth_user_id', 'is', null);

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    const userIds = ((profiles ?? []) as UserProfileRow[])
      .map((profile) => profile.auth_user_id)
      .filter((id): id is string => Boolean(id));

    void this.inAppNotificationsService.sendToMany(
      userIds,
      title,
      message,
      'alert',
      { source: 'dispatcher', severity, type, areas },
    );

    return {
      title,
      message,
      severity,
      type,
      areas,
      deliveredInApp: userIds.length,
    };
  }
}
