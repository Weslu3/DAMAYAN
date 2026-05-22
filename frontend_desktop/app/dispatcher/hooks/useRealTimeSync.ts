"use client";
import { useEffect, useRef, useCallback } from "react";

export interface UseRealTimeSyncOptions {
  interval: number; // milliseconds
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

/**
 * Generic hook for real-time polling with automatic backoff and visibility detection.
 * Pauses when tab is not visible and resumes when tab becomes visible.
 */
export function useRealTimeSync<T>(
  fetchFn: () => Promise<T>,
  onData: (data: T) => void,
  options: UseRealTimeSyncOptions
) {
  const { interval, enabled = true, onError, onSuccess } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isVisibleRef = useRef(!document.hidden);

  const executeSync = useCallback(async () => {
    try {
      const data = await fetchFn();
      onData(data);
      onSuccess?.();
      lastFetchRef.current = Date.now();
    } catch (error) {
      console.error("Real-time sync error:", error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [fetchFn, onData, onSuccess, onError]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (isVisibleRef.current && enabled && intervalRef.current) {
        // Tab became visible, fetch immediately and resume polling
        executeSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, executeSync]);

  // Main polling effect
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch immediately if tab is visible
    if (isVisibleRef.current) {
      executeSync();
    }

    // Setup polling
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        executeSync();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [interval, enabled, executeSync]);
}
