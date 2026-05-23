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
        this.siteManagerProxyService.findIncidentReports(search, disasterId),
        this.siteManagerProxyService.findDispatchOrders(undefined, undefined, disasterId),
        this.siteManagerProxyService.findOrganizations(),
        this.siteManagerProxyService.findDisasterEvents(),
        this.siteManagerProxyService.findReliefOperations(undefined, disasterId),
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

  findResources(search?: string) {
    return this.siteManagerProxyService.findOrganizations(search);
  }

  findVolunteerUnits(search?: string) {
    return this.bayanihubVolunteersService.findVolunteerUnits(search);
  }

  findVolunteerTeams(search?: string) {
    return this.bayanihubVolunteersService.findVolunteerRoleTeams(search);
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
