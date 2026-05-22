"use client";
import { useEffect, useCallback } from "react";
import { loadSession } from "../../lib/session";
import { useDispatcher } from "../contexts/useDispatcher";
import { MOCK_DISPATCHER } from "../data";

/**
 * Hook for managing dispatcher session and user profile.
 * Syncs session data to the global dispatcher context.
 */
export function useDispatcherSession() {
  const { setCurrentUser } = useDispatcher();

  const syncProfile = useCallback(() => {
    const session = loadSession();
    if (session?.user) {
      const u = session.user;
      const initials = `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "DS";
      const name = u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Daniel Santos";
      setCurrentUser({
        name,
        initials,
        rank: "Senior Dispatcher",
        badge: "DS-3042",
        cluster: "Metro Cluster 3",
        station: "Sampaloc Command Center",
      });
    } else {
      setCurrentUser(null);
    }
  }, [setCurrentUser]);

  useEffect(() => {
    syncProfile();
  }, [syncProfile]);

  const getAccessToken = useCallback((): string | null => {
    const session = loadSession();
    return session?.accessToken || null;
  }, []);

  return { syncProfile, getAccessToken };
}
