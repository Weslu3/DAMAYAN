"use client";
import { useCallback } from "react";
import { getDispatcherIncidents } from "../../lib/api";
import { useRealTimeSync } from "./useRealTimeSync";
import { useDispatcher } from "../contexts/useDispatcher";
import { mapBackendToFrontendIncident } from "../data";

/**
 * Hook for real-time incidents sync with polling.
 * Fetches incidents every 5-10 seconds when tab is visible.
 */
export function useIncidents(
  token: string | null,
  enabled: boolean = true,
  interval: number = 8000
) {
  const { setIncidents, setError, updateConnectionStatus } = useDispatcher();

  const fetchIncidents = useCallback(async () => {
    if (!token) throw new Error("No auth token");
    const reports = await getDispatcherIncidents(token);
    return reports.map(mapBackendToFrontendIncident);
  }, [token]);

  const handleData = useCallback(
    (incidents) => {
      setIncidents(incidents);
      updateConnectionStatus("online");
      setError(null);
    },
    [setIncidents, updateConnectionStatus, setError]
  );

  const handleError = useCallback(
    (error: Error) => {
      if (error.message === "No auth token") {
        return;
      }
      console.error("Failed to fetch incidents:", error);
      updateConnectionStatus("offline");
      setError(`Failed to sync incidents: ${error.message}`);
    },
    [updateConnectionStatus, setError]
  );

  useRealTimeSync(fetchIncidents, handleData, {
    interval,
    enabled: enabled && !!token,
    onError: handleError,
  });
}
