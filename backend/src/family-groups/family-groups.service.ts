import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateFamilyGroupDto } from './dto/create-family-group.dto.js';
import { AddFamilyGroupMemberDto } from './dto/add-family-group-member.dto.js';

interface FamilyGroupRow {
  id: string;
  family_qr_code_id: string;
  head_user_id: string;
  family_name: string | null;
  created_at: string;
}

interface FamilyGroupMemberRow {
  id: string;
  family_group_id: string;
  citizen_qr_code_id: string;
  member_user_id: string | null;
  member_full_name: string | null;
  relationship: string | null;
  added_at: string;
}

@Injectable()
export class FamilyGroupsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async createGroup(dto: CreateFamilyGroupDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('family_groups')
      .insert({
        family_qr_code_id: dto.familyQrCodeId,
        head_user_id: dto.headUserId,
        family_name: dto.familyName ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.toGroup(data as FamilyGroupRow, []);
  }

  async getGroupByHeadUser(headUserId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('family_groups')
      .select('*')
      .eq('head_user_id', headUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new NotFoundException(error.message);
    if (!data) return null;

    const members = await this.getMembersForGroup((data as FamilyGroupRow).id);
    return this.toGroup(data as FamilyGroupRow, members);
  }

  async getGroupByUser(userId: string) {
    const headGroup = await this.getGroupByHeadUser(userId);
    if (headGroup) {
      return headGroup;
    }

    const supabase = this.supabaseService.getClient() as any;

    // First try direct linkage by member_user_id.
    const { data: memberRowByUser } = await supabase
      .from('family_group_members')
      .select('family_group_id')
      .eq('member_user_id', userId)
      .order('added_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let familyGroupId: string | null = memberRowByUser?.family_group_id ?? null;

    // Fallback for older rows that may not have member_user_id populated.
    if (!familyGroupId) {
      const { data: citizen } = await supabase
        .from('register_citizens')
        .select('qr_code_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (citizen?.qr_code_id) {
        const { data: memberRowByQr } = await supabase
          .from('family_group_members')
          .select('family_group_id')
          .eq('citizen_qr_code_id', citizen.qr_code_id)
          .order('added_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        familyGroupId = memberRowByQr?.family_group_id ?? null;
      }
    }

    if (!familyGroupId) {
      return null;
    }

    const { data: groupRow, error: groupError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('id', familyGroupId)
      .maybeSingle();

    if (groupError) throw new NotFoundException(groupError.message);
    if (!groupRow) return null;

    const [members, headInfo] = await Promise.all([
      this.getMembersForGroup((groupRow as FamilyGroupRow).id),
      this.getHeadCitizenInfo((groupRow as FamilyGroupRow).head_user_id),
    ]);

    return this.toGroup(groupRow as FamilyGroupRow, members, headInfo);
  }

  async getGroupByQrCode(familyQrCodeId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const qrCandidates = this.buildFamilyQrCandidates(familyQrCodeId);
    if (!qrCandidates.length) return null;

    const { data, error } = await supabase
      .from('family_groups')
      .select('*')
      .in('family_qr_code_id', qrCandidates)
      .maybeSingle();

    if (error) throw new NotFoundException(error.message);
    if (!data) return null;

    const [members, headInfo] = await Promise.all([
      this.getMembersForGroup((data as FamilyGroupRow).id),
      this.getHeadCitizenInfo((data as FamilyGroupRow).head_user_id),
    ]);
    return this.toGroup(data as FamilyGroupRow, members, headInfo);
  }

  async addMember(dto: AddFamilyGroupMemberDto) {
    const supabase = this.supabaseService.getClient() as any;

    // Look up the citizen in register_citizens to get their user_id and full_name
    let memberUserId = dto.memberUserId ?? null;
    let memberFullName = dto.memberFullName ?? null;

    if (!memberUserId || !memberFullName) {
      const { data: citizen } = await supabase
        .from('register_citizens')
        .select('user_id, full_name')
        .eq('qr_code_id', dto.citizenQrCodeId)
        .maybeSingle();

      if (citizen) {
        memberUserId = memberUserId ?? citizen.user_id;
        memberFullName = memberFullName ?? citizen.full_name;
      }
    }

    const { data, error } = await supabase
      .from('family_group_members')
      .insert({
        family_group_id: dto.familyGroupId,
        citizen_qr_code_id: dto.citizenQrCodeId,
        member_user_id: memberUserId,
        member_full_name: memberFullName,
        relationship: dto.relationship ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Keep citizen profile linkage in sync so member-side views can reflect family association.
    await supabase
      .from('register_citizens')
      .update({ family_id: dto.familyGroupId })
      .eq('qr_code_id', dto.citizenQrCodeId);

    return this.toMember(data as FamilyGroupMemberRow);
  }

  async removeMember(familyGroupId: string, citizenQrCodeId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase
      .from('family_group_members')
      .delete()
      .eq('family_group_id', familyGroupId)
      .eq('citizen_qr_code_id', citizenQrCodeId);

    if (error) throw new BadRequestException(error.message);

    await supabase
      .from('register_citizens')
      .update({ family_id: null })
      .eq('qr_code_id', citizenQrCodeId);
  }

  async deleteGroup(headUserId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase
      .from('family_groups')
      .delete()
      .eq('head_user_id', headUserId);

    if (error) throw new BadRequestException(error.message);
  }

  /** Returns all QR codes for a family group (head first, then members) — used by check-in service. */
  async getMemberQrCodesByGroupQr(familyQrCodeId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient() as any;
    const qrCandidates = this.buildFamilyQrCandidates(familyQrCodeId);
    if (!qrCandidates.length) return [];

    const { data: group } = await supabase
      .from('family_groups')
      .select('id, head_user_id')
      .in('family_qr_code_id', qrCandidates)
      .maybeSingle();

    if (!group) return [];

    const [{ data: members }, { data: headCitizen }] = await Promise.all([
      supabase
        .from('family_group_members')
        .select('citizen_qr_code_id')
        .eq('family_group_id', group.id),
      supabase
        .from('register_citizens')
        .select('qr_code_id')
        .eq('user_id', group.head_user_id)
        .maybeSingle(),
    ]);

    const memberQrCodes = (members ?? []).map((m: FamilyGroupMemberRow) => m.citizen_qr_code_id);
    const headQrCode: string | null = headCitizen?.qr_code_id ?? null;

    return headQrCode ? [headQrCode, ...memberQrCodes] : memberQrCodes;
  }

  private async getHeadCitizenInfo(headUserId: string): Promise<{ fullName: string | null; qrCodeId: string | null }> {
    const supabase = this.supabaseService.getClient() as any;
    const [{ data: citizen }, { data: profile }] = await Promise.all([
      supabase.from('register_citizens').select('full_name, qr_code_id').eq('user_id', headUserId).maybeSingle(),
      supabase.from('user_profiles').select('first_name, last_name').eq('auth_user_id', headUserId).maybeSingle(),
    ]);
    const fullName =
      citizen?.full_name?.trim() ||
      (profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null) ||
      null;
    return { fullName, qrCodeId: citizen?.qr_code_id ?? null };
  }

  private async getMembersForGroup(groupId: string): Promise<FamilyGroupMemberRow[]> {
    const supabase = this.supabaseService.getClient() as any;
    const { data } = await supabase
      .from('family_group_members')
      .select('*')
      .eq('family_group_id', groupId)
      .order('added_at', { ascending: true });

    return (data ?? []) as FamilyGroupMemberRow[];
  }

  private toGroup(
    row: FamilyGroupRow,
    members: FamilyGroupMemberRow[],
    headInfo?: { fullName: string | null; qrCodeId: string | null },
  ) {
    return {
      id: row.id,
      familyQrCodeId: row.family_qr_code_id,
      headUserId: row.head_user_id,
      headName: headInfo?.fullName ?? undefined,
      headQrCodeId: headInfo?.qrCodeId ?? undefined,
      familyName: row.family_name ?? undefined,
      members: members.map((m) => this.toMember(m)),
      createdAt: new Date(row.created_at),
    };
  }

  private toMember(row: FamilyGroupMemberRow) {
    return {
      id: row.id,
      citizenQrCodeId: row.citizen_qr_code_id,
      memberUserId: row.member_user_id ?? undefined,
      memberFullName: row.member_full_name ?? undefined,
      relationship: row.relationship ?? undefined,
      addedAt: new Date(row.added_at),
    };
  }

  private buildFamilyQrCandidates(input: string): string[] {
    const normalized = this.normalizeFamilyQr(input);
    if (!normalized) return [];

    return Array.from(new Set([
      normalized,
      normalized.toUpperCase(),
      normalized.replace(/^QR-/i, ''),
      `QR-${normalized.replace(/^QR-/i, '')}`,
    ]));
  }

  private normalizeFamilyQr(input: string): string {
    const raw = (input ?? '').trim();
    if (!raw) return '';

    const queryMatch = /[?&]qrCode=([^&#]+)/i.exec(raw);
    const decoded = queryMatch?.[1] ? decodeURIComponent(queryMatch[1]) : raw;
    const match = /(?:QR-)?FAM-[A-Z0-9-]+/i.exec(decoded);

    if (match?.[0]) {
      return match[0].toUpperCase();
    }

    return decoded.toUpperCase();
  }
}
