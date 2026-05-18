import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../supabase';

export type SystemPhase = 'BEFORE' | 'DURING' | 'AFTER';

// Convenience mappings for each dashboard's local terminology
export type CitizenPhase = 'before' | 'during' | 'after';
export type OperationalStage = 'STAGING' | 'RESPONSE' | 'RECOVERY';

const PHASE_CACHE_KEY = 'local_disaster_phase';
const SETTINGS_ROW_ID = 1;

interface SystemPhaseContextValue {
  systemPhase: SystemPhase;
  /** Lowercase phase for Citizen dashboard */
  citizenPhase: CitizenPhase;
  /** Stage label for SiteManager dashboard */
  operationalStage: OperationalStage;
}

const CITIZEN_PHASE_MAP: Record<SystemPhase, CitizenPhase> = {
  BEFORE: 'before',
  DURING: 'during',
  AFTER: 'after',
};

const STAGE_MAP: Record<SystemPhase, OperationalStage> = {
  BEFORE: 'STAGING',
  DURING: 'RESPONSE',
  AFTER: 'RECOVERY',
};

const SystemPhaseContext = createContext<SystemPhaseContextValue>({
  systemPhase: 'BEFORE',
  citizenPhase: 'before',
  operationalStage: 'STAGING',
});

export function useSystemPhase(): SystemPhaseContextValue {
  return useContext(SystemPhaseContext);
}

function buildContextValue(phase: SystemPhase): SystemPhaseContextValue {
  return {
    systemPhase: phase,
    citizenPhase: CITIZEN_PHASE_MAP[phase],
    operationalStage: STAGE_MAP[phase],
  };
}

export function SystemPhaseProvider({ children }: { children: React.ReactNode }) {
  const [systemPhase, setSystemPhase] = useState<SystemPhase>('BEFORE');

  useEffect(() => {
    // 1. Immediately load cached phase so the app isn't blank offline
    AsyncStorage.getItem(PHASE_CACHE_KEY).then((cached) => {
      if (cached === 'BEFORE' || cached === 'DURING' || cached === 'AFTER') {
        setSystemPhase(cached);
      }
    });

    // 2. Fetch the latest phase from Supabase to override the cache
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('system_settings')
      .select('current_phase')
      .eq('id', SETTINGS_ROW_ID)
      .single()
      .then(({ data }) => {
        if (data?.current_phase) {
          const fresh = data.current_phase as SystemPhase;
          setSystemPhase(fresh);
          AsyncStorage.setItem(PHASE_CACHE_KEY, fresh);
        }
      });

    // 3. Subscribe to Realtime updates and keep the cache in sync
    const subscription = supabase
      .channel('public:system_settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: `id=eq.${SETTINGS_ROW_ID}`,
        },
        (payload) => {
          const newPhase = (payload.new as { current_phase: SystemPhase }).current_phase;
          if (newPhase) {
            setSystemPhase(newPhase);
            AsyncStorage.setItem(PHASE_CACHE_KEY, newPhase);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <SystemPhaseContext.Provider value={buildContextValue(systemPhase)}>
      {children}
    </SystemPhaseContext.Provider>
  );
}
