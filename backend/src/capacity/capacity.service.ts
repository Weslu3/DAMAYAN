import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

type CapacityStatus = 'low' | 'medium' | 'high' | 'full';

interface EvacuationCenterRow {
  id: string;
  name: string | null;
  address: string | null;
  barangay: string | null;
  municipality: string | null;
  capacity: number | null;
  current_occupancy: number | null;
  facilities: string[] | null;
  contact_person: string | null;
  contact_phone: string | null;
  status: string | null;
  max_managers: number | null;
  lat?: number | null;
  lng?: number | null;
  description: string | null;
}

interface ShelterAssignmentRow {
  center_id: string;
  manager_id: string;
}

interface UserProfileRow {
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface CapacityCenter {
  id: string;
  name: string;
  address: string;
  municipality: string;
  barangay: string;
  capacity: number;
  currentOccupancy: number;
  availableSlots: number;
  utilizationRate: number;
  status: CapacityStatus;
  facilities: string[];
  contactPerson?: string;
  contactPhone?: string;
  dbStatus?: string;
  maxManagers?: number;
  description?: string;
  assignedManagers?: Array<{ id: string; name: string }>;
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable()
export class CapacityService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string): Promise<CapacityCenter[]> {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('evacuation_centers')
      .select(
        'id, name, address, barangay, municipality, capacity, current_occupancy, facilities, contact_person, contact_phone, status, lat, lng',
      )
      .order('name', { ascending: true });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,barangay.ilike.%${search}%,municipality.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    const centers = (data ?? []) as EvacuationCenterRow[];

    const { data: assignments } = await supabase
      .from('shelter_assignments')
      .select('center_id, manager_id');

    const managerIds = ((assignments ?? []) as ShelterAssignmentRow[]).map((assignment) => assignment.manager_id);
    const { data: profiles } = managerIds.length
      ? await supabase
          .from('user_profiles')
          .select('auth_user_id, first_name, last_name')
          .in('auth_user_id', managerIds)
      : { data: [], error: null };

    const profileMap = new Map(
      ((profiles ?? []) as UserProfileRow[]).map((profile) => [profile.auth_user_id, profile]),
    );

    const assignmentMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const assignment of (assignments ?? []) as ShelterAssignmentRow[]) {
      const profile = profileMap.get(assignment.manager_id);
      const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
      const current = assignmentMap.get(assignment.center_id) ?? [];
      current.push({ id: assignment.manager_id, name: name || assignment.manager_id });
      assignmentMap.set(assignment.center_id, current);
    }

    return centers.map((row: EvacuationCenterRow) =>
      this.toCapacityCenter(row, assignmentMap.get(row.id) ?? []),
    );
  }

  async getStats() {
    const centers = await this.findAll();
    const totalCapacity = centers.reduce(
      (sum: number, center: CapacityCenter) => sum + center.capacity,
      0,
    );
    const totalOccupancy = centers.reduce(
      (sum: number, center: CapacityCenter) => sum + center.currentOccupancy,
      0,
    );

    return {
      totalCenters: centers.length,
      totalCapacity,
      totalOccupancy,
      availableSlots: Math.max(0, totalCapacity - totalOccupancy),
      fullCenters: centers.filter(
        (center: CapacityCenter) => center.status === 'full',
      ).length,
      highUtilizationCenters: centers.filter(
        (center: CapacityCenter) =>
          center.status === 'high' || center.status === 'full',
      ).length,
    };
  }

  private toCapacityCenter(row: EvacuationCenterRow, assignedManagers: Array<{ id: string; name: string }>): CapacityCenter {
    const capacity = row.capacity ?? 0;
    const currentOccupancy = row.current_occupancy ?? 0;
    const availableSlots = Math.max(0, capacity - currentOccupancy);
    const utilizationRate =
      capacity > 0 ? Math.min(100, Math.round((currentOccupancy / capacity) * 100)) : 0;

    return {
      id: row.id,
      name: row.name ?? 'Unnamed Center',
      address: row.address ?? 'No address provided',
      municipality: row.municipality ?? 'Unknown Municipality',
      barangay: row.barangay ?? 'Unknown Barangay',
      capacity,
      currentOccupancy,
      availableSlots,
      utilizationRate,
      status: this.getStatus(utilizationRate, availableSlots),
      facilities: row.facilities ?? [],
      contactPerson: row.contact_person ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      dbStatus: row.status ?? undefined,
      maxManagers: row.max_managers ?? undefined,
      description: row.description ?? undefined,
      assignedManagers,
      latitude: row.lat ?? null,
      longitude: row.lng ?? null,
    };
  }

  private getStatus(
    utilizationRate: number,
    availableSlots: number,
  ): CapacityStatus {
    if (availableSlots <= 0 || utilizationRate >= 100) return 'full';
    if (utilizationRate >= 85) return 'high';
    if (utilizationRate >= 50) return 'medium';
    return 'low';
  }
}
