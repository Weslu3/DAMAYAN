import { Incident, Unit, NavPage } from "../data";

export interface DispatcherUser {
  name: string;
  initials: string;
  rank: string;
  badge: string;
  cluster: string;
  station: string;
}

export interface DispatcherContextType {
  // Data state
  incidents: Incident[];
  units: Unit[];
  currentUser: DispatcherUser | null;
  dispatchTarget: Incident | null;
  status: "active" | "inactive";

  // Loading/sync state
  isLoadingIncidents: boolean;
  isLoadingUnits: boolean;
  isSyncing: boolean;
  connectionStatus: "online" | "offline" | "syncing";
  lastSyncTime: Date | null;
  error: string | null;

  // Actions
  setIncidents: (incidents: Incident[]) => void;
  setUnits: (units: Unit[]) => void;
  setCurrentUser: (user: DispatcherUser | null) => void;
  setDispatchTarget: (incident: Incident | null) => void;
  setStatus: (status: "active" | "inactive") => void;
  updateIncident: (id: string, patch: Partial<Incident>) => Promise<void>;
  updateConnectionStatus: (status: "online" | "offline" | "syncing") => void;
  setLastSyncTime: () => void;
  setError: (error: string | null) => void;
}

export type DispatcherAction =
  | { type: "SET_INCIDENTS"; payload: Incident[] }
  | { type: "SET_UNITS"; payload: Unit[] }
  | { type: "SET_CURRENT_USER"; payload: DispatcherUser | null }
  | { type: "SET_DISPATCH_TARGET"; payload: Incident | null }
  | { type: "SET_STATUS"; payload: "active" | "inactive" }
  | { type: "SET_LOADING_INCIDENTS"; payload: boolean }
  | { type: "SET_LOADING_UNITS"; payload: boolean }
  | { type: "SET_SYNCING"; payload: boolean }
  | { type: "SET_CONNECTION_STATUS"; payload: "online" | "offline" | "syncing" }
  | { type: "SET_LAST_SYNC_TIME"; payload: Date }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "UPDATE_INCIDENT"; payload: { id: string; patch: Partial<Incident> } };

export const initialDispatcherState: DispatcherContextType = {
  incidents: [],
  units: [],
  currentUser: null,
  dispatchTarget: null,
  status: "active",
  isLoadingIncidents: false,
  isLoadingUnits: false,
  isSyncing: false,
  connectionStatus: "offline",
  lastSyncTime: null,
  error: null,
  setIncidents: () => {},
  setUnits: () => {},
  setCurrentUser: () => {},
  setDispatchTarget: () => {},
  setStatus: () => {},
  updateIncident: async () => {},
  updateConnectionStatus: () => {},
  setLastSyncTime: () => {},
  setError: () => {},
};
