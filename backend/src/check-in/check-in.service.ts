import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CheckIn } from './interfaces/check-in.interface.js';
import { CreateCheckInDto } from './dto/create-check-in.dto.js';
import { ScanQrDto } from './dto/scan-qr.dto.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { FamilyGroupsService } from '../family-groups/family-groups.service.js';

type EvacueeDbStatus = 'checked_in' | 'checked_out' | string | null;

interface EvacueeRow {
  id: string;
  auth_user_id: string;
  disaster_id: string | null;
  center_id: string | null;
  family_head: string | null;
  family_size: number | null;
  special_needs: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string | null;
}

interface CitizenRow {
  user_id: string;
  full_name: string | null;
  qr_code_id: string | null;
}

interface EvacuationCenterRow {
  id: string;
  name: string | null;
  barangay: string | null;
}

@Injectable()
export class CheckInService {
  constructor(
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
    @Inject(FamilyGroupsService) private readonly familyGroupsService: FamilyGroupsService,
  ) {}

  async findAll(search?: string): Promise<CheckIn[]> {
    const supabase = this.supabaseService.getClient() as any;
    const { data: evacuees, error: evacueesError } = await supabase
      .from('evacuees')
      .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
      .order('check_in_date', { ascending: false, nullsFirst: false });

    if (evacueesError) throw new NotFoundException(evacueesError.message);

    const rows = (evacuees ?? []) as EvacueeRow[];

    const authUserIds = Array.from(
      new Set(rows.map((r) => r.auth_user_id).filter((v) => !!v)),
    );
    const centerIds = Array.from(
      new Set(rows.map((r) => r.center_id).filter((v) => !!v)),
    ) as string[];

    const { data: citizens } = authUserIds.length
      ? await supabase
          .from('register_citizens')
          .select('user_id, full_name, qr_code_id')
          .in('user_id', authUserIds)
      : { data: [] as CitizenRow[] };

    const { data: centers } = centerIds.length
      ? await supabase
          .from('evacuation_centers')
          .select('id, name, barangay')
          .in('id', centerIds)
      : { data: [] as EvacuationCenterRow[] };

    const citizenMap = new Map<string, CitizenRow>(
      (citizens ?? []).map((p: CitizenRow) => [p.user_id, p]),
    );
    const centerMap = new Map<string, EvacuationCenterRow>(
      (centers ?? []).map((c: EvacuationCenterRow) => [c.id, c]),
    );

    const mapped = rows.map((row) => {
      const citizen = citizenMap.get(row.auth_user_id);
      const center = row.center_id ? centerMap.get(row.center_id) : undefined;
      return this.toCheckIn(row, citizen, center);
    });

    if (search) {
      const q = search.toLowerCase();
      return mapped.filter(
        (c) =>
          c.evacueeId?.toLowerCase().includes(q) ||
          c.status?.toLowerCase().includes(q) ||
          c.zone?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q),
      );
    }

