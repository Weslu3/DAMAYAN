import { BadRequestException, Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

type VolunteerRow = Record<string, unknown>;
type BayanihubClient = SupabaseClient<any, 'public', any>;

interface BayanihubVolunteerApplication extends VolunteerRow {
  id: string;
  role_id?: string | null;
  volunteer_auth_id?: string | null;
  status?: string | null;
  applied_at?: string | null;
  qr_scanned_at?: string | null;
}

interface BayanihubVolunteerRole extends VolunteerRow {
  id: string;
  title?: string | null;
  location?: string | null;
}

interface BayanihubVolunteerDeployment extends VolunteerRow {
  id: string;
  application_id?: string | null;
}

interface BayanihubVolunteerShift extends VolunteerRow {
  id: string;
  volunteer_auth_id?: string | null;
  application_id?: string | null;
}

interface BayanihubVolunteerTaskAssignment extends VolunteerRow {
  id: string;
  deployment_id?: string | null;
}

interface BayanihubVolunteerDataset {
  applications: BayanihubVolunteerApplication[];
  rolesById: Map<string, BayanihubVolunteerRole>;
  deploymentsByApplicationId: Map<string, BayanihubVolunteerDeployment[]>;
  shiftsByApplicationId: Map<string, BayanihubVolunteerShift[]>;
  shiftsByVolunteerAuthId: Map<string, BayanihubVolunteerShift[]>;
  tasksByDeploymentId: Map<string, BayanihubVolunteerTaskAssignment[]>;
  usersById: Map<string, User>;
}

export interface DispatcherVolunteerUnit {
  id: string;
  type: 'FIRE' | 'AMB' | 'POL';
  name: string;
  station: string;
  status: 'Available' | 'On Route' | 'On Scene' | 'Offline';
  lat: number;
  lng: number;
  personnel: number;
  distance: string;
  eta: string;
  teamLeader: string;
  contact: string;
  plateNumber: string;
  lastActive: string;
}

export interface DispatcherVolunteerTeam {
  id: string;
  type: 'FIRE' | 'AMB' | 'POL';
  name: string;
  station: string;
  status: 'Ready' | 'Deployed' | 'Standby' | 'Offline';
  leader: string;
  contact: string;
  members: number;
  vehicles: number;
  coverage: string;
  equipment: string[];
}

@Injectable()
export class BayanihubVolunteersService {
  private getClient(): BayanihubClient {
    const url = process.env.BAYANIHUB_SUPABASE_URL;
    const key =
      process.env.BAYANIHUB_SUPABASE_SERVICE_ROLE_KEY ??
      process.env.BAYANIHUB_ANON_KEY;

    if (!url || !key) {
      throw new BadRequestException(
        'Missing Bayanihub Supabase configuration. Set BAYANIHUB_SUPABASE_URL and BAYANIHUB_SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async findVolunteerUnits(search?: string): Promise<DispatcherVolunteerUnit[]> {
    const supabase = this.getClient();
    const dataset = await this.loadVolunteerDataset(supabase);
    const units = dataset.applications.map((application, index) =>
      this.toDispatcherUnit(application, dataset, index),
    );

    if (!search?.trim()) {
      return units;
    }

    const query = search.trim().toLowerCase();
    return units.filter((unit) =>
      [unit.id, unit.name, unit.station, unit.teamLeader, unit.contact, unit.type, unit.status]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }

  async findVolunteerRoleTeams(search?: string): Promise<DispatcherVolunteerTeam[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('volunteer_roles')
      .select('*')
      .limit(500);

    this.throwIfSupabaseError('volunteer_roles', error);

    const teams = ((data ?? []) as BayanihubVolunteerRole[]).map((role, index) =>
      this.toDispatcherTeam(role, index),
    );

    if (!search?.trim()) {
      return teams;
    }

    const query = search.trim().toLowerCase();
    return teams.filter((team) =>
      [team.id, team.name, team.station, team.status, team.coverage, team.equipment.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }

  private async loadVolunteerDataset(supabase: BayanihubClient): Promise<BayanihubVolunteerDataset> {
    const [
      applicationsResult,
      rolesResult,
      deploymentsResult,
      shiftsResult,
      tasksResult,
      usersById,
    ] = await Promise.all([
      supabase.from('volunteer_applications').select('*').limit(500),
      supabase.from('volunteer_roles').select('*').limit(500),
      supabase.from('volunteer_deployments').select('*').limit(500),
      supabase.from('volunteer_shifts').select('*').limit(500),
      supabase.from('volunteer_task_assignments').select('*').limit(500),
      this.loadAuthUsers(supabase),
    ]);

    this.throwIfSupabaseError('volunteer_applications', applicationsResult.error);
    this.throwIfSupabaseError('volunteer_roles', rolesResult.error);
    this.throwIfSupabaseError('volunteer_deployments', deploymentsResult.error);
    this.throwIfSupabaseError('volunteer_shifts', shiftsResult.error);
    this.throwIfSupabaseError('volunteer_task_assignments', tasksResult.error);

    const applications = ((applicationsResult.data ?? []) as BayanihubVolunteerApplication[])
      .filter((application) => this.isApprovedApplication(application));
    const roles = (rolesResult.data ?? []) as BayanihubVolunteerRole[];
    const deployments = (deploymentsResult.data ?? []) as BayanihubVolunteerDeployment[];
    const shifts = (shiftsResult.data ?? []) as BayanihubVolunteerShift[];
    const tasks = (tasksResult.data ?? []) as BayanihubVolunteerTaskAssignment[];

    return {
      applications,
      rolesById: this.indexOne(roles, 'id'),
      deploymentsByApplicationId: this.indexMany(deployments, 'application_id'),
      shiftsByApplicationId: this.indexMany(shifts, 'application_id'),
      shiftsByVolunteerAuthId: this.indexMany(shifts, 'volunteer_auth_id'),
      tasksByDeploymentId: this.indexMany(tasks, 'deployment_id'),
      usersById,
    };
  }

  private async loadAuthUsers(supabase: BayanihubClient): Promise<Map<string, User>> {
    const usersById = new Map<string, User>();

    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return usersById;

      for (const user of data.users ?? []) {
        usersById.set(user.id, user);
      }
    } catch {
      return usersById;
    }

    return usersById;
  }

  private toDispatcherUnit(
    application: BayanihubVolunteerApplication,
    dataset: BayanihubVolunteerDataset,
    index: number,
  ): DispatcherVolunteerUnit {
    const role = application.role_id ? dataset.rolesById.get(application.role_id) : undefined;
    const deployments = dataset.deploymentsByApplicationId.get(application.id) ?? [];
    const latestDeployment = this.latestByDate(deployments, ['date_assigned', 'date_completed']);
    const shifts = [
      ...(dataset.shiftsByApplicationId.get(application.id) ?? []),
      ...(application.volunteer_auth_id ? dataset.shiftsByVolunteerAuthId.get(application.volunteer_auth_id) ?? [] : []),
    ];
    const latestShift = this.latestByDate(shifts, ['clock_in', 'clock_out', 'created_at']);
    const activeTasks = latestDeployment
      ? dataset.tasksByDeploymentId.get(latestDeployment.id) ?? []
      : [];
    const latestTask = this.latestByDate(activeTasks, ['assigned_at', 'completed_at']);
    const user = application.volunteer_auth_id ? dataset.usersById.get(application.volunteer_auth_id) : undefined;

    const rawId = application.volunteer_auth_id || application.id || String(index + 1);
    const metadata = (user?.user_metadata ?? {}) as VolunteerRow;
    const firstName = this.pickString(metadata, ['first_name', 'firstname', 'given_name', 'firstName']);
    const lastName = this.pickString(metadata, ['last_name', 'lastname', 'surname', 'lastName']);
    const fullName =
      this.pickString(metadata, ['full_name', 'fullname', 'name', 'display_name', 'displayName']) ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      user?.email?.split('@')[0] ||
      `Volunteer ${index + 1}`;
    const skills =
      this.pickString(application, ['skills', 'skill', 'specialization', 'specialty', 'category', 'type', 'role']) ||
      this.pickString(role ?? {}, ['title', 'description', 'requirements', 'tasks']);
    const currentTask =
      this.pickString(latestTask ?? {}, ['task_title', 'notes']) ||
      this.pickString(latestDeployment ?? {}, ['task_description']);
    const updatedAt =
      this.pickString(latestShift ?? {}, ['clock_in', 'clock_out', 'created_at']) ||
      this.pickString(latestTask ?? {}, ['assigned_at', 'completed_at']) ||
      this.pickString(latestDeployment ?? {}, ['date_assigned', 'date_completed']) ||
      this.pickString(application, ['qr_scanned_at', 'applied_at']);

    return {
      id: this.formatVolunteerId(rawId, index),
      type: this.resolveUnitType(skills),
      name: currentTask ? `${fullName} - ${currentTask}` : fullName,
      station:
        this.pickString(role ?? {}, ['location']) ||
        this.pickString(metadata, ['address', 'location', 'barangay', 'city', 'municipality', 'province']) ||
        'Bayanihub Volunteer Pool',
      status: this.resolveStatus(application, latestDeployment, latestShift, latestTask),
      lat:
        this.pickNumber(role ?? {}, ['lat', 'latitude']) ??
        this.pickNumber(metadata, ['lat', 'latitude', 'current_latitude']) ??
        14.6042,
      lng:
        this.pickNumber(role ?? {}, ['lng', 'lon', 'longitude']) ??
        this.pickNumber(metadata, ['lng', 'lon', 'longitude', 'current_longitude']) ??
        120.9822,
      personnel: 1,
      distance: '-',
      eta: '-',
      teamLeader: fullName,
      contact:
        user?.phone ||
        this.pickString(metadata, ['phone', 'phone_number', 'mobile', 'contact_number', 'email']) ||
        user?.email ||
        'No contact listed',
      plateNumber: role?.title || 'Volunteer',
      lastActive: updatedAt ? this.formatDateTime(updatedAt) : 'Not recorded',
    };
  }

  private isApprovedApplication(application: BayanihubVolunteerApplication): boolean {
    const status = this.pickString(application, ['status'])?.toLowerCase();
    return Boolean(status && /approved|accepted|verified|active/.test(status));
  }

  private toDispatcherTeam(role: BayanihubVolunteerRole, index: number): DispatcherVolunteerTeam {
    const slotsTotal = this.pickNumber(role, ['slots_total']) ?? 0;
    const slotsFilled = this.pickNumber(role, ['slots_filled']) ?? 0;
    const location = this.pickString(role, ['location']) || 'Location not listed';
    const startDate = this.pickString(role, ['start_date']);
    const endDate = this.pickString(role, ['end_date']);
    const dateRange = [startDate, endDate].filter(Boolean).join(' to ');
    const requirements = this.pickString(role, ['requirements']);
    const tasks = this.pickTaskList(role.tasks);

    return {
      id: role.id || `volunteer-role-${index + 1}`,
      type: this.resolveUnitType(this.pickString(role, ['title', 'description', 'requirements', 'tasks'])),
      name: this.pickString(role, ['title']) || `Volunteer Role ${index + 1}`,
      station: location,
      status: this.resolveTeamStatus(this.pickString(role, ['status']), slotsFilled, slotsTotal),
      leader: 'Bayanihub Role',
      contact: dateRange || 'Schedule not listed',
      members: slotsFilled,
      vehicles: Math.max(slotsTotal - slotsFilled, 0),
      coverage: location,
      equipment: [requirements, ...tasks].filter((value): value is string => Boolean(value)),
    };
  }

  private formatVolunteerId(rawId: string, index: number): string {
    const suffix = rawId.replace(/-/g, '').slice(-6).toUpperCase() || String(index + 1).padStart(6, '0');
    return `VOL-${suffix}`;
  }

  private resolveUnitType(skills?: string): 'FIRE' | 'AMB' | 'POL' {
    const text = (skills ?? '').toLowerCase();
    if (/medical|medic|nurse|doctor|health|first aid|ambulance|emt/.test(text)) return 'AMB';
    if (/fire|rescue|search|water|evac|hazard|disaster/.test(text)) return 'FIRE';
    return 'POL';
  }

  private resolveStatus(
    application: BayanihubVolunteerApplication,
    deployment?: BayanihubVolunteerDeployment,
    shift?: BayanihubVolunteerShift,
    task?: BayanihubVolunteerTaskAssignment,
  ): DispatcherVolunteerUnit['status'] {
    const status = [
      this.pickString(task ?? {}, ['status']),
      this.pickString(deployment ?? {}, ['status']),
      this.pickString(shift ?? {}, ['status']),
      this.pickString(application, ['availability', 'status']),
    ].filter(Boolean).join(' ').toLowerCase();
    const isAvailable = this.pickBoolean(application, ['is_available', 'available', 'active']);

    if (status && /offline|inactive|unavailable|disabled/.test(status)) return 'Offline';
    if (status && /complete|completed|done|closed/.test(status)) return 'Available';
    if (status && /clocked.?in|active|in.?progress|ongoing|started|scene|onsite|on.?site/.test(status)) return 'On Scene';
    if (status && /route|en.?route|deployed|assigned|pending|accepted/.test(status)) return 'On Route';
    if (isAvailable === false) return 'Offline';
    return 'Available';
  }

  private resolveTeamStatus(status: string | undefined, slotsFilled: number, slotsTotal: number): DispatcherVolunteerTeam['status'] {
    const text = (status ?? '').toLowerCase();
    if (/closed|cancelled|canceled|inactive|archived/.test(text)) return 'Offline';
    if (/filled|full/.test(text) || (slotsTotal > 0 && slotsFilled >= slotsTotal)) return 'Deployed';
    if (/draft|pending|standby/.test(text)) return 'Standby';
    return 'Ready';
  }

  private pickString(row: VolunteerRow, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (Array.isArray(value) && value.length > 0) return value.join(', ');
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  }

  private pickNumber(row: VolunteerRow, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = row[key];
      const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
      if (Number.isFinite(number)) return number;
    }
    return undefined;
  }

  private pickBoolean(row: VolunteerRow, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string' && ['true', 'false'].includes(value.toLowerCase())) {
        return value.toLowerCase() === 'true';
      }
    }
    return undefined;
  }

  private pickTaskList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return this.stringifyStructuredValue(value).map((item) => `Task: ${item}`);
    }

    return value
      .map((task) => {
        if (typeof task === 'string') return task.trim();
        if (!task || typeof task !== 'object') return undefined;

        const row = task as VolunteerRow;
        const title = this.pickString(row, ['title', 'task_title', 'name']);
        const description = this.pickString(row, ['description', 'details', 'notes']);

        if (title && description) return `${title}: ${description}`;
        return title || description;
      })
      .filter((task): task is string => Boolean(task));
  }

  private stringifyStructuredValue(value: unknown): string[] {
    if (value == null) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (Array.isArray(value)) return value.flatMap((item) => this.stringifyStructuredValue(item));
    if (typeof value === 'object') {
      const row = value as VolunteerRow;
      const title = this.pickString(row, ['title', 'task_title', 'name']);
      const description = this.pickString(row, ['description', 'details', 'notes']);
      if (title && description) return [`${title}: ${description}`];
      if (title || description) return [title || description].filter((item): item is string => Boolean(item));
    }
    return [];
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  private throwIfSupabaseError(table: string, error: { message: string } | null): void {
    if (!error) return;
    throw new BadRequestException(`Unable to load Bayanihub ${table}: ${error.message}`);
  }

  private indexOne<T extends VolunteerRow>(rows: T[], key: string): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of rows) {
      const id = this.pickString(row, [key]);
      if (id) map.set(id, row);
    }
    return map;
  }

  private indexMany<T extends VolunteerRow>(rows: T[], key: string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const id = this.pickString(row, [key]);
      if (!id) continue;
      const existing = map.get(id) ?? [];
      existing.push(row);
      map.set(id, existing);
    }
    return map;
  }

  private latestByDate<T extends VolunteerRow>(rows: T[], keys: string[]): T | undefined {
    return [...rows].sort((a, b) => this.latestTimestamp(b, keys) - this.latestTimestamp(a, keys))[0];
  }

  private latestTimestamp(row: VolunteerRow, keys: string[]): number {
    for (const key of keys) {
      const value = this.pickString(row, [key]);
      if (!value) continue;
      const time = new Date(value).getTime();
      if (Number.isFinite(time)) return time;
    }
    return 0;
  }
}
