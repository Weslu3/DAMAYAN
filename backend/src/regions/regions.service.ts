import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateShelterAssignmentDto } from './dto/create-shelter-assignment.dto.js';
import { CreateRegionAssignmentDto } from './dto/create-region-assignment.dto.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { RegionPhase } from './dto/update-region-phase.dto.js';
import { AppRole } from '../../libs/contracts/src/roles.js';
import { RegionPersonaPhase, UpsertRegionPersonaPhaseDto } from './dto/upsert-region-persona-phase.dto.js';

interface RegionRow {
  id: string;
  name: string;
  current_phase: string;
  updated_at: string | null;
}

interface ShelterAssignmentRow {
  id: string;
  center_id: string;
  manager_id: string;
  assigned_at: string | null;
  updated_at: string | null;
}

interface UserProfileRow {
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface RegionPersonaPhaseControlRow {
  id: string;
  region_id: string;
  persona_role: AppRole;
  phase: RegionPersonaPhase;
  visible_to_assigned_users: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface RegionPersonaAudienceRow {
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  assigned_region_id: string | null;
}

interface RegionAssignmentRow {
  id: string;
  region_id: string;
  auth_user_id: string;
  role: string;
  assigned_at: string | null;
  assigned_by: string | null;
  expires_at: string | null;
  updated_at: string | null;
}

@Injectable()
export class RegionsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  private destinationPoint(latDeg: number, lngDeg: number, bearingDeg: number, distanceKm: number) {
    const R = 6371; // Earth radius in km
    const lat1 = (latDeg * Math.PI) / 180;
    const lng1 = (lngDeg * Math.PI) / 180;
    const brng = (bearingDeg * Math.PI) / 180;
    const dOverR = distanceKm / R;

    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinD = Math.sin(dOverR);
    const cosD = Math.cos(dOverR);

    const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(
      Math.sin(brng) * sinD * cosLat1,
      cosD - sinLat1 * Math.sin(lat2),
    );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: ((lng2 * 180) / Math.PI + 540) % 360 - 180,
    };
  }

  async createRegion(dto: CreateRegionDto) {
    const supabase = this.supabaseService.getClient() as any;

    let ewktBoundary: string;
    if (dto.radiusKm && dto.radiusKm > 0) {
      const steps = 36;
      const points: Array<{ lat: number; lng: number }> = [];
      for (let i = 0; i <= steps; i += 1) {
        const bearing = (i / steps) * 360;
        points.push(this.destinationPoint(dto.centerLat, dto.centerLng, bearing, dto.radiusKm));
      }
      const ring = points.map((p) => `${p.lng} ${p.lat}`).join(',');
      ewktBoundary = `SRID=4326;POLYGON((${ring}))`;
    } else {
      const span = dto.spanDegrees ?? 0.04;
      const latMin = dto.centerLat - span / 2;
      const latMax = dto.centerLat + span / 2;
      const lngMin = dto.centerLng - span / 2;
      const lngMax = dto.centerLng + span / 2;
      ewktBoundary = `SRID=4326;POLYGON((${lngMin} ${latMin},${lngMax} ${latMin},${lngMax} ${latMax},${lngMin} ${latMax},${lngMin} ${latMin}))`;
    }

    const { data, error } = await supabase
      .from('regions')
      .insert({
        name: dto.name.trim(),
        current_phase: dto.currentPhase ?? RegionPhase.BEFORE,
        boundary: ewktBoundary,
      })
      .select('id, name, current_phase, updated_at')
      .single();

    if (error || !data) {
      throw new ConflictException(error?.message ?? 'Failed to create region');
    }

    return {
      id: data.id,
      name: data.name,
      currentPhase: data.current_phase as RegionPhase,
      updatedAt: data.updated_at,
    };
  }

  async findAll() {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('regions')
      .select('id, name, current_phase, updated_at')
      .order('name', { ascending: true });

    if (error) {
      throw new NotFoundException(error.message);
    }

    return ((data ?? []) as RegionRow[]).map((region) => ({
      id: region.id,
      name: region.name,
      currentPhase: region.current_phase as RegionPhase,
      updatedAt: region.updated_at,
    }));
  }

  async updatePhase(id: string, newPhase: RegionPhase) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('regions')
      .update({ current_phase: newPhase, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, current_phase, updated_at')
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }

    return {
      id: data.id,
      name: data.name,
      currentPhase: data.current_phase as RegionPhase,
      updatedAt: data.updated_at,
    };
  }

