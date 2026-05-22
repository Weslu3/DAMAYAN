"use client";
import React, { createContext, useReducer, useCallback } from "react";
import { Incident } from "../data";
import {
  DispatcherContextType,
  DispatcherAction,
  initialDispatcherState,
  DispatcherUser,
} from "./types";

export const DispatcherContext = createContext<DispatcherContextType>(
  initialDispatcherState
);

const dispatcherReducer = (
  state: DispatcherContextType,
  action: DispatcherAction
): DispatcherContextType => {
  switch (action.type) {
    case "SET_INCIDENTS":
      return { ...state, incidents: action.payload };
    case "SET_UNITS":
      return { ...state, units: action.payload };
    case "SET_CURRENT_USER":
      return { ...state, currentUser: action.payload };
    case "SET_DISPATCH_TARGET":
      return { ...state, dispatchTarget: action.payload };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_LOADING_INCIDENTS":
      return { ...state, isLoadingIncidents: action.payload };
    case "SET_LOADING_UNITS":
      return { ...state, isLoadingUnits: action.payload };
    case "SET_SYNCING":
      return { ...state, isSyncing: action.payload };
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };
    case "SET_LAST_SYNC_TIME":
      return { ...state, lastSyncTime: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "UPDATE_INCIDENT":
      return {
        ...state,
        incidents: state.incidents.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload.patch } : i
        ),
      };
    default:
      return state;
  }
};

export interface DispatcherProviderProps {
  children: React.ReactNode;
  onUpdateIncident?: (id: string, patch: Partial<Incident>) => Promise<void>;
}

export function DispatcherProvider({
  children,
  onUpdateIncident,
}: DispatcherProviderProps) {
  const [state, dispatch] = useReducer(
    dispatcherReducer,
    initialDispatcherState
  );

  const setIncidents = useCallback((incidents: Incident[]) => {
    dispatch({ type: "SET_INCIDENTS", payload: incidents });
  }, []);

  const setUnits = useCallback((units) => {
    dispatch({ type: "SET_UNITS", payload: units });
  }, []);

  const setCurrentUser = useCallback((user: DispatcherUser | null) => {
    dispatch({ type: "SET_CURRENT_USER", payload: user });
  }, []);

  const setDispatchTarget = useCallback((incident: Incident | null) => {
    dispatch({ type: "SET_DISPATCH_TARGET", payload: incident });
  }, []);

  const setStatus = useCallback((status: "active" | "inactive") => {
    dispatch({ type: "SET_STATUS", payload: status });
  }, []);

  const updateIncident = useCallback(
    async (id: string, patch: Partial<Incident>) => {
      dispatch({ type: "UPDATE_INCIDENT", payload: { id, patch } });
      if (onUpdateIncident) {
        try {
          await onUpdateIncident(id, patch);
        } catch (err) {
          console.error("Failed to update incident:", err);
        }
      }
    },
    [onUpdateIncident]
  );

  const updateConnectionStatus = useCallback(
    (status: "online" | "offline" | "syncing") => {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: status });
    },
    []
  );

  const setLastSyncTime = useCallback(() => {
    dispatch({ type: "SET_LAST_SYNC_TIME", payload: new Date() });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const value: DispatcherContextType = {
    ...state,
    setIncidents,
    setUnits,
    setCurrentUser,
    setDispatchTarget,
    setStatus,
    updateIncident,
    updateConnectionStatus,
    setLastSyncTime,
    setError,
  };

  return (
    <DispatcherContext.Provider value={value}>
      {children}
    </DispatcherContext.Provider>
  );
}
