"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AuthSession, CheckInRecord } from "../../../lib/types";
import type { PhaseConfig } from "../utils/siteManagerUtils";
import { getRecentCheckIns } from "../../../lib/api";
import { formatTimestamp } from "../utils/siteManagerUtils";

interface MovementTabProps {
  phase: "before" | "during" | "after";
  phaseConfig: PhaseConfig;
  session: AuthSession | null;
  checkIns: CheckInRecord[];
  onRecordsRefreshed: (records: CheckInRecord[]) => void;
}

type MovementFilter = "all" | "check-in" | "check-out";

export default function MovementTab({
  phase,
  phaseConfig,
  session,
  checkIns,
  onRecordsRefreshed,
}: Readonly<MovementTabProps>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function hydrateMovement() {
      if (!session?.accessToken) return;

      setIsRefreshing(true);
      setLoadError(null);
      try {
        const records = await getRecentCheckIns(session.accessToken, 200);
        onRecordsRefreshed(records);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load movement records");
      } finally {
        setIsRefreshing(false);
      }
    }

    void hydrateMovement();
  }, [checkIns.length, onRecordsRefreshed, session?.accessToken]);

  const handleRefresh = async () => {
    if (!session?.accessToken) return;

    setIsRefreshing(true);
    setLoadError(null);
    try {
      const records = await getRecentCheckIns(session.accessToken, 200);
      onRecordsRefreshed(records);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to refresh movement records");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return checkIns
      .filter((record) => {
        const status = (record.status || "").toLowerCase();
        if (movementFilter === "check-in") return status !== "checked-out";
        if (movementFilter === "check-out") return status === "checked-out";
        return true;
      })
      .filter((record) => {
        if (!normalizedQuery) return true;

        const fullName = (
          record.fullName || `${record.firstName ?? ""} ${record.lastName ?? ""}`
        )
          .trim()
          .toLowerCase();
        const zone = (record.zone || "").toLowerCase();
        const location = (record.location || "").toLowerCase();
        const evacueeNumber = (record.evacueeNumber || "").toLowerCase();

        return (
          fullName.includes(normalizedQuery) ||
          zone.includes(normalizedQuery) ||
          location.includes(normalizedQuery) ||
          evacueeNumber.includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        const aTime = new Date(a.checkInTime || "").getTime() || 0;
        const bTime = new Date(b.checkInTime || "").getTime() || 0;
        return bTime - aTime;
      });
  }, [checkIns, movementFilter, searchQuery]);

  const checkInCount = checkIns.filter((record) => (record.status || "").toLowerCase() !== "checked-out").length;
  const checkOutCount = checkIns.filter((record) => (record.status || "").toLowerCase() === "checked-out").length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <section className="bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-black">Citizen Tracker</h3>
            <p className="text-sm text-[#444743] dark:text-[#c4c7c0]">
              Monitor arrivals, departures, and citizen movement history for the {phase} phase.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: phaseConfig.primaryColor }}
          >
            <span className={`material-symbols-outlined text-sm ${isRefreshing ? "animate-spin" : ""}`}>
              refresh
            </span>
            {isRefreshing ? "Refreshing" : "Refresh List"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] p-4 bg-[#f4f4ef] dark:bg-[#1a1c19]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#707a6c]">Total Records</p>
            <p className="text-2xl font-black mt-1">{checkIns.length}</p>
          </div>
          <div className="rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] p-4 bg-[#f4f4ef] dark:bg-[#1a1c19]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#707a6c]">Checked-In</p>
            <p className="text-2xl font-black mt-1" style={{ color: "#2E7D32" }}>{checkInCount}</p>
          </div>
          <div className="rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] p-4 bg-[#f4f4ef] dark:bg-[#1a1c19]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#707a6c]">Checked-Out</p>
            <p className="text-2xl font-black mt-1" style={{ color: "#FFB300" }}>{checkOutCount}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#1a1c19] p-1">
            {([
              { id: "all", label: "All" },
              { id: "check-in", label: "Check-In" },
              { id: "check-out", label: "Check-Out" },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setMovementFilter(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  movementFilter === item.id
                    ? "text-white shadow-sm"
                    : "text-[#444743] hover:bg-white dark:hover:bg-white/5"
                }`}
                style={movementFilter === item.id ? { background: phaseConfig.primaryColor } : {}}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, evacuee number, zone, or location"
              className="w-full rounded-xl border border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#1a1c19] px-4 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        {loadError && <p className="text-sm text-red-600 mb-3">{loadError}</p>}

        <div className="overflow-x-auto rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b]">
          <table className="w-full text-left text-sm min-w-[780px]">
            <thead className="bg-[#f4f4ef] dark:bg-[#1a1c19] border-b border-[#dadad5] dark:border-[#3b3b3b]">
              <tr className="text-[10px] font-black uppercase tracking-widest text-[#707a6c]">
                <th className="px-4 py-3">Citizen</th>
                <th className="px-4 py-3">Evacuee #</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Logged Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dadad5]/40 dark:divide-[#3b3b3b]/70">
              {filteredRecords.map((record) => {
                const status = (record.status || "").toLowerCase();
                const isCheckedOut = status === "checked-out";
                const fullName =
                  record.fullName || `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim() || "Unknown Citizen";

                return (
                  <tr key={record.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-bold">{fullName}</td>
                    <td className="px-4 py-3 font-medium">{record.evacueeNumber || "N/A"}</td>
                    <td className="px-4 py-3">{record.zone || "N/A"}</td>
                    <td className="px-4 py-3">{record.location || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                        style={{
                          background: isCheckedOut ? "#fff3e0" : "#e8f5e9",
                          color: isCheckedOut ? "#a35f00" : "#1b5e20",
                        }}
                      >
                        {isCheckedOut ? "Checked-Out" : "Checked-In"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#707a6c] font-medium">
                      {formatTimestamp(record.checkInTime)}
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707a6c]">
                    No movement records found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
