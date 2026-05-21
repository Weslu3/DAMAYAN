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

export default function SiteMapTab({
  phase,
  phaseConfig,
  session,
  capacityCenters,
  overview,
  inventoryItems,
  incidentReports,
  loadingData,
}: SiteMapTabProps) {
  const activeShelters = overview?.capacity.totalCenters;
  const totalPopulation = overview?.capacity.totalOccupancy;
  const highUtilizationCenters = overview?.capacity.highUtilizationCenters;

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
                {loadingData ? "..." : totalPopulation != null ? totalPopulation.toLocaleString() : "0"}
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
                {loadingData ? "..." : `${capacityCenters.length > 0
                  ? Math.round(capacityCenters.reduce((sum, c) => sum + c.utilizationRate, 0) / capacityCenters.length)
                  : 0}%`}
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
              {(() => {
                const filteredCenters = capacityCenters.filter(c =>
                  !session?.user?.municipality ||
                  c.municipality.toLowerCase().trim() === session.user.municipality.toLowerCase().trim()
                );

                if (filteredCenters.length === 0) {
                  return (
                    <p className="text-sm text-[#707a6c]">No shelter records available for your zone.</p>
                  );
                }

                return filteredCenters.map((center) => {
                  let metricPercent = center.utilizationRate;
                  let metricColor = center.utilizationRate >= 90 ? "#ba1a1a" : center.utilizationRate >= 70 ? "#FFB300" : "#2E7D32";
                  let metricBg = center.utilizationRate >= 90 ? "#ffdad6" : center.utilizationRate >= 70 ? "#fff3e0" : "#e8f5e9";
                  let metricLabel = "Occupied";
                  let statLeft = `${center.currentOccupancy.toLocaleString()} Occupied`;
                  let statRight = `${center.availableSlots.toLocaleString()} Available`;

                  if (phase === "before") {
                    metricPercent = center.capacity > 0 ? Math.round((center.availableSlots / center.capacity) * 100) : 0;
                    metricColor = metricPercent >= 60 ? "#2E7D32" : metricPercent >= 30 ? "#FFB300" : "#ba1a1a";
                    metricBg = metricPercent >= 60 ? "#e8f5e9" : metricPercent >= 30 ? "#fff3e0" : "#ffdad6";
                    metricLabel = "Readiness";
                    statLeft = `${center.availableSlots.toLocaleString()} Available`;
                    statRight = `${center.capacity.toLocaleString()} Capacity`;
                  } else if (phase === "after") {
                    const checkedOut = Math.max(0, center.capacity - center.currentOccupancy);
                    metricPercent = center.capacity > 0 ? Math.round((checkedOut / center.capacity) * 100) : 100;
                    metricColor = metricPercent >= 70 ? "#2E7D32" : metricPercent >= 30 ? "#FFB300" : "#ba1a1a";
                    metricBg = metricPercent >= 70 ? "#e8f5e9" : metricPercent >= 30 ? "#fff3e0" : "#ffdad6";
                    metricLabel = "Cleared";
                    statLeft = `${center.currentOccupancy.toLocaleString()} Remaining`;
                    statRight = `${checkedOut.toLocaleString()} Checked Out`;
                  }

                  return (
                    <div key={center.id} className="p-4 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sm">{center.name}</p>
                          <p className="text-[10px] text-[#707a6c] uppercase tracking-widest">{center.barangay}, {center.municipality}</p>
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
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
