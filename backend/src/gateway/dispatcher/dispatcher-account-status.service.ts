import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

type AccountStatusLabel = 'Active' | 'Locked' | 'In Recovery';

interface SiteManagerProfileRow {
  id: string;
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
}

@Injectable()
export class DispatcherAccountStatusService {
  constructor(
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
  ) {}

  async getSiteManagerAccountStatuses() {
    const supabase = this.supabaseService.getClient() as any;

    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, status')
      .eq('role', 'line_manager')
      .not('auth_user_id', 'is', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (profilesError) {
      throw new InternalServerErrorException(profilesError.message);
    }

    const rows = (profiles ?? []) as SiteManagerProfileRow[];
    const authIds = rows.map((row) => row.auth_user_id).filter(Boolean);

    let inRecoverySet = new Set<string>();
    if (authIds.length > 0) {
      const { data: pendingResets } = await supabase
        .from('password_reset_requests')
        .select('auth_user_id')
        .in('auth_user_id', authIds)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      inRecoverySet = new Set(
        ((pendingResets ?? []) as Array<{ auth_user_id: string | null }>)
          .map((row) => row.auth_user_id)
          .filter((id): id is string => Boolean(id)),
      );
    }

    return rows.map((row) => {
      const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
      const status = this.toDispatcherStatus(row.status, inRecoverySet.has(row.auth_user_id));

      return {
        profileId: row.id,
        authUserId: row.auth_user_id,
        fullName,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        accountStatus: status,
      };
    });
  }

  private toDispatcherStatus(rawStatus: string | null, inRecovery: boolean): AccountStatusLabel {
    if (inRecovery) {
      return 'In Recovery';
    }

    if ((rawStatus ?? '').toLowerCase() === 'active') {
      return 'Active';
    }

    return 'Locked';
  }
}