    return mapped;
  }

  async findOne(id: string): Promise<CheckIn> {
    const supabase = this.supabaseService.getClient() as any;
    const { data: evacuee, error: evacueeError } = await supabase
      .from('evacuees')
      .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
      .eq('id', id)
      .maybeSingle();

    if (evacueeError || !evacuee) {
      throw new NotFoundException(`Check-in with ID ${id} not found`);
    }

    const row = evacuee as EvacueeRow;

    const { data: citizen } = await supabase
      .from('register_citizens')
      .select('user_id, full_name, qr_code_id')
      .eq('user_id', row.auth_user_id)
      .maybeSingle();

    const { data: center } = row.center_id
      ? await supabase
          .from('evacuation_centers')
          .select('id, name, barangay')
          .eq('id', row.center_id)
          .maybeSingle()
      : { data: undefined as EvacuationCenterRow | undefined };

    return this.toCheckIn(row, citizen ?? undefined, center ?? undefined);
  }

  async findByEvacueeNumber(
    evacueeNumber: string,
  ): Promise<CheckIn | undefined> {
    const supabase = this.supabaseService.getClient() as any;
    const { data } = await this.findEvacueeRecord(evacueeNumber, supabase);

    if (!data) return undefined;
    return this.findOne((data as EvacueeRow).id);
  }

  async scanQr(scanQrDto: ScanQrDto): Promise<CheckIn> {
    const raw = scanQrDto.qrCode.trim();
    const evacueeNumber = this.normalizeFamilyGroupQr(raw);

    // Family group QR codes may use FAM-* or FAMILY-GROUP-* formats.
    if (/^(FAM-|FAMILY-GROUP-)/i.test(evacueeNumber)) {
      return this.scanFamilyGroupQr(evacueeNumber, scanQrDto);
    }

    return this.createManual({ evacueeNumber, centerId: scanQrDto.centerId });
  }

  /** Check in all members of a family group at once. Returns the head's check-in record. */
  private async scanFamilyGroupQr(familyQrCodeId: string, scanQrDto: ScanQrDto): Promise<CheckIn> {
    const supabase = this.supabaseService.getClient() as any;
    const qrCandidates = this.buildFamilyQrCandidates(familyQrCodeId);

    // Resolve the group row to get head_user_id
    const { data: groupRow } = await supabase
      .from('family_groups')
      .select('id, head_user_id')
      .in('family_qr_code_id', qrCandidates)
      .maybeSingle();

    // Fetch head's citizen record and member QR codes in parallel
    const [{ data: headCitizen }, { data: memberRows }] = await Promise.all([
      groupRow
        ? supabase.from('register_citizens').select('qr_code_id, full_name').eq('user_id', groupRow.head_user_id).maybeSingle()
        : Promise.resolve({ data: null }),
      groupRow
        ? supabase
            .from('family_group_members')
            .select('citizen_qr_code_id, member_user_id, member_full_name')
            .eq('family_group_id', groupRow.id)
        : Promise.resolve({ data: [] }),
    ]);

    const members = (memberRows ?? []) as Array<{
      citizen_qr_code_id?: string | null;
      member_user_id?: string | null;
      member_full_name?: string | null;
    }>;
    const results: CheckIn[] = [];

    // Resolve head's display name — fall back to user_profiles when full_name is blank
    let headFullName: string | null = headCitizen?.full_name?.trim() || null;
    if (!headFullName && groupRow?.head_user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('auth_user_id', groupRow.head_user_id)
        .maybeSingle();
      if (profile) {
        headFullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || null;
      }
    }

    // Check in the family head first using head_user_id to avoid ambiguous QR mappings.
    if (groupRow?.head_user_id) {
      try {
        const checkIn = await this.checkInByAuthUserId(groupRow.head_user_id, headFullName, scanQrDto.centerId);
        results.push(checkIn);
      } catch (e) {
        console.error('[FAM-QR] Head auth_user_id check-in failed:', e);
      }
    } else if (headCitizen?.qr_code_id) {
      try {
        const checkIn = await this.createManual({
          evacueeNumber: headCitizen.qr_code_id,
          firstName: headFullName ?? undefined,
          centerId: scanQrDto.centerId,
        });
        results.push(checkIn);
      } catch (e) {
        console.error('[FAM-QR] Head QR check-in failed:', e);
      }
    }

    // Check in all registered members
    for (const member of members) {
      const memberQr = member.citizen_qr_code_id?.trim() || null;
      const memberAuthUserId = member.member_user_id?.trim() || null;
      const memberName = member.member_full_name?.trim() || null;

      try {
        if (memberAuthUserId) {
          const checkIn = await this.checkInByAuthUserId(memberAuthUserId, memberName, scanQrDto.centerId);
          results.push(checkIn);
          continue;
        }

        if (memberQr) {
          const checkIn = await this.createManual({ evacueeNumber: memberQr, centerId: scanQrDto.centerId });
          results.push(checkIn);
          continue;
        }
      } catch (e) {
        console.error('[FAM-QR] Member check-in failed:', {
          qr: memberQr,
          authUserId: memberAuthUserId,
          error: e,
        });
      }
    }

    if (results.length > 0) return results[0];
    throw new BadRequestException('Family group has no check-in-eligible members. Ensure members have linked citizen QR or auth users.');
  }

  /** Check in a user directly by their auth_user_id when they have no citizen QR code. */
  private async checkInByAuthUserId(authUserId: string, fullName: string | null, centerId?: string): Promise<CheckIn> {
    const supabase = this.supabaseService.getClient() as any;
    const activeDisasterId = await this.resolveActiveDisasterId(supabase);

    const { data: existing } = await supabase
      .from('evacuees')
      .select('id, status, check_in_date')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existing && (existing.status === 'checked_in') && existing.check_in_date) {
      return this.findOne(existing.id) as any;
    }

    if (existing) {
      const { data, error } = await supabase
        .from('evacuees')
        .update({
          check_in_date: this.localISOString(),
          check_out_date: null,
          status: 'checked_in',
          ...(centerId ? { center_id: centerId } : {}),
          ...(activeDisasterId && !existing.disaster_id ? { disaster_id: activeDisasterId } : {}),
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) throw new BadRequestException(error.message);
      return this.findOne((data as any).id) as any;
    }

    if (!activeDisasterId) throw new BadRequestException('No active disaster found.');
    const { data, error } = await supabase
      .from('evacuees')
      .insert({
        auth_user_id: authUserId,
        family_head: fullName || '',
        disaster_id: activeDisasterId,
        check_in_date: this.localISOString(),
        status: 'checked_in',
        ...(centerId ? { center_id: centerId } : {}),
      })
      .select('id')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.findOne((data as any).id) as any;
  }

  async createManual(createCheckInDto: CreateCheckInDto): Promise<CheckIn> {
    const { evacueeNumber, firstName, lastName, familySize, centerId } = createCheckInDto;
    const dtoFullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    const supabase = this.supabaseService.getClient() as any;
    const qrCandidates = this.buildQrCandidates(evacueeNumber);

    let authUserId: string | null = null;
    let citizenFullName: string | null = null;
    let existingEvacuee: EvacueeRow | null = null;

    const citizenMatch = await supabase
      .from('register_citizens')
      .select('user_id, full_name')
      .in('qr_code_id', qrCandidates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (citizenMatch.data) {
      authUserId = citizenMatch.data.user_id;
      citizenFullName = citizenMatch.data.full_name ?? null;
      const { data } = await supabase
        .from('evacuees')
        .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      existingEvacuee = data;
    } else {
      // Family members may exist in family_group_members even when register_citizens lookup misses.
      const { data: familyMember } = await supabase
        .from('family_group_members')
        .select('member_user_id, member_full_name')
        .in('citizen_qr_code_id', qrCandidates)
        .order('added_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (familyMember?.member_user_id) {
        authUserId = familyMember.member_user_id;
        citizenFullName = familyMember.member_full_name ?? null;
        const { data } = await supabase
          .from('evacuees')
          .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        existingEvacuee = data;
      }

      if (!existingEvacuee) {
      const { data } = await supabase
        .from('evacuees')
        .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
        .eq('family_head', evacueeNumber)
        .maybeSingle();
      existingEvacuee = data;
      }
    }

    if (existingEvacuee && (existingEvacuee.status as EvacueeDbStatus) === 'checked_in' && existingEvacuee.check_in_date) {
      // Already checked in — just update family size if provided, then return
      if (typeof familySize === 'number' && Number.isFinite(familySize)) {
        const { data: updated, error: updateErr } = await supabase
          .from('evacuees')
          .update({ family_size: familySize })
          .eq('id', existingEvacuee.id)
          .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
          .single();
        if (!updateErr && updated) return this.findOne((updated as EvacueeRow).id) as any;
      }
      return this.findOne(existingEvacuee.id) as any;
    }

    // Resolve an active disaster_id to satisfy the NOT NULL constraint on evacuees.disaster_id
    const activeDisasterId = await this.resolveActiveDisasterId(supabase);

    if (existingEvacuee) {
      const updatePayload: Record<string, unknown> = {
        check_in_date: this.localISOString(),
        check_out_date: null,
        status: 'checked_in',
        ...(centerId ? { center_id: centerId } : {}),
        ...(typeof familySize === 'number' && Number.isFinite(familySize)
          ? { family_size: familySize }
          : {}),
      };
      // Patch disaster_id if it's missing on the existing row
      if (!existingEvacuee.disaster_id && activeDisasterId) {
        updatePayload.disaster_id = activeDisasterId;
      }
      const { data, error } = await supabase
        .from('evacuees')
        .update(updatePayload)
        .eq('id', existingEvacuee.id)
        .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
        .single();
      if (error) throw new BadRequestException(error.message);
      return this.findOne((data as EvacueeRow).id) as any;
    } else {
      if (!activeDisasterId) {
        throw new BadRequestException(
          'No active disaster found. Please create a disaster event before checking in evacuees.',
        );
      }
      if (!authUserId) {
        throw new BadRequestException(
          `Unable to resolve auth user for QR ${evacueeNumber}. Ensure this member is linked to a registered citizen account.`,
        );
      }
      const { data, error } = await supabase
        .from('evacuees')
        .insert({
          auth_user_id: authUserId,
          family_head: citizenFullName || dtoFullName || evacueeNumber,
          disaster_id: activeDisasterId,
          check_in_date: this.localISOString(),
          status: 'checked_in',
          ...(centerId ? { center_id: centerId } : {}),
          ...(typeof familySize === 'number' && Number.isFinite(familySize)
            ? { family_size: familySize }
            : {}),
        })
        .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
        .single();
      if (error) throw new BadRequestException(error.message);
      return this.findOne((data as EvacueeRow).id) as any;
    }
  }

  async checkOut(id: string): Promise<CheckIn> {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('evacuees')
      .update({
        check_out_date: this.localISOString(),
        status: 'checked_out',
      })
      .eq('id', id)
      .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
      .single();

    if (error || !data) {
      throw new NotFoundException(`Check-in with ID ${id} not found`);
    }
    return this.findOne(id);
  }

  async checkOutByQr(qrCode: string): Promise<CheckIn> {
    const supabase = this.supabaseService.getClient() as any;
    const normalized = this.normalizeFamilyGroupQr((qrCode ?? '').trim());
    const qrCandidates = this.buildQrCandidates(normalized);

    if (/^(FAM-|FAMILY-GROUP-)/i.test(normalized)) {
      const result = await this.checkOutFamilyGroup(normalized);
      if (result.checkedOut <= 0) {
        throw new NotFoundException(`No active check-ins found for family QR ${normalized}`);
      }
      return {
        id: normalized,
        evacueeId: normalized,
        evacueeNumber: normalized,
        firstName: 'Family',
        lastName: 'Group',
        zone: 'Multiple Centers',
        location: 'Multiple Barangays',
        checkInTime: new Date(),
        qrCode: normalized,
        status: 'checked-out',
      };
    }

    const citizenLookup = await supabase
      .from('register_citizens')
      .select('user_id')
      .in('qr_code_id', qrCandidates)
      .maybeSingle();

    if (citizenLookup?.data?.user_id) {
      const { data: evacuees } = await supabase
        .from('evacuees')
        .select('id')
        .eq('auth_user_id', citizenLookup.data.user_id)
        .eq('status', 'checked_in')
        .order('check_in_date', { ascending: false })
        .limit(1);

      const latest = (evacuees ?? [])[0];
      if (latest?.id) {
        return this.checkOut(latest.id);
      }
    }

    const { data: evacueesByHead } = await supabase
      .from('evacuees')
      .select('id')
      .in('family_head', qrCandidates)
      .eq('status', 'checked_in')
      .order('check_in_date', { ascending: false })
      .limit(1);

    const latestByHead = (evacueesByHead ?? [])[0];
    if (latestByHead?.id) {
      return this.checkOut(latestByHead.id);
    }

    throw new NotFoundException(`No active check-in found for QR ${qrCode}`);
  }

  async checkOutFamilyGroup(familyQrCodeId: string): Promise<{ checkedOut: number }> {
    const supabase = this.supabaseService.getClient() as any;
    const allQrCodes = await this.familyGroupsService.getMemberQrCodesByGroupQr(familyQrCodeId);
    if (!allQrCodes.length) return { checkedOut: 0 };

    let checkedOut = 0;
    for (const qr of allQrCodes) {
      const { data: citizen } = await supabase
        .from('register_citizens')
        .select('user_id')
        .eq('qr_code_id', qr)
        .maybeSingle();
      if (!citizen?.user_id) continue;

      const { data: evacuee } = await supabase
        .from('evacuees')
        .select('id')
        .eq('auth_user_id', citizen.user_id)
        .eq('status', 'checked_in')
        .maybeSingle();
      if (!evacuee) continue;

      try {
        await this.checkOut(evacuee.id);
        checkedOut++;
      } catch { /* continue with others */ }
    }
    return { checkedOut };
  }

  async getStats() {
    const all = await this.findAll();
    const totalCheckedIn = all.filter((c) => c.status === 'checked-in').length;
    const totalCheckedOut = all.filter((c) => c.status === 'checked-out').length;

    const byZone = all.reduce(
      (acc, checkIn) => {
        if (checkIn.status === 'checked-in')
          acc[checkIn.zone] = (acc[checkIn.zone] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byLocation = all.reduce(
      (acc, checkIn) => {
        if (checkIn.status === 'checked-in') {
          acc[checkIn.location] = (acc[checkIn.location] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalCheckedIn,
      totalCheckedOut,
      total: all.length,
      byZone,
      byLocation,
    };
  }

  async getRecent(limit: number = 10): Promise<CheckIn[]> {
    const supabase = this.supabaseService.getClient() as any;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, limit) : 10;

    const { data: evacuees, error: evacueesError } = await supabase
      .from('evacuees')
      .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
      .not('check_in_date', 'is', null)
      .order('check_in_date', { ascending: false })
      .limit(safeLimit);

    if (evacueesError) {
      throw new NotFoundException(evacueesError.message);
    }

    const rows = (evacuees ?? []) as EvacueeRow[];
    const authUserIds = Array.from(
      new Set(rows.map((r) => r.auth_user_id).filter((v) => !!v)),
    );
    const centerIds = Array.from(
      new Set(rows.map((r) => r.center_id).filter((v) => !!v)),
    ) as string[];

    const { data: citizens } = authUserIds.length
      ? await supabase
          .from('register_citizens')
          .select('user_id, full_name, qr_code_id')
          .in('user_id', authUserIds)
      : { data: [] as CitizenRow[] };

    const { data: centers } = centerIds.length
      ? await supabase
          .from('evacuation_centers')
          .select('id, name, barangay')
          .in('id', centerIds)
      : { data: [] as EvacuationCenterRow[] };

    const citizenMap = new Map<string, CitizenRow>(
      (citizens ?? []).map((p: CitizenRow) => [p.user_id, p]),
    );
    const centerMap = new Map<string, EvacuationCenterRow>(
      (centers ?? []).map((c: EvacuationCenterRow) => [c.id, c]),
    );

    return rows.map((row) =>
      this.toCheckIn(
        row,
        citizenMap.get(row.auth_user_id),
        row.center_id ? centerMap.get(row.center_id) : undefined,
      ),
    );
  }

  /**
   * Returns the id of the most recent active (or any) disaster_event.
   * Used to satisfy the NOT NULL constraint on evacuees.disaster_id when
   * a new evacuee row is being inserted during check-in.
   */
  private async resolveActiveDisasterId(supabase: any): Promise<string | null> {
    // Prefer an active/ongoing disaster
    const { data: active } = await supabase
      .from('disaster_events')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active?.id) return active.id as string;

    // Fall back to the most recent disaster regardless of status
    const { data: latest } = await supabase
      .from('disaster_events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (latest?.id as string) ?? null;
  }

  private async findEvacueeRecord(identifier: string, supabase: any) {
    const normalizedIdentifier = identifier.trim();
    const qrCandidates = this.buildQrCandidates(normalizedIdentifier);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedIdentifier);
    
    if (isUuid) {
      const directMatch = await supabase
        .from('evacuees')
        .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
        .eq('id', normalizedIdentifier)
        .maybeSingle();

      if (directMatch.data) {
        return directMatch;
      }
    }

    const citizenMatch = await supabase
      .from('register_citizens')
      .select('user_id')
      .in('qr_code_id', qrCandidates)
      .maybeSingle();

    if (!citizenMatch.data) {
      return { data: null, error: null };
    }

    return supabase
      .from('evacuees')
      .select('id, auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status')
      .eq('auth_user_id', citizenMatch.data.user_id)
      .maybeSingle();
  }

  private buildQrCandidates(input: string): string[] {
    const raw = (input ?? '').trim();
    if (!raw) return [];

    const dePrefixed = raw.replace(/^QR-/i, '');
    return Array.from(new Set([
      raw,
      raw.toUpperCase(),
      dePrefixed,
      dePrefixed.toUpperCase(),
      `QR-${dePrefixed}`,
      `QR-${dePrefixed.toUpperCase()}`,
    ]));
  }

  private buildFamilyQrCandidates(input: string): string[] {
    const normalized = this.normalizeFamilyGroupQr(input);
    if (!normalized) return [];

    const dePrefixed = normalized.replace(/^QR-/i, '');
    return Array.from(new Set([
      normalized,
      normalized.toUpperCase(),
      dePrefixed,
      dePrefixed.toUpperCase(),
      `QR-${dePrefixed}`,
      `QR-${dePrefixed.toUpperCase()}`,
    ]));
  }

  private normalizeFamilyGroupQr(input: string): string {
    const raw = (input ?? '').trim();
    if (!raw) return '';

    const queryMatch = /[?&]qrCode=([^&#]+)/i.exec(raw);
    const decoded = queryMatch?.[1] ? decodeURIComponent(queryMatch[1]) : raw;
    const familyMatch = /(?:QR-)?(?:FAM|FAMILY-GROUP)-[A-Z0-9-]+/i.exec(decoded);

    if (familyMatch?.[0]) {
      return familyMatch[0].replace(/^QR-/i, '').toUpperCase();
    }

    return decoded;
  }

  private toCheckIn(
    row: EvacueeRow,
    citizen?: CitizenRow,
    center?: EvacuationCenterRow,
  ): CheckIn {
    const name = this.parseFullName(citizen?.full_name);

    return {
      id: row.id,
      evacueeId: row.id,
      evacueeNumber: row.id,
      firstName: name.firstName,
      lastName: name.lastName,
      zone: center?.name ?? 'Unassigned Center',
      location: center?.barangay ?? 'Unknown Barangay',
      checkInTime: new Date(
        row.check_in_date ??
          row.check_out_date ??
          new Date().toISOString(),
      ),
      qrCode: citizen?.qr_code_id ?? `QR-${row.id}`,
      disasterId: row.disaster_id ?? undefined,
      familyHead: row.family_head ?? undefined,
      familySize: row.family_size ?? undefined,
      specialNeeds: row.special_needs ?? undefined,
      status:
        (row.status as EvacueeDbStatus) === 'checked_out'
          ? 'checked-out'
          : 'checked-in',
    };
  }

  private localISOString(): string {
    const d = new Date();
    const pad = (n: number, size = 2) => String(n).padStart(size, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
    );
  }

  private parseFullName(fullName?: string | null) {
    const parts = (fullName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return { firstName: 'Unknown', lastName: 'Evacuee' };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: 'Evacuee' };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }
}
