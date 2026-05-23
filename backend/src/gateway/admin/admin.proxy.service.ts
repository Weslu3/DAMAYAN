import * as net from 'net';
import { randomUUID } from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service.js';
import { CreateItemDto } from '../../inventory/dto/create-item.dto.js';
import { UpdateItemDto } from '../../inventory/dto/update-item.dto.js';
import { AdjustQuantityDto } from '../../inventory/dto/adjust-quantity.dto.js';
import { CreateOrganizationDto } from '../../organizations/dto/create-organization.dto.js';
import { UpdateOrganizationDto } from '../../organizations/dto/update-organization.dto.js';
import { CreateDisasterEventDto } from '../../disaster-events/dto/create-disaster-event.dto.js';
import { UpdateDisasterEventDto } from '../../disaster-events/dto/update-disaster-event.dto.js';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from '../../dispatch-orders/dto/update-dispatch-order.dto.js';
import { CreateReliefOperationDto } from '../../relief-operations/dto/create-relief-operation.dto.js';
import { UpdateReliefOperationDto } from '../../relief-operations/dto/update-relief-operation.dto.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../incident-reports/dto/update-incident-report.dto.js';
import { CreateDistributionDto } from '../../distributions/dto/create-distribution.dto.js';
import { UpdateDistributionDto } from '../../distributions/dto/update-distribution.dto.js';
import { CreateCitizenDto } from '../../registrations/dto/create-citizen.dto.js';
import { UpdateCitizenDto } from '../../registrations/dto/update-citizen.dto.js';
import { CreateFamilyDto } from '../../registrations/dto/create-family.dto.js';
import { UpdateFamilyDto } from '../../registrations/dto/update-family.dto.js';
import { CreateDisasterCoverUploadDto } from '../../uploads/dto/create-disaster-cover-upload.dto.js';
import { CreateIncidentAttachmentUploadDto } from '../../uploads/dto/create-incident-attachment-upload.dto.js';
import { CreateObjectViewUrlDto } from '../../uploads/dto/create-object-view-url.dto.js';
import { CreateWarningBroadcastDto } from './dto/create-warning-broadcast.dto.js';

@Injectable()
export class AdminProxyService {
  constructor(
    @Inject(SiteManagerProxyService) private readonly siteManagerProxyService: SiteManagerProxyService,
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(InAppNotificationsService) private readonly inAppNotificationsService: InAppNotificationsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  getDashboard() {
    return this.siteManagerProxyService.getDashboard('admin');
  }

  async findPendingApprovals() {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, phone, role, profile_photo_key, status, reject_reason, created_at')
      .in('role', ['dispatcher', 'line_manager'])
      .in('status', ['pending', 'active', 'rejected'])
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const approvals = await Promise.all(
      ((data ?? []) as any[]).map(async (profile) => {
        const authResult = await supabase.auth.admin.getUserById(profile.auth_user_id);
        const email = authResult?.data?.user?.email ?? null;

        return {
          id: profile.id,
          authUserId: profile.auth_user_id,
          firstName: profile.first_name,
          lastName: profile.last_name,
          email,
          phone: profile.phone,
          role: profile.role,
          governmentIdKey: profile.profile_photo_key,
          status: profile.status,
          rejectReason: profile.reject_reason,
          createdAt: profile.created_at,
        };
      }),
    );

    return approvals;
  }

  async approvePendingUser(id: string) {
    const supabase = this.supabaseService.getClient() as any;

    const { data: existing, error: existingError } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, role, status')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(existingError.message);
    }

    if (!existing) {
      throw new NotFoundException('User profile not found');
    }

    if (existing.status !== 'pending') {
      throw new BadRequestException(`User is already ${existing.status}`);
    }

    if (!['dispatcher', 'line_manager'].includes(existing.role)) {
      throw new BadRequestException('Only dispatchers and line managers require approval');
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        status: 'active',
        reject_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, auth_user_id, first_name, last_name, role, status, reject_reason, updated_at')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    void this.inAppNotificationsService.send(
      data.auth_user_id,
      'Account Approved',
      `Your ${data.role.replace('_', ' ')} account has been approved. You can now log in.`,
      'approval_approved',
    );

    return {
      id: data.id,
      authUserId: data.auth_user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      status: data.status,
      rejectReason: data.reject_reason,
      updatedAt: data.updated_at,
    };
  }

  async rejectPendingUser(id: string, rejectReason: string) {
    const reason = rejectReason?.trim();
    if (!reason) {
      throw new BadRequestException('rejectReason is required when rejecting a user');
    }

    const supabase = this.supabaseService.getClient() as any;

    const { data: existing, error: existingError } = await supabase
      .from('user_profiles')
      .select('id, role, status')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(existingError.message);
    }

