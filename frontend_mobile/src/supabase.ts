import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export interface LiveAlertRecord {
  id: string;
  scope: string;
  target: string | null;
  title: string;
  message: string;
  severity: string;
  disaster_type: string | null;
  created_at: string | null;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export function subscribeToUserNotifications(
  userId: string,
  onNew: (notification: NotificationRecord) => void,
): (() => void) | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channel: RealtimeChannel = supabase
    .channel(`user-notifications:${userId}`)
    .on("broadcast", { event: "new_notification" }, (payload) =>
      onNew(payload.payload as NotificationRecord),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToLiveAlerts(onInsert: (alert: LiveAlertRecord) => void): (() => void) | null {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const channel: RealtimeChannel = supabase
    .channel("mobile-admin-live-alerts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "drm_alerts" },
      (payload) => onInsert(payload.new as LiveAlertRecord),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}