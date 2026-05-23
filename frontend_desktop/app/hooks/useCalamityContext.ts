'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CalamityPhase = 'BEFORE' | 'DURING' | 'AFTER';

export interface CalamityContextState {
  currentPhase: CalamityPhase;
  /** True only while the initial fetch from system_settings is in-flight */
  isLoading: boolean;
  /** Citizens should be offered the SOS panic button */
  shouldShowPanicSOS: boolean;
  /** City-wide GPS tracking layer should be active */
  shouldTrackCityGPS: boolean;
  /** Barangay boundary overlays should be rendered */
  shouldRenderBarangayBoundaries: boolean;
}

interface SystemSettingsRow {
  current_phase: string;
}

function deriveFlags(phase: CalamityPhase) {
  return {
    shouldShowPanicSOS: phase === 'DURING',
    shouldTrackCityGPS: phase === 'DURING',
    shouldRenderBarangayBoundaries: phase === 'DURING' || phase === 'AFTER',
  };
}

function normalisePhase(raw: string): CalamityPhase {
  const upper = raw.toUpperCase();
  if (upper === 'DURING' || upper === 'AFTER') return upper;
  return 'BEFORE';
}

export function useCalamityContext(): CalamityContextState {
  const [currentPhase, setCurrentPhase] = useState<CalamityPhase>('BEFORE');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    // Hydrate current phase on mount
    void (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('current_phase')
          .limit(1)
          .single();

        if (!cancelled && data?.current_phase) {
          setCurrentPhase(normalisePhase((data as SystemSettingsRow).current_phase));
        }
      } catch {
        // Keep default BEFORE phase on network failure
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Realtime subscription for live phase changes
    const channel: RealtimeChannel = supabase
      .channel('desktop-system-settings-phase')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        (payload) => {
          const row = payload.new as SystemSettingsRow;
          if (row?.current_phase) {
            setCurrentPhase(normalisePhase(row.current_phase));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    currentPhase,
    isLoading,
    ...deriveFlags(currentPhase),
  };
}
