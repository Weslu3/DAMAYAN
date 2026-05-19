import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateCitizenDto } from './dto/create-citizen.dto.js';
import { UpdateCitizenDto } from './dto/update-citizen.dto.js';
import { CreateFamilyDto } from './dto/create-family.dto.js';
import { UpdateFamilyDto } from './dto/update-family.dto.js';
import { CreateAnimalDto } from './dto/create-animal.dto.js';

interface CitizenRow {
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  gender: string | null;
  registration_type: string | null;
  qr_code_id: string | null;
  blood_type: string | null;
  medical_conditions: string | null;
  created_at: string | null;
  family_id: string | null;
}

interface FamilyRow {
  id: string;
  qr_code_id: string;
  head_user_id: string | null;
  head_full_name: string | null;
  family_member_name: string | null;
  relationship: string | null;
  user_id: string | null;
  family_member_count: number | null;
  age: number | null;
  accessibility_needs: string | null;
  created_at: string | null;
}

interface AnimalRow {
  id: string;
  user_id: string | null;
  family_id: string | null;
  name: string;
  species: string;
  needs_cage: boolean;
  created_at: string | null;
}

@Injectable()
export class RegistrationsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findCitizens(search?: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('register_citizens')
      .select('user_id, full_name, birth_date, gender, registration_type, qr_code_id, blood_type, medical_conditions, created_at, family_id')
      .order('created_at', { ascending: false });

    if (error) {
      throw new NotFoundException(error.message);
    }

    let citizens = ((data ?? []) as CitizenRow[]).map((row) => this.toCitizen(row));
    if (search) {
      const searchText = search.toLowerCase();
      citizens = citizens.filter(
        (citizen) =>
          citizen.fullName?.toLowerCase().includes(searchText) ||
          citizen.qrCodeId?.toLowerCase().includes(searchText) ||
          citizen.registrationType?.toLowerCase().includes(searchText),
      );
    }

    if (citizens.length > 0) {
      const userIds = citizens.map(c => c.userId);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('auth_user_id, phone, profile_photo_key, first_name, last_name')
        .in('auth_user_id', userIds);

      if (profiles) {
        const profileMap = new Map(profiles.map((p: any) => [p.auth_user_id, p]));
        citizens = citizens.map(c => {
          const p = profileMap.get(c.userId);
          // Use user_profiles name as fallback when register_citizens.full_name is empty
          const profileFullName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '';
          const resolvedFullName = c.fullName || profileFullName || undefined;
          const resolvedFirstName = c.firstName !== 'Unknown' ? c.firstName : (p?.first_name ?? c.firstName);
          const resolvedLastName = c.lastName !== 'User' ? c.lastName : (p?.last_name ?? c.lastName);
          return {
            ...c,
            fullName: resolvedFullName,
            firstName: resolvedFirstName,
            lastName: resolvedLastName,
            phone: p?.phone,
            profilePhotoKey: p?.profile_photo_key,
          };
        });
      }
    }

    return citizens;
  }

  async findCitizen(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('register_citizens')
      .select('user_id, full_name, birth_date, gender, registration_type, qr_code_id, blood_type, medical_conditions, created_at, family_id')
      .eq('user_id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Citizen profile for user ${id} not found`);
    }

    return this.toCitizen(data as CitizenRow);
  }

  async createCitizen(createCitizenDto: CreateCitizenDto) {
    if (!createCitizenDto.userId) {
      throw new BadRequestException('userId is required');
    }

    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('register_citizens')
      .upsert({
        user_id: createCitizenDto.userId,
        full_name: createCitizenDto.fullName || this.buildFullName(
          createCitizenDto.firstName,
          createCitizenDto.lastName,
          createCitizenDto.middleName,
        ),
        birth_date: createCitizenDto.birthDate ?? null,
        gender: createCitizenDto.gender ?? null,
        registration_type: createCitizenDto.registrationType,
        family_id: createCitizenDto.familyId ?? null,
        blood_type: createCitizenDto.bloodType ?? null,
        medical_conditions: createCitizenDto.medicalConditions ?? null,
        qr_code_id: createCitizenDto.qrCodeId,
      })
      .select()
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toCitizen(data as CitizenRow);
  }

  async updateCitizen(id: string, updateCitizenDto: UpdateCitizenDto) {
    const existing = await this.findCitizen(id);
    const supabase = this.supabaseService.getClient() as any;
    
    const { data, error } = await supabase
      .from('register_citizens')
      .update({
        full_name: updateCitizenDto.fullName || this.buildFullName(
          updateCitizenDto.firstName,
          updateCitizenDto.lastName,
          updateCitizenDto.middleName,
        ),
        birth_date: updateCitizenDto.birthDate ?? existing.birthDate ?? null,
        gender: updateCitizenDto.gender ?? existing.gender ?? null,
        registration_type: updateCitizenDto.registrationType ?? existing.registrationType ?? null,
        qr_code_id: updateCitizenDto.qrCodeId ?? existing.qrCodeId ?? null,
        family_id: updateCitizenDto.familyId ?? existing.familyId ?? null,
        blood_type: updateCitizenDto.bloodType ?? existing.bloodType ?? null,
        medical_conditions: updateCitizenDto.medicalConditions ?? existing.medicalConditions ?? null,
      })
      .eq('user_id', id)
      .select()
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toCitizen(data as CitizenRow);
  }

  async deleteCitizen(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('register_citizens').delete().eq('user_id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async findFamilies(search?: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('families')
      .select('id, qr_code_id, head_user_id, created_at, head_full_name, family_member_name, relationship, user_id, family_member_count, age, accessibility_needs')
      .order('created_at', { ascending: false });

    if (error) {
      throw new NotFoundException(error.message);
    }

    const grouped = new Map<string, FamilyRow[]>();
    for (const row of (data ?? []) as FamilyRow[]) {
      const groupKey = row.qr_code_id;
      const current = grouped.get(groupKey) ?? [];
      current.push(row);
      grouped.set(groupKey, current);
    }

    const families = Array.from(grouped.values()).map((rows) => this.toFamily(rows));
    if (!search) {
      return families;
    }

    const searchText = search.toLowerCase();
    return families.filter(
      (family) =>
        family.headFullName?.toLowerCase().includes(searchText) ||
        family.qrCodeId.toLowerCase().includes(searchText) ||
        family.members.some((member: any) =>
          member.name.toLowerCase().includes(searchText) ||
          member.relationship?.toLowerCase().includes(searchText),
        ),
    );
  }

  async findFamily(id: string) {
    const families = await this.findFamilies();
    const family = families.find((entry) => entry.id === id || entry.qrCodeId === id);
    if (!family) {
      throw new NotFoundException(`Family record ${id} not found`);
    }
    return family;
  }

  async createFamily(createFamilyDto: CreateFamilyDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('families')
      .insert({
        qr_code_id: createFamilyDto.qrCodeId,
        head_user_id: createFamilyDto.headUserId ?? null,
        head_full_name: createFamilyDto.headFullName,
        family_member_name: createFamilyDto.familyMemberName ?? null,
        relationship: createFamilyDto.relationship ?? null,
        user_id: createFamilyDto.userId ?? null,
        family_member_count: createFamilyDto.familyMemberCount ?? 1,
        age: createFamilyDto.age ?? null,
        accessibility_needs: createFamilyDto.accessibilityNeeds ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toFamily([data as FamilyRow]);
  }

  async updateFamily(id: string, updateFamilyDto: UpdateFamilyDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('families')
      .update({
        qr_code_id: updateFamilyDto.qrCodeId,
        head_user_id: updateFamilyDto.headUserId,
        head_full_name: updateFamilyDto.headFullName,
        family_member_name: updateFamilyDto.familyMemberName,
        relationship: updateFamilyDto.relationship,
        user_id: updateFamilyDto.userId,
        age: updateFamilyDto.age,
        accessibility_needs: updateFamilyDto.accessibilityNeeds,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toFamily([data as FamilyRow]);
  }

  async deleteFamily(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('families').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async createAnimal(createAnimalDto: CreateAnimalDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('household_animals')
      .insert({
        user_id: createAnimalDto.userId ?? null,
        qr_code_id: createAnimalDto.qrCodeId ?? null,
        name: createAnimalDto.name,
        species: createAnimalDto.species,
        needs_cage: createAnimalDto.needsCage ?? false,
      })
      .select()
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return data;
  }

  async deleteFamilyMembersByQr(qrCodeId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase
      .from('families')
      .delete()
      .eq('qr_code_id', qrCodeId);
    if (error) throw new Error(error.message);
  }

  async deleteAnimalsByUser(userId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase
      .from('household_animals')
      .delete()
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  async findFamiliesByHead(headUserId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('head_user_id', headUserId);
    if (error) throw new Error(error.message);
    return data;
  }

  async findAnimalsByUser(userId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('household_animals')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data;
  }

  async getStats() {
    const [citizens, families] = await Promise.all([
      this.findCitizens(),
      this.findFamilies(),
    ]);

    return {
      totalCitizens: citizens.length,
      totalFamilies: families.length,
      qrRegisteredCitizens: citizens.filter((citizen) => citizen.qrCodeId).length,
    };
  }

  private toCitizen(row: CitizenRow) {
    const parsedName = this.parseFullName(row.full_name ?? '');

    return {
      id: row.user_id,
      userId: row.user_id,
      fullName: row.full_name ?? undefined,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      birthDate: row.birth_date ?? undefined,
      gender: row.gender ?? undefined,
      registrationType: row.registration_type ?? undefined,
      qrCodeId: row.qr_code_id ?? undefined,
      familyId: row.family_id ?? undefined,
      bloodType: row.blood_type ?? undefined,
      medicalConditions: row.medical_conditions ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async findProfilePhotoFromStorage(email: string, role: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const prefix = `${role.toLowerCase()}/${email.trim().toLowerCase()}/`;
    const { data, error } = await supabase.storage
      .from('government-ids')
      .list(prefix, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
    if (error || !data?.length) return null;
    return `${prefix}${data[0].name}`;
  }

  async saveProfilePhotoKey(userId: string, photoKey: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    await supabase
      .from('user_profiles')
      .update({ profile_photo_key: photoKey })
      .eq('auth_user_id', userId);
  }

  private parseFullName(fullName: string) {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return { firstName: 'Unknown', lastName: 'User', middleName: undefined as string | undefined };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '', middleName: undefined as string | undefined };
    }

    if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1], middleName: undefined as string | undefined };
    }

    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  private buildFullName(firstName?: string, lastName?: string, middleName?: string) {
    return [firstName, middleName, lastName].filter((part) => !!part && part.trim().length > 0).join(' ');
  }

  private toFamily(rows: FamilyRow[]) {
    const head = rows[0];
    return {
      id: head.id,
      qrCodeId: head.qr_code_id,
      headUserId: head.head_user_id ?? undefined,
      headFullName: head.head_full_name ?? undefined,
      members: rows
        .filter((row) => row.family_member_name)
        .map((row) => ({
          id: row.id,
          name: row.family_member_name as string,
          relationship: row.relationship ?? undefined,
          userId: row.user_id ?? undefined,
          age: row.age ?? undefined,
          accessibilityNeeds: row.accessibility_needs ?? undefined,
        })),
      createdAt: head.created_at ? new Date(head.created_at) : new Date(),
    };
  }
}
