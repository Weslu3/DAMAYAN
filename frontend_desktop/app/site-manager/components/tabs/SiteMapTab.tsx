"use client";

import React from "react";
import type { AuthSession, CapacityCenter, DashboardOverview, IncidentReport, InventoryItem } from "../../../lib/types";
import type { PhaseConfig } from "../utils/siteManagerUtils";
import SiteManagerRegionalMap from "../SiteManagerRegionalMap";

interface SiteMapTabProps {
  phase: "before" | "during" | "after";
  phaseConfig: PhaseConfig;
  session: AuthSession | null;
  capacityCenters: CapacityCenter[];
  overview: DashboardOverview | null;
  inventoryItems: InventoryItem[];
  incidentReports: IncidentReport[];
  loadingData: boolean;
}

interface CenterMetricPresentation {
  metricPercent: number;
  metricColor: string;
  metricBg: string;
  metricLabel: string;
  statLeft: string;
  statRight: string;
}

interface ToneColors {
  metricColor: string;
  metricBg: string;
}

function getAvgUtilization(capacityCenters: CapacityCenter[]): string {
  if (capacityCenters.length === 0) {
    return "0%";
  }

  const total = capacityCenters.reduce((sum, center) => sum + center.utilizationRate, 0);
  return `${Math.round(total / capacityCenters.length)}%`;
}

function getReadinessTone(metricPercent: number, safeThreshold: number): ToneColors {
  if (metricPercent >= safeThreshold) {
    return { metricColor: "#2E7D32", metricBg: "#e8f5e9" };
  }

  if (metricPercent >= 30) {
    return { metricColor: "#FFB300", metricBg: "#fff3e0" };
  }

  return { metricColor: "#ba1a1a", metricBg: "#ffdad6" };
}

function getDuringPresentation(center: CapacityCenter): CenterMetricPresentation {
  const metricPercent = center.utilizationRate;
  let tone: ToneColors;
  if (metricPercent >= 90) {
    tone = { metricColor: "#ba1a1a", metricBg: "#ffdad6" };
  } else if (metricPercent >= 70) {
    tone = { metricColor: "#FFB300", metricBg: "#fff3e0" };
  } else {
    tone = { metricColor: "#2E7D32", metricBg: "#e8f5e9" };
  }

  return {
    metricPercent,
    metricColor: tone.metricColor,
    metricBg: tone.metricBg,
    metricLabel: "Occupied",
    statLeft: `${center.currentOccupancy.toLocaleString()} Occupied`,
    statRight: `${center.availableSlots.toLocaleString()} Available`,
  };
}

function getBeforePresentation(center: CapacityCenter): CenterMetricPresentation {
  const metricPercent = center.capacity > 0 ? Math.round((center.availableSlots / center.capacity) * 100) : 0;
  const tone = getReadinessTone(metricPercent, 60);

  return {
    metricPercent,
    metricColor: tone.metricColor,
    metricBg: tone.metricBg,
    metricLabel: "Readiness",
    statLeft: `${center.availableSlots.toLocaleString()} Available`,
    statRight: `${center.capacity.toLocaleString()} Capacity`,
  };
}

function getAfterPresentation(center: CapacityCenter): CenterMetricPresentation {
  const checkedOut = Math.max(0, center.capacity - center.currentOccupancy);
  const metricPercent = center.capacity > 0 ? Math.round((checkedOut / center.capacity) * 100) : 100;
  const tone = getReadinessTone(metricPercent, 70);

  return {
    metricPercent,
    metricColor: tone.metricColor,
    metricBg: tone.metricBg,
    metricLabel: "Cleared",
    statLeft: `${center.currentOccupancy.toLocaleString()} Remaining`,
    statRight: `${checkedOut.toLocaleString()} Checked Out`,
  };
}

function getCenterMetricPresentation(
  phase: "before" | "during" | "after",
  center: CapacityCenter,
): CenterMetricPresentation {
  if (phase === "before") {
    return getBeforePresentation(center);
  }

  if (phase === "after") {
    return getAfterPresentation(center);
  }

  return getDuringPresentation(center);
}

