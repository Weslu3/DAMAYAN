"use client";
import { useCallback } from "react";
import { getDispatcherVolunteers } from "../../lib/api";
import { useRealTimeSync } from "./useRealTimeSync";
import { useDispatcher } from "../contexts/useDispatcher";
import { mapOrganizationToVolunteer } from "../data";

/**
 * Hook for real-time units/volunteers sync with polling.
 * Fetches volunteers every 15 seconds when tab is visible.
 */
export function useUnits(
  token: string | null,
  enabled: boolean = true,
  interval: number = 15000
) {
  const { setUnits, setError } = useDispatcher();

  const fetchUnits = useCallback(async () => {
    if (!token) throw new Error("No auth token");
    const volunteers = await getDispatcherVolunteers(token);
    return volunteers.map((org, idx) => mapOrganizationToVolunteer(org, idx));
  }, [token]);

  const handleData = useCallback(
    (units) => {
      setUnits(units);
      setError(null);
    },
    [setUnits, setError]
  );

  const handleError = useCallback(
    (error: Error) => {
      if (error.message === "No auth token") {
        return;
      }
      console.error("Failed to fetch units:", error);
      setError(`Failed to sync units: ${error.message}`);
    },
    [setError]
  );

  useRealTimeSync(fetchUnits, handleData, {
    interval,
    enabled: enabled && !!token,
    onError: handleError,
  });
}
