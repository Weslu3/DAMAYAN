"use client";
import { useContext } from "react";
import { DispatcherContext } from "./DispatcherContext";
import { DispatcherContextType } from "./types";

export function useDispatcher(): DispatcherContextType {
  const context = useContext(DispatcherContext);
  if (!context) {
    throw new Error("useDispatcher must be used within a DispatcherProvider");
  }
  return context;
}
