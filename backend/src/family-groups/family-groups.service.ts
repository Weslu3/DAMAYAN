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

  async getGroupByQrCode(familyQrCodeId: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('family_groups')
      .select('*')
      .eq('family_qr_code_id', familyQrCodeId)
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
    const { data: group } = await supabase
      .from('family_groups')
      .select('id, head_user_id')
      .eq('family_qr_code_id', familyQrCodeId)
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
}
