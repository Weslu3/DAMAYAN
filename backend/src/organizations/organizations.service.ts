import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

interface OrganizationRow {
  id: string;
  name: string;
  type: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  verified: boolean | null;
  created_at: string | null;
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, type, contact_email, contact_phone, address, verified, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new NotFoundException(error.message);
    }

    const organizations = ((data ?? []) as OrganizationRow[]).map((row) =>
      this.toOrganization(row),
    );

    if (!search) {
      return organizations;
    }

    const query = search.toLowerCase();
    return organizations.filter(
      (organization) =>
        organization.name.toLowerCase().includes(query) ||
        organization.type.toLowerCase().includes(query) ||
        organization.contactEmail?.toLowerCase().includes(query) ||
        organization.address?.toLowerCase().includes(query),
    );
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, type, contact_email, contact_phone, address, verified, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return this.toOrganization(data as OrganizationRow);
  }

  async create(createOrganizationDto: CreateOrganizationDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: createOrganizationDto.name,
        type: createOrganizationDto.type,
        contact_email: createOrganizationDto.contactEmail ?? null,
        contact_phone: createOrganizationDto.contactPhone ?? null,
        address: createOrganizationDto.address ?? null,
        verified: createOrganizationDto.verified ?? false,
      })
      .select('id, name, type, contact_email, contact_phone, address, verified, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toOrganization(data as OrganizationRow);
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;

    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: updateOrganizationDto.name ?? existing.name,
        type: updateOrganizationDto.type ?? existing.type,
        contact_email: updateOrganizationDto.contactEmail ?? existing.contactEmail ?? null,
        contact_phone: updateOrganizationDto.contactPhone ?? existing.contactPhone ?? null,
        address: updateOrganizationDto.address ?? existing.address ?? null,
        verified: updateOrganizationDto.verified ?? existing.verified,
      })
      .eq('id', id)
      .select('id, name, type, contact_email, contact_phone, address, verified, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toOrganization(data as OrganizationRow);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const organizations = await this.findAll();
    return {
      totalOrganizations: organizations.length,
      verifiedOrganizations: organizations.filter((organization) => organization.verified)
        .length,
      organizationTypes: Array.from(new Set(organizations.map((organization) => organization.type)))
        .length,
    };
  }

  private toOrganization(row: OrganizationRow) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      address: row.address ?? undefined,
      verified: row.verified ?? false,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