function getFilteredCenters(capacityCenters: CapacityCenter[], session: AuthSession | null): CapacityCenter[] {
  const municipality = session?.user?.municipality?.toLowerCase().trim();
  if (!municipality) {
    return capacityCenters;
  }

  return capacityCenters.filter(
    (center) => center.municipality.toLowerCase().trim() === municipality,
  );
}

export default function SiteMapTab({
  phase,
  phaseConfig,
  session,
  capacityCenters,
  overview,
  inventoryItems,
  incidentReports,
  loadingData,
}: Readonly<SiteMapTabProps>) {
  const activeShelters = overview?.capacity.totalCenters;
  const totalPopulation = overview?.capacity.totalOccupancy;
  const highUtilizationCenters = overview?.capacity.highUtilizationCenters;
  const avgUtilizationText = getAvgUtilization(capacityCenters);
  const displayedPopulation = totalPopulation ? totalPopulation.toLocaleString() : "0";
  const filteredCenters = getFilteredCenters(capacityCenters, session);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#232622] rounded-3xl p-6 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm min-h-[660px] relative overflow-hidden flex flex-col">
          <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-[1.8rem] py-4 px-2 shadow-sm grid grid-cols-5 divide-x divide-[#dadad5] dark:divide-[#3b3b3b] mb-5 items-center w-full text-center">
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Shelters</p>
              <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                {loadingData ? "..." : activeShelters ?? capacityCenters.length ?? "0"}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Population</p>
              <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                {loadingData ? "..." : displayedPopulation}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Critical</p>
              <p className="text-xl md:text-2xl font-black mt-1 text-[#ba1a1a] dark:text-[#ffb4ab]">
                {loadingData ? "..." : highUtilizationCenters ?? "0"}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Avg Util.</p>
              <p className="text-xl md:text-2xl font-black mt-1 text-[#2E7D32] dark:text-[#81C784]">
                {loadingData ? "..." : avgUtilizationText}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Resources</p>
              <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                {loadingData ? "..." : (overview?.inventory.totalCategories ?? inventoryItems.length ?? 0)}
              </p>
            </div>
          </div>
          <div className="flex-grow rounded-2xl overflow-hidden">
            <SiteManagerRegionalMap
              centers={capacityCenters}
              token={session?.accessToken ?? ""}
              height={600}
              phase={phase}
              assignedMunicipality={session?.user?.municipality ?? undefined}
              assignedBarangay={session?.user?.barangay ?? undefined}
              incidentReports={incidentReports}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#232622] rounded-3xl p-5 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <h4 className="text-sm font-black uppercase tracking-widest mb-4">Shelter Directory</h4>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredCenters.length === 0 ? (
                <p className="text-sm text-[#707a6c]">No shelter records available for your zone.</p>
              ) : (
                filteredCenters.map((center) => {
                  const {
                    metricPercent,
                    metricColor,
                    metricBg,
                    metricLabel,
                    statLeft,
                    statRight,
                  } = getCenterMetricPresentation(phase, center);

                  return (
                    <div key={center.id} className="p-4 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sm">{center.name}</p>
                          <p className="text-[10px] text-[#707a6c] uppercase tracking-widest">{center.barangay}, {center.municipality}</p>
                          {center.description ? (
                            <p className="mt-2 text-xs text-[#444743] dark:text-[#cfd1ca] leading-5">{center.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full" style={{ background: metricBg, color: metricColor }}>
                            {Math.round(metricPercent)}%
                          </span>
                          <span className="text-[8px] text-[#707a6c] uppercase font-black tracking-widest">{metricLabel}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#444743]">
                        <span>{statLeft}</span>
                        <span>{statRight}</span>
                      </div>
                      <div className="mt-3 rounded-xl border border-dashed border-[#dadad5] dark:border-[#3b3b3b] bg-white/60 dark:bg-[#232622] px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#707a6c] mb-2">Co-assigned managers</p>
                        {center.assignedManagers && center.assignedManagers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {center.assignedManagers.map((manager) => (
                              <span key={manager.id} className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#e8f5e9] text-[#2E7D32]">
                                {manager.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#707a6c]">No additional managers assigned.</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
