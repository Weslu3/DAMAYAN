import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AppNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api";
import { subscribeToUserNotifications } from "../supabase";

export function useNotifications(userId: string | null, token: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getNotifications(token);
      setNotifications(data);
    } catch {
      // silently fail — notification panel is non-critical
    } finally {
      setLoading(false);
    }
  }, [token]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      try {
        await markNotificationRead(token, id);
      } catch {
        // revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
        );
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead(token);
    } catch {
      // revert on failure
      fetchNotifications();
    }
  }, [token, fetchNotifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToUserNotifications(userId, (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [userId]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