  async findAssignments(centerId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('shelter_assignments')
      .select('id, center_id, manager_id, assigned_at, updated_at')
      .order('assigned_at', { ascending: false });

    if (centerId) {
      query = query.eq('center_id', centerId);
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    const assignments = (data ?? []) as ShelterAssignmentRow[];
    const managerIds = assignments.map((assignment) => assignment.manager_id);

    const { data: profiles, error: profilesError } = managerIds.length
      ? await supabase
          .from('user_profiles')
          .select('auth_user_id, first_name, last_name')
          .in('auth_user_id', managerIds)
      : { data: [], error: null };

    if (profilesError) {
      throw new NotFoundException(profilesError.message);
    }

    const profileMap = new Map(
      ((profiles ?? []) as UserProfileRow[]).map((profile) => [profile.auth_user_id, profile]),
    );

    return assignments.map((assignment) => {
      const profile = profileMap.get(assignment.manager_id);
      const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

      return {
        id: assignment.id,
        centerId: assignment.center_id,
        managerId: assignment.manager_id,
        managerName: name || assignment.manager_id,
        assignedAt: assignment.assigned_at,
        updatedAt: assignment.updated_at,
      };
    });
  }

  async createAssignment(dto: CreateShelterAssignmentDto) {
    const supabase = this.supabaseService.getClient() as any;

    const { data: center, error: centerError } = await supabase
      .from('evacuation_centers')
      .select('id, max_managers')
      .eq('id', dto.centerId)
      .maybeSingle();

    if (centerError || !center) {
      throw new NotFoundException(`Evacuation center with ID ${dto.centerId} not found`);
    }

    const { count, error: countError } = await supabase
      .from('shelter_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('center_id', dto.centerId);

    if (countError) {
      throw new NotFoundException(countError.message);
    }

    if ((count ?? 0) >= Number(center.max_managers ?? 0)) {
      throw new ConflictException('Shelter assignment capacity reached for this center');
    }

    const { data, error } = await supabase
      .from('shelter_assignments')
      .insert({
        center_id: dto.centerId,
        manager_id: dto.managerId,
      })
      .select('id, center_id, manager_id, assigned_at, updated_at')
      .single();

    if (error) {
      throw new ConflictException(error.message);
    }

    return data;
  }

  async deleteAssignment(managerId: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('shelter_assignments').delete().eq('manager_id', managerId);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async findPersonaPhaseControls(regionId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('region_persona_phase_controls')
      .select('id, region_id, persona_role, phase, visible_to_assigned_users, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (regionId) {
      query = query.eq('region_id', regionId);
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    return ((data ?? []) as RegionPersonaPhaseControlRow[]).map((control) => ({
      id: control.id,
      regionId: control.region_id,
      personaRole: control.persona_role,
      phase: control.phase,
      visibleToAssignedUsers: control.visible_to_assigned_users,
      createdAt: control.created_at,
      updatedAt: control.updated_at,
    }));
  }

  async upsertPersonaPhaseControl(regionId: string, dto: UpsertRegionPersonaPhaseDto) {
    const supabase = this.supabaseService.getClient() as any;

    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('id, name')
      .eq('id', regionId)
      .maybeSingle();

    if (regionError || !region) {
      throw new NotFoundException(`Region with ID ${regionId} not found`);
    }

    const { data, error } = await supabase
      .from('region_persona_phase_controls')
      .upsert(
        {
          region_id: regionId,
          persona_role: dto.personaRole,
          phase: dto.phase,
          visible_to_assigned_users: dto.visibleToAssignedUsers ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'region_id,persona_role' },
      )
      .select('id, region_id, persona_role, phase, visible_to_assigned_users, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new ConflictException(error?.message ?? 'Failed to save regional phase control');
    }

    const audience = await this.findPersonaPhaseAudience(regionId, dto.personaRole);

    return {
      region: {
        id: region.id,
        name: region.name,
      },
      control: {
        id: data.id,
        regionId: data.region_id,
        personaRole: data.persona_role,
        phase: data.phase,
        visibleToAssignedUsers: data.visible_to_assigned_users,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      audience,
    };
  }

  async findPersonaPhaseAudience(regionId: string, personaRole?: AppRole) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('user_profiles')
      .select('auth_user_id, first_name, last_name, role, assigned_region_id')
      .eq('assigned_region_id', regionId)
      .order('first_name', { ascending: true });

    if (personaRole) {
      query = query.eq('role', personaRole);
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    return ((data ?? []) as RegionPersonaAudienceRow[]).map((profile) => ({
      authUserId: profile.auth_user_id,
      name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.auth_user_id,
      role: profile.role,
      assignedRegionId: profile.assigned_region_id,
    }));
  }

  async getAllRegionsGeo() {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase.rpc('get_all_regions_geojson');
    if (error) throw new NotFoundException(error.message);
    return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, geojson: r.geojson }));
  }

  async getRegionGeo(regionId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase.rpc('get_region_boundary_geojson', { p_region_id: regionId });
    if (error) throw new NotFoundException(error.message);
    const geojsonText = Array.isArray(data) ? data[0] : data;
    try {
      return geojsonText ? JSON.parse(geojsonText) : null;
    } catch {
      return null;
    }
  }

  async getRegionShelters(regionId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('admin_sample_shelters')
      .select('id, name, lat, lng')
      .eq('region_id', regionId)
      .order('created_at', { ascending: true });

    if (error) throw new NotFoundException(error.message);
    return (data ?? []).map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }));
  }

  async findRegionAssignments(regionId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('region_assignments')
      .select('id, region_id, auth_user_id, role, assigned_at, assigned_by, expires_at, updated_at')
      .order('assigned_at', { ascending: false });

    if (regionId) query = query.eq('region_id', regionId);

    const { data, error } = await query;
    if (error) throw new NotFoundException(error.message);

    const assignments = (data ?? []) as RegionAssignmentRow[];
    const userIds = assignments.map((a) => a.auth_user_id);

    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from('user_profiles').select('auth_user_id, first_name, last_name, role').in('auth_user_id', userIds)
      : { data: [], error: null };

    if (profilesError) throw new NotFoundException(profilesError.message);

    const profileMap = new Map(((profiles ?? []) as any).map((p: any) => [p.auth_user_id, p]));

    return assignments.map((a) => {
      const profile = profileMap.get(a.auth_user_id);
      const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
      return {
        id: a.id,
        regionId: a.region_id,
        authUserId: a.auth_user_id,
        name: name || a.auth_user_id,
        role: a.role,
        assignedAt: a.assigned_at,
        assignedBy: a.assigned_by,
        expiresAt: a.expires_at,
        updatedAt: a.updated_at,
      };
    });
  }

  async findAvailableUsers(regionId: string, role?: string, search?: string) {
    const supabase = this.supabaseService.getClient() as any;

    // Get already assigned user ids for this region
    const { data: assignments, error: assignErr } = await supabase
      .from('region_assignments')
      .select('auth_user_id')
      .eq('region_id', regionId);

    if (assignErr) throw new NotFoundException(assignErr.message);
    const assignedIds = (assignments ?? []).map((a: any) => a.auth_user_id).filter(Boolean);

    let query = supabase
      .from('user_profiles')
      .select('auth_user_id, first_name, last_name, role, assigned_region_id')
      .order('first_name', { ascending: true });

    if (role === 'site_manager') {
      query = query.in('role', ['site_manager', 'line_manager']);
    } else if (role) {
      query = query.eq('role', role);
    }

    if (assignedIds.length) {
      // exclude already assigned users
      query = query.not('auth_user_id', 'in', `(${assignedIds.map((id: string) => `'${id}'`).join(',')})`);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      // use OR across first_name, last_name, auth_user_id
      query = query.or(`first_name.ilike.${s},last_name.ilike.${s},auth_user_id.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw new NotFoundException(error.message);

    return ((data ?? []) as any[]).map((p) => ({
      authUserId: p.auth_user_id,
      name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.auth_user_id,
      role: p.role,
      assignedRegionId: p.assigned_region_id,
    }));
  }

  async createRegionAssignment(regionId: string, dto: CreateRegionAssignmentDto, assignedBy?: string) {
    const supabase = this.supabaseService.getClient() as any;

    const { data: region, error: regionError } = await supabase.from('regions').select('id, name').eq('id', regionId).maybeSingle();
    if (regionError || !region) throw new NotFoundException(`Region with ID ${regionId} not found`);

    const { data, error } = await supabase
      .from('region_assignments')
      .insert({
        region_id: regionId,
        auth_user_id: dto.authUserId,
        role: dto.role,
        expires_at: dto.expiresAt ?? null,
        assigned_by: assignedBy ?? null,
      })
      .select('id, region_id, auth_user_id, role, assigned_at, assigned_by, expires_at, updated_at')
      .single();

    if (error || !data) throw new ConflictException(error?.message ?? 'Failed to create region assignment');

    const profileResp = await supabase.from('user_profiles').select('auth_user_id, first_name, last_name').eq('auth_user_id', dto.authUserId).maybeSingle();
    const profile = profileResp.data as any | null;
    const name = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : dto.authUserId;

    // Update user's assigned_region_id to this region (keep in sync)
    try {
      await supabase.from('user_profiles').update({ assigned_region_id: regionId, updated_at: new Date().toISOString() }).eq('auth_user_id', dto.authUserId);
    } catch (e) {
      // ignore sync failures
    }

    return {
      id: data.id,
      regionId: data.region_id,
      authUserId: data.auth_user_id,
      name,
      role: data.role,
      assignedAt: data.assigned_at,
      assignedBy: data.assigned_by,
      expiresAt: data.expires_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteRegionAssignment(assignmentId: string) {
    const supabase = this.supabaseService.getClient() as any;

    // Fetch assignment to know which user and region to reconcile
    const { data: existing, error: existingError } = await supabase.from('region_assignments').select('id, region_id, auth_user_id').eq('id', assignmentId).maybeSingle();
    if (existingError) throw new NotFoundException(existingError.message);
    if (!existing) throw new NotFoundException('Assignment not found');

    const { error } = await supabase.from('region_assignments').delete().eq('id', assignmentId);
    if (error) throw new NotFoundException(error.message);

    // If the user has no other assignments, clear their assigned_region_id
    try {
      const { data: other, error: otherErr } = await supabase.from('region_assignments').select('id').eq('auth_user_id', existing.auth_user_id).limit(1);
      if (!otherErr && Array.isArray(other) && other.length === 0) {
        await supabase.from('user_profiles').update({ assigned_region_id: null, updated_at: new Date().toISOString() }).eq('auth_user_id', existing.auth_user_id);
      }
    } catch (e) {
      // ignore reconciliation errors
    }
  }
}
