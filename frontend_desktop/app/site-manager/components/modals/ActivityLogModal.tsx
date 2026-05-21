"use client";

import React from "react";
import type { AuditEntry } from "../utils/siteManagerUtils";

interface ActivityLogModalProps {
  phase: "before" | "during" | "after";
  allAuditEntries: AuditEntry[];
  onClose: () => void;
}

function getPhaseActivityDescription(phase: "before" | "during" | "after"): string {
  if (phase === "before") {
    return "Operational preparations, inventory setups, and staging checks recorded on this site.";
  }
  if (phase === "during") {
    return "Real-time records of citizen arrivals and active site incidents.";
  }
  return "Post-disaster safe check-outs, remaining inventory audits, and recovery actions.";
}

function getEntryStatusBadge(status?: string): string {
  const normalized = status?.toLowerCase() ?? "";
  if (
    normalized === "resolved"
    || normalized === "checked_in"
    || normalized === "checked-in"
    || normalized === "processed"
  ) {
    return "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300";
  }
  if (normalized === "checked-out") {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  }
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

export default function ActivityLogModal({ phase, allAuditEntries, onClose }: Readonly<ActivityLogModalProps>) {
  const phaseDescription = getPhaseActivityDescription(phase);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close activity log panel"
        className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 cursor-default border-none outline-none focus:outline-none"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-[#1a1c19] w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-3xl font-black mb-2">System Activity Log</h3>
            <p className="text-[#444743] dark:text-[#a0a39f] text-sm font-medium">
              {phaseDescription}
            </p>
          </div>
          <button onClick={onClose} className="material-symbols-outlined p-2 hover:bg-[#f4f4ef] rounded-full">close</button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#dadad5]/50 text-[#707a6c] font-black text-[10px] uppercase tracking-wider">
                <th className="pb-3">Activity / Details</th>
                <th className="pb-3">Logged Time</th>
                <th className="pb-3 text-center">Source</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dadad5]/30">
              {allAuditEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors font-bold">
                  <td className="py-4">
                    <p className="text-[#1a1c19] dark:text-white text-base">{entry.title}</p>
                    <p className="text-xs text-[#707a6c] font-mono mt-1">{entry.note}</p>
                  </td>
                  <td className="py-4 font-medium text-[#707a6c] text-xs whitespace-nowrap">{entry.timestamp}</td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#eeeeea] dark:bg-[#232622]">
                      {entry.source}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={`text-[10px] px-2.5 py-1 rounded font-black uppercase ${getEntryStatusBadge(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
              {allAuditEntries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#707a6c] text-sm">
                    No activity records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
