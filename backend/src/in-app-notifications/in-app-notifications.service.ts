import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

export type NotificationType =
  | 'approval_approved'
  | 'approval_rejected'
  | 'alert'
  | 'dispatch_assigned'
  | 'incident_update'
  | 'system';

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

@Injectable()
export class InAppNotificationsService {
  constructor(
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
  ) {}

  async send(
    userId: string,
    title: string,
    body: string,
    type: NotificationType = 'system',
    data?: Record<string, unknown>,
  ): Promise<NotificationRecord | null> {
    const supabase = this.supabaseService.getClient() as any;

    const { data: row, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, body, type, data: data ?? null })
      .select('id, user_id, title, body, type, data, read, created_at')
      .single();

    if (error) {
      console.warn(`[InAppNotificationsService] Failed to send notification to ${userId}: ${error.message}`);
      return null;
    }

    await this.broadcast(userId, row as NotificationRecord);
    return row as NotificationRecord;
  }

  async sendToMany(
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType = 'system',
    data?: Record<string, unknown>,
  ): Promise<void> {
    console.log(`[InAppNotifications] sendToMany called — ${userIds.length} recipients, title: "${title}"`);
    if (userIds.length === 0) {
      console.warn('[InAppNotifications] sendToMany aborted — no user IDs');
      return;
    }

    let sent = 0;
    for (const uid of userIds) {
      const row = await this.send(uid, title, body, type, data);
      if (row) sent++;
    }
    console.log(`[InAppNotifications] sendToMany done — ${sent}/${userIds.length} delivered`);
  }

  async findByUser(userId: string): Promise<NotificationRecord[]> {
    const supabase = this.supabaseService.getClient() as any;

    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, type, data, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn(`[InAppNotificationsService] Failed to fetch notifications: ${error.message}`);
      return [];
    }

    return (data ?? []) as NotificationRecord[];
  }

  async unreadCount(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient() as any;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) return 0;
    return count ?? 0;
  }

  async markRead(id: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
  }

  async markAllRead(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }

  private broadcast(userId: string, notification: NotificationRecord): void {
    const supabase = this.supabaseService.getClient() as any;
    const channel = supabase.channel(`user-notifications:${userId}`);

    const cleanup = () => {
      try { void supabase.removeChannel(channel); } catch { /* ignore */ }
    };

    const timeout = setTimeout(cleanup, 5000);

    channel.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return;
      clearTimeout(timeout);
      channel
        .send({ type: 'broadcast', event: 'new_notification', payload: notification })
        .catch(() => { /* best-effort */ })
        .finally(cleanup);
    });
  }
}