    if (!existing) {
      throw new NotFoundException('User profile not found');
    }

    if (existing.status !== 'pending') {
      throw new BadRequestException(`User is already ${existing.status}`);
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        status: 'rejected',
        reject_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, auth_user_id, first_name, last_name, role, status, reject_reason, updated_at')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    void this.inAppNotificationsService.send(
      data.auth_user_id,
      'Account Not Approved',
      `Your account application was not approved. Reason: ${reason}`,
      'approval_rejected',
      { rejectReason: reason },
    );

    return {
      id: data.id,
      authUserId: data.auth_user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      status: data.status,
      rejectReason: data.reject_reason,
      updatedAt: data.updated_at,
    };
  }

  async getSystemHealth(): Promise<{ name: string; status: 'operational' | 'degraded' | 'down'; latencyMs: number; note?: string }[]> {
    const results: { name: string; status: 'operational' | 'degraded' | 'down'; latencyMs: number; note?: string }[] = [];

    // 1. API Gateway — always operational (we are responding right now)
    results.push({ name: 'API Gateway', status: 'operational', latencyMs: 0, note: 'This service' });

    // 2. Database (Supabase) — lightweight head-only count
    const dbStart = Date.now();
    try {
      const supabase = this.supabaseService.getClient() as any;
      const { error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true });
      const dbLatency = Date.now() - dbStart;
      results.push({
        name: 'Database',
        status: error ? 'degraded' : 'operational',
        latencyMs: dbLatency,
        note: error?.message,
      });
    } catch (e: any) {
      results.push({ name: 'Database', status: 'down', latencyMs: Date.now() - dbStart, note: e?.message });
    }

    // 3. Operations Service — TCP socket probe
    const opsHost = this.configService?.get<string>('OPERATIONS_SERVICE_HOST') ?? process.env.OPERATIONS_SERVICE_HOST ?? '127.0.0.1';
    const opsPort = Number(this.configService?.get<string>('OPERATIONS_SERVICE_PORT') ?? process.env.OPERATIONS_SERVICE_PORT ?? 4002);
    const opsResult = await this.probeTcp('Operations Service', opsHost, opsPort, 3000);
    results.push(opsResult);

    // 4. Auth Service — TCP socket probe
    const authHost = this.configService?.get<string>('AUTH_SERVICE_HOST') ?? process.env.AUTH_SERVICE_HOST ?? '127.0.0.1';
    const authPort = Number(this.configService?.get<string>('AUTH_SERVICE_PORT') ?? process.env.AUTH_SERVICE_PORT ?? 4001);
    const authResult = await this.probeTcp('Auth Service', authHost, authPort, 3000);
    results.push(authResult);

    return results;
  }

  async broadcastWarning(payload: CreateWarningBroadcastDto) {
    const message = payload.message.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    if (!payload.useSMS && !payload.usePush) {
      throw new BadRequestException('Select at least one broadcast channel');
    }

    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('auth_user_id, phone');

    if (error) {
      throw new BadRequestException(error.message);
    }

    const profiles = (data ?? []) as Array<{ auth_user_id?: string; phone?: string | null }>;
    const emailTargets = new Set<string>();
    const smsTargets = new Set<string>();

    for (const profile of profiles) {
      if (payload.usePush && profile.auth_user_id) {
        const authResult = await supabase.auth.admin.getUserById(profile.auth_user_id);
        const email = authResult?.data?.user?.email?.trim();
        if (email) {
          emailTargets.add(email);
        }
      }

      if (payload.useSMS && profile.phone) {
        const phone = String(profile.phone).trim();
        if (phone) {
          smsTargets.add(phone);
        }
      }
    }

    const subject = `DAMAYAN ${payload.severity.toUpperCase()} ALERT: ${payload.type}`;
    const body = [
      `Type: ${payload.type}`,
      `Severity: ${payload.severity}`,
      `Areas: ${payload.areas.join(', ') || 'N/A'}`,
      ``,
      message,
    ].join('\n');

    let attempted = 0;
    let delivered = 0;

    if (payload.usePush) {
      for (const email of emailTargets) {
        attempted += 1;
        const sent = await this.notificationsService.sendBroadcastEmail(email, subject, body);
        if (sent) {
          delivered += 1;
        }
      }
    }

    if (payload.useSMS) {
      for (const phone of smsTargets) {
        attempted += 1;
        const sent = await this.notificationsService.sendBroadcastSms(phone, `${subject}\n${message}`);
        if (sent) {
          delivered += 1;
        }
      }
    }

    await this.createLiveAlert(payload, subject, body);

    // Send in-app notification to every registered user
    const allUserIds = profiles
      .map((p) => p.auth_user_id)
      .filter((uid): uid is string => Boolean(uid));
    void this.inAppNotificationsService.sendToMany(
      allUserIds,
      subject,
      message,
      'alert',
      { type: payload.type, severity: payload.severity, areas: payload.areas },
    );

    return {
      type: payload.type,
      severity: payload.severity,
      areas: payload.areas,
      attempted,
      delivered,
      failed: Math.max(0, attempted - delivered),
      channels: {
        sms: payload.useSMS,
        push: payload.usePush,
      },
    };
  }

  private async createLiveAlert(payload: CreateWarningBroadcastDto, title: string, message: string) {
    const supabase = this.supabaseService.getClient() as any;
    const scope = payload.areas.length > 0 ? 'barangay' : 'all';

    const { error } = await supabase.from('drm_alerts').insert({
      id: randomUUID(),
      dispatcher_id: null,
      scope,
      target: payload.areas.length > 0 ? payload.areas.join(', ') : null,
      title,
      message,
      severity: payload.severity,
      disaster_type: payload.type,
      evacuation_center: null,
      instructions: [payload.message],
    });

    if (error) {
      console.warn(`[AdminProxyService] Failed to persist live alert: ${error.message}`);
    }
  }

  private probeTcp(
    name: string,
    host: string,
    port: number,
    timeoutMs: number,
  ): Promise<{ name: string; status: 'operational' | 'down'; latencyMs: number; note?: string }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.connect(port, host, () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ name, status: 'operational', latencyMs });
      });
      socket.on('error', (err: Error) => {
        socket.destroy();
        resolve({ name, status: 'down', latencyMs: Date.now() - start, note: err.message });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ name, status: 'down', latencyMs: timeoutMs, note: 'Connection timed out' });
      });
    });
  }

  findInventory(search?: string) {
    return this.siteManagerProxyService.findInventory(search);
  }

  getInventoryStats() {
    return this.siteManagerProxyService.getInventoryStats();
  }

  findCapacity(search?: string) {
    return this.siteManagerProxyService.findCapacity(search);
  }

  getCapacityStats() {
    return this.siteManagerProxyService.getCapacityStats();
  }

  findOrganizations(search?: string) {
    return this.siteManagerProxyService.findOrganizations(search);
  }

  createOrganization(createOrganizationDto: CreateOrganizationDto) {
    return this.siteManagerProxyService.createOrganization(createOrganizationDto);
  }

  updateOrganization(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    return this.siteManagerProxyService.updateOrganization(id, updateOrganizationDto);
  }

  deleteOrganization(id: string) {
    return this.siteManagerProxyService.deleteOrganization(id);
  }

  getOrganizationStats() {
    return this.siteManagerProxyService.getOrganizationStats();
  }

  findDisasterEvents(search?: string) {
    return this.siteManagerProxyService.findDisasterEvents(search);
  }

  createDisasterEvent(createDisasterEventDto: CreateDisasterEventDto) {
    return this.siteManagerProxyService.createDisasterEvent(createDisasterEventDto);
  }

  updateDisasterEvent(id: string, updateDisasterEventDto: UpdateDisasterEventDto) {
    return this.siteManagerProxyService.updateDisasterEvent(id, updateDisasterEventDto);
  }

  deleteDisasterEvent(id: string) {
    return this.siteManagerProxyService.deleteDisasterEvent(id);
  }

  getDisasterEventStats() {
    return this.siteManagerProxyService.getDisasterEventStats();
  }

  findDispatchOrders(search?: string, operationId?: string, disasterId?: string) {
    return this.siteManagerProxyService.findDispatchOrders(search, operationId, disasterId);
  }

  createDispatchOrder(createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.siteManagerProxyService.createDispatchOrder(createDispatchOrderDto);
  }

  updateDispatchOrder(id: string, updateDispatchOrderDto: UpdateDispatchOrderDto) {
    return this.siteManagerProxyService.updateDispatchOrder(id, updateDispatchOrderDto);
  }

  deleteDispatchOrder(id: string) {
    return this.siteManagerProxyService.deleteDispatchOrder(id);
  }

  getDispatchOrderStats() {
    return this.siteManagerProxyService.getDispatchOrderStats();
  }

  findReliefOperations(search?: string, disasterId?: string) {
    return this.siteManagerProxyService.findReliefOperations(search, disasterId);
  }

  createReliefOperation(createReliefOperationDto: CreateReliefOperationDto) {
    return this.siteManagerProxyService.createReliefOperation(createReliefOperationDto);
  }

  updateReliefOperation(id: string, updateReliefOperationDto: UpdateReliefOperationDto) {
    return this.siteManagerProxyService.updateReliefOperation(id, updateReliefOperationDto);
  }

  deleteReliefOperation(id: string) {
    return this.siteManagerProxyService.deleteReliefOperation(id);
  }

  getReliefOperationStats() {
    return this.siteManagerProxyService.getReliefOperationStats();
  }

  findIncidentReports(search?: string, disasterId?: string) {
    return this.siteManagerProxyService.findIncidentReports(search, disasterId);
  }

  createIncidentReport(createIncidentReportDto: CreateIncidentReportDto) {
    return this.siteManagerProxyService.createIncidentReport(createIncidentReportDto);
  }

  updateIncidentReport(id: string, updateIncidentReportDto: UpdateIncidentReportDto) {
    return this.siteManagerProxyService.updateIncidentReport(id, updateIncidentReportDto);
  }

  deleteIncidentReport(id: string) {
    return this.siteManagerProxyService.deleteIncidentReport(id);
  }

  getIncidentReportStats() {
    return this.siteManagerProxyService.getIncidentReportStats();
  }

  findDistributions(search?: string, operationId?: string) {
    return this.siteManagerProxyService.findDistributions(search, operationId);
  }

  createDistribution(createDistributionDto: CreateDistributionDto) {
    return this.siteManagerProxyService.createDistribution(createDistributionDto);
  }

  updateDistribution(id: string, updateDistributionDto: UpdateDistributionDto) {
    return this.siteManagerProxyService.updateDistribution(id, updateDistributionDto);
  }

  deleteDistribution(id: string) {
    return this.siteManagerProxyService.deleteDistribution(id);
  }

  getDistributionStats() {
    return this.siteManagerProxyService.getDistributionStats();
  }

  findCitizens(search?: string) {
    return this.siteManagerProxyService.findCitizens(search);
  }

  createCitizen(createCitizenDto: CreateCitizenDto) {
    return this.siteManagerProxyService.createCitizen(createCitizenDto);
  }

  updateCitizen(id: string, updateCitizenDto: UpdateCitizenDto) {
    return this.siteManagerProxyService.updateCitizen(id, updateCitizenDto);
  }

  deleteCitizen(id: string) {
    return this.siteManagerProxyService.deleteCitizen(id);
  }

  findFamilies(search?: string) {
    return this.siteManagerProxyService.findFamilies(search);
  }

  createFamily(createFamilyDto: CreateFamilyDto) {
    return this.siteManagerProxyService.createFamily(createFamilyDto);
  }

  updateFamily(id: string, updateFamilyDto: UpdateFamilyDto) {
    return this.siteManagerProxyService.updateFamily(id, updateFamilyDto);
  }

  deleteFamily(id: string) {
    return this.siteManagerProxyService.deleteFamily(id);
  }

  getRegistrationStats() {
    return this.siteManagerProxyService.getRegistrationStats();
  }

  createDisasterCoverUploadUrl(
    createDisasterCoverUploadDto: CreateDisasterCoverUploadDto,
  ) {
    return this.siteManagerProxyService.createDisasterCoverUploadUrl(
      createDisasterCoverUploadDto,
    );
  }

  createIncidentAttachmentUploadUrl(
    createIncidentAttachmentUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    return this.siteManagerProxyService.createIncidentAttachmentUploadUrl(
      createIncidentAttachmentUploadDto,
    );
  }

  createObjectViewUrl(createObjectViewUrlDto: CreateObjectViewUrlDto) {
    return this.siteManagerProxyService.createObjectViewUrl(createObjectViewUrlDto);
  }

  findCheckIns(search?: string) {
    return this.siteManagerProxyService.findCheckIns(search);
  }

  getCheckInStats() {
    return this.siteManagerProxyService.getCheckInStats();
  }

  getRecentCheckIns(limit?: number) {
    return this.siteManagerProxyService.getRecentCheckIns(limit);
  }

  createInventoryItem(createItemDto: CreateItemDto) {
    return this.siteManagerProxyService.createInventoryItem(createItemDto);
  }

  updateInventoryItem(id: string, updateItemDto: UpdateItemDto) {
    return this.siteManagerProxyService.updateInventoryItem(id, updateItemDto);
  }

  adjustInventoryItem(id: string, adjustQuantityDto: AdjustQuantityDto) {
    return this.siteManagerProxyService.adjustInventoryItem(id, adjustQuantityDto);
  }
}
