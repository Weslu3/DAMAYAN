"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthSession,
  CapacityCenter,
  CheckInRecord,
  DashboardOverview,
  DisasterEvent,
  IncidentReport,
  InventoryItem,
} from "../../../lib/types";
import type {
  PhaseConfig,
  RecoveryPlanCard,
  AuditEntry,
  HistoricalDisasterRecord,
} from "../utils/siteManagerUtils";
import {
  getInventoryTone,
  formatTimestamp,
  formatMonthYear,
  formatRelativeTime,
} from "../utils/siteManagerUtils";
import {
  createIncidentReport,
  getIncidentReports,
  closeOperations,
  generateSiteReport,
} from "../../../lib/api";
import CustomSelect from "../CustomSelect";

interface DashboardTabProps {
  phase: "before" | "during" | "after";
  phaseConfig: PhaseConfig;
  session: AuthSession | null;
  overview: DashboardOverview | null;
  inventoryItems: InventoryItem[];
  checkIns: CheckInRecord[];
  incidentReports: IncidentReport[];
  capacityCenters: CapacityCenter[];
  disasterEvents: DisasterEvent[];
  loadingData: boolean;
  loadError: string | null;
  displayName: string;
  activeAlerts: number | undefined;
  recoveryPlans: RecoveryPlanCard[];
  onIncidentReportsRefreshed: (reports: IncidentReport[]) => void;
  onInventoryRefreshed: (items: InventoryItem[]) => void;
  onOpenActivityModal: () => void;
}

interface IncidentFormState {
  type: string;
  severity: string;
  description: string;
  location: string;
}

type EssentialTask = { t: string; s: string };

function getCloseOperationsLabel(isClosingOperations: boolean, isCloseOperationsArmed: boolean): string {
  if (isClosingOperations) {
    return "Closing Shelter...";
  }
  if (isCloseOperationsArmed) {
    return "Confirm Close Shelter Operations";
  }
  return "Close Shelter Operations";
}

function getOperationalLabel(openCenters: number, registeredCentersCount: number): string {
  if (openCenters > 0) {
    return "Operational";
  }
  if (registeredCentersCount === 0) {
    return "No Centers";
  }
  return "Unavailable";
}

function getOccupancyColors(occupancyPct: number, primaryColor: string): { text: string; bar: string } {
  if (occupancyPct >= 90) {
    return { text: "#ba1a1a", bar: "#ba1a1a" };
  }
  if (occupancyPct >= 70) {
    return { text: "#a16207", bar: "#FFB300" };
  }
  return { text: primaryColor, bar: primaryColor };
}

function getChecklistTone(statusText: string): { accent: string; badgeBg: string; badgeColor: string } {
  const sl = statusText.toLowerCase();
  const isGood = sl.includes("open") || sl.includes("stocked") || sl.includes("available") || sl.includes("slot") || (sl.includes("none") && sl.includes("full"));
  const isBad = sl.includes("restock") || (sl.includes("full") && !sl.includes("none")) || sl.includes("closed") || sl.includes("none registered");

  if (isBad) {
    return { accent: "#ba1a1a", badgeBg: "#fee2e2", badgeColor: "#ba1a1a" };
  }
  if (isGood) {
    return { accent: "#2E7D32", badgeBg: "#dcfce7", badgeColor: "#2E7D32" };
  }
  return { accent: "#FFB300", badgeBg: "#fef9c3", badgeColor: "#a16207" };
}

function getIncidentSeverityColor(normalized: string): string {
  if (normalized.includes("critical")) {
    return "#ba1a1a";
  }
  if (normalized.includes("high")) {
    return "#d97706";
  }
  if (normalized.includes("moderate")) {
    return "#FFB300";
  }
  return "#2E7D32";
}

function getInventoryCardColors(tone: "secure" | "warning" | "error"): { badgeClass: string; iconBg: string; bar: string } {
  if (tone === "error") {
    return {
      badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      iconBg: "#b91c1c",
      bar: "#b91c1c",
    };
  }
  if (tone === "warning") {
    return {
      badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      iconBg: "#d97706",
      bar: "#d97706",
    };
  }
  return {
    badgeClass: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    iconBg: "#2E7D32",
    bar: "#2E7D32",
  };
}

// NOSONAR - Dashboard orchestrates multiple phase workflows; full decomposition is planned separately.
export default function DashboardTab({ // NOSONAR
  phase,
  phaseConfig,
  session,
  overview,
  inventoryItems,
  checkIns,
  incidentReports,
  capacityCenters,
  disasterEvents,
  loadingData,
  loadError,
  displayName,
  activeAlerts,
  recoveryPlans,
  onIncidentReportsRefreshed,
  onInventoryRefreshed,
  onOpenActivityModal,
}: Readonly<DashboardTabProps>) {
  const router = useRouter();

  // Local state
  const [incidentFormState, setIncidentFormState] = useState<IncidentFormState>({
    type: "",
    severity: "High",
    description: "",
    location: "",
  });
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [incidentSubmitError, setIncidentSubmitError] = useState<string | null>(null);
  const [incidentSubmitSuccess, setIncidentSubmitSuccess] = useState<string | null>(null);
  const [operationsActionError, setOperationsActionError] = useState<string | null>(null);
  const [operationsActionSuccess, setOperationsActionSuccess] = useState<string | null>(null);
  const [isCloseOperationsArmed, setIsCloseOperationsArmed] = useState(false);

  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<"assess" | "structure" | "plans" | "audit">("assess");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [checklistFilter, setChecklistFilter] = useState<"all" | "high" | "low">("all");
  const [isClosingOperations, setIsClosingOperations] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSubmittingCheckIn] = useState(false);

  // Computed values
  const quantities = inventoryItems.map((item) => item.quantity);
  const sortedQuantities = quantities.slice().sort((a, b) => a - b);
  const scaleMax =
    sortedQuantities.length > 0
      ? Math.max(
          100,
          Math.min(
            2000,
            sortedQuantities[Math.floor(sortedQuantities.length * 0.75)] ||
              sortedQuantities.at(-1),
          ),
        )
      : 1000;

  const sortedByStockLevel = inventoryItems.slice().sort((a, b) => {
    const toneA = getInventoryTone(a.status);
    const toneB = getInventoryTone(b.status);
    const tonePriority = { error: 0, warning: 1, secure: 2 };
    return (tonePriority[toneA] ?? 2) - (tonePriority[toneB] ?? 2);
  });

  const filteredChecklistItems = sortedByStockLevel.filter((item) => {
    const tone = getInventoryTone(item.status);
    if (checklistFilter === "high") return tone === "secure";
    if (checklistFilter === "low") return tone === "warning" || tone === "error";
    return true;
  });

  const inventoryData = filteredChecklistItems.map((item) => {
    const percent = Math.max(5, Math.min(100, Math.round((item.quantity / scaleMax) * 100)));
    const tone = getInventoryTone(item.status);
    const statusMap: Record<string, string> = { error: "Critical", warning: "Low Stock" };
    return {
      name: item.name,
      detail: `${item.quantity.toLocaleString()} ${item.unit}`,
      percent: `${percent}%`,
      status: statusMap[tone] || "Secure",
      tone,
    };
  });

  const checkInActivity = checkIns
    .map((entry) => {
      const fullName = (
        entry.fullName || `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim()
      ).trim();
      const location = entry.location?.trim();
      const checkInTime = entry.checkInTime?.trim();
      if (!fullName || !location || !checkInTime) return null;
      const normalizedName = fullName.toLowerCase();
      if (normalizedName.startsWith("unknown") || normalizedName === "user") return null;
      return {
        at: new Date(checkInTime).getTime() || 0,
        t: formatRelativeTime(checkInTime),
        m: `Check-in: ${fullName} at ${location}`,
      };
    })
    .filter((e): e is { at: number; t: string; m: string } => e !== null);

  const incidentActivity = incidentReports
    .map((report) => {
      const title = report.title?.trim();
      const status = report.status?.trim();
      const location = report.location?.trim();
      const createdAt = report.createdAt?.trim();
      if (!title || !status || !location || !createdAt) return null;
      return {
        at: new Date(createdAt).getTime() || 0,
        t: formatRelativeTime(createdAt),
        m: `Incident: ${title} (${status}) at ${location}`,
      };
    })
    .filter((e): e is { at: number; t: string; m: string } => e !== null);

  const activityLogs = [...checkInActivity, ...incidentActivity]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map(({ t, m }) => ({ t, m }));

  const incidentTypeOptions = [
    "Earthquake", "Tsunami", "Typhoon", "Storm Surge", "Landslide", "Volcanic Ashfall",
    "Aftershock", "Medical Emergency", "Injury", "Fire", "Flooding", "Security Concern",
    "Missing Person", "Crowd Control", "Facility Damage", "Power Outage", "Sanitation Issue",
    "Supply Shortage",
  ];

  const incidentSeverityOptions = Array.from(
    new Set(
      ["Critical", "High", "Moderate", "Low"].concat(
        incidentReports
          .map((r) => r.severity?.trim())
          .concat(disasterEvents.map((e) => e.severityLevel?.trim()))
          .concat(incidentFormState.severity)
          .filter((v): v is string => Boolean(v && v.length > 0)),
      ),
    ),
  );

  const incidentSeverityButtonOrder = ["Critical", "High", "Moderate", "Low"];
  const orderedIncidentSeverityButtons = incidentSeverityButtonOrder.filter((level) =>
    incidentSeverityOptions.some((option) => option.toLowerCase() === level.toLowerCase()),
  );

  

  const incidentLocationOptions = Array.from(
    new Set(
      capacityCenters
        .map((c) => [c.name, c.barangay, c.municipality].filter(Boolean).join(", "))
        .filter((v) => v.length > 0),
    ),
  );

  const archivedDisasterEvents = disasterEvents.filter(
    (e) => e.status.toLowerCase() !== "active" || Boolean(e.dateEnded),
  );

  const historicalDisasterSource =
    archivedDisasterEvents.length > 0 ? archivedDisasterEvents : disasterEvents;

  const historicalDisasterReports: HistoricalDisasterRecord[] = historicalDisasterSource
    .slice()
    .sort((a, b) => new Date(b.dateStarted).getTime() - new Date(a.dateStarted).getTime())
    .map((event) => ({
      id: event.id,
      name: event.name,
      date: formatMonthYear(event.dateEnded || event.dateStarted),
      severity: event.severityLevel,
      province: event.province,
      affectedAreas: event.affectedAreas.length,
      status: event.status,
      lessonsLearned:
        event.notes?.trim() ||
        "No post-event notes have been recorded for this disaster event yet.",
      fullText:
        `${event.name} (${event.type}) affected ${event.affectedAreas.join(", ") || event.province}. Status: ${event.status}. Started ${formatTimestamp(event.dateStarted)}` +
        (event.dateEnded
          ? ` and ended ${formatTimestamp(event.dateEnded)}`
          : " and remains active."),
    }));

  const selectedHistoricalReport =
    historicalDisasterReports.find((r) => r.id === selectedReportId) ?? null;

  const visibleIncidentReports = incidentReports.filter((report) => {
    const normalizedTitle = (report.title || "").toLowerCase();
    return !normalizedTitle.includes("after-action assessment");
  });

  const operationalAuditEntries: AuditEntry[] = [
    ...visibleIncidentReports.map((report) => ({
      id: `incident-${report.id}`,
      title: report.title,
      timestamp: formatTimestamp(report.createdAt),
      source: "Incident Report",
      status: report.status,
      note: `${report.severity} severity at ${report.location}`,
      sortAt: new Date(report.createdAt).getTime() || 0,
    })),
    ...checkIns.map((entry) => ({
      id: `checkin-${entry.id}`,
      title: entry.fullName || entry.evacueeNumber,
      timestamp: formatTimestamp(entry.checkInTime),
      source: "Check-in",
      status: entry.status,
      note: `${entry.zone || "Unknown zone"} • ${entry.location || "Unknown location"}`,
      sortAt: new Date(entry.checkInTime ?? "").getTime() || 0,
    })),
  ]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 10);

  let inventoryTaskStatus = "Pending";
  if (loadingData) inventoryTaskStatus = "Loading";
  else if (inventoryItems.length > 0) inventoryTaskStatus = "Ready";

  let commsTaskStatus = "Active";
  if (loadingData) commsTaskStatus = "Loading";
  else if (loadError) commsTaskStatus = "Needs Attention";

  let volunteerTaskStatus = "Pending";
  if (loadingData) volunteerTaskStatus = "Loading";
  else if ((overview?.checkIns.total ?? checkIns.length) > 0) volunteerTaskStatus = "Complete";

  const centerStatusBuckets = capacityCenters.reduce(
    (acc, center) => {
      const rawStatus = (center.status || "").toLowerCase().trim();
      const capacity = center.capacity ?? 0;
      const availableSlots = center.availableSlots;
      const currentOccupancy = center.currentOccupancy;

      if (rawStatus.includes("closed") || rawStatus.includes("inactive") || rawStatus.includes("offline")) {
        acc.closed += 1;
        return acc;
      }
      if (rawStatus.includes("full") || rawStatus.includes("capacity")) {
        acc.full += 1;
        return acc;
      }
      if (rawStatus.includes("open") || rawStatus.includes("operational") || rawStatus.includes("active")) {
        acc.open += 1;
        return acc;
      }

      if (capacity <= 0) {
        acc.closed += 1;
      } else if (typeof availableSlots === "number") {
        if (availableSlots <= 0) acc.full += 1;
        else acc.open += 1;
      } else if (typeof currentOccupancy === "number") {
        if (currentOccupancy >= capacity) acc.full += 1;
        else acc.open += 1;
      } else {
        acc.open += 1;
      }

      return acc;
    },
    { open: 0, full: 0, closed: 0 },
  );

  const registeredCentersCount = capacityCenters.length;
  const openCenters = centerStatusBuckets.open;
  const fullCenters = centerStatusBuckets.full;
  const closedCenters = centerStatusBuckets.closed;
  const availableItems = inventoryItems.filter((i) => i.status === "available").length;
  const depletedItems = inventoryItems.filter((i) => i.status === "depleted").length;
  const totalFreeSlots = capacityCenters.reduce((sum, c) => sum + (c.availableSlots ?? 0), 0);
  const totalCapacity = capacityCenters.reduce((sum, c) => sum + (c.capacity ?? 0), 0);
  const totalOccupancy = capacityCenters.reduce((sum, c) => sum + (c.currentOccupancy ?? 0), 0);
  const occupancyPct = totalCapacity > 0 ? Math.min(100, Math.round((totalOccupancy / totalCapacity) * 100)) : 0;
  const normalizedCheckIns = checkIns.map((entry) => (entry.status || "").toLowerCase());
  const currentlyShelteredCount = normalizedCheckIns.filter((status) => status === "checked_in").length;
  const returnedHomeCount = normalizedCheckIns.filter((status) => status === "checked_out").length;
  const totalProcessedEvacuees = checkIns.length;

  const closedIncidentCount = incidentReports.filter((report) => {
    const status = (report.status || "").toLowerCase();
    return status === "closed" || status === "actioned" || status === "resolved" || status === "completed";
  }).length;
  const openIncidentCount = Math.max(0, incidentReports.length - closedIncidentCount);

  const readyToCloseCenters = capacityCenters.filter((center) => (center.currentOccupancy ?? 0) <= 0).length;
  const activeCenters = capacityCenters.filter((center) => (center.currentOccupancy ?? 0) > 0).length;
  const highLoadCenters = capacityCenters.filter((center) => {
    const capacity = center.capacity ?? 0;
    if (capacity <= 0) return false;
    const utilization = center.utilizationRate ?? ((center.currentOccupancy ?? 0) / capacity) * 100;
    return utilization >= 80;
  }).length;

  const criticalSupplyGaps = inventoryItems.filter((item) => {
    const tone = getInventoryTone(item.status);
    return tone === "error" || tone === "warning";
  }).length;

  let essentialTasks: EssentialTask[];
  if (phase === "after") {
    essentialTasks = [
      { t: "Evacuees Still Sheltered", s: `${currentlyShelteredCount} Remaining` },
      { t: "Open Incident Follow-ups", s: openIncidentCount > 0 ? `${openIncidentCount} Open` : "All Closed" },
      { t: "Centers Ready to Close", s: registeredCentersCount === 0 ? "No Centers" : `${readyToCloseCenters} Ready` },
    ];
  } else if (phase === "before") {
    essentialTasks = [
      { t: "Centers Ready", s: registeredCentersCount === 0 ? "None Registered" : `${openCenters} Open` },
      { t: "Centers at Capacity", s: fullCenters > 0 ? `${fullCenters} Full` : "None Full" },
      { t: "Stocked Inventory Items", s: inventoryItems.length === 0 ? "None Logged" : `${availableItems} Available` },
      { t: "Depleted Items", s: depletedItems > 0 ? `${depletedItems} Need Restock` : "All Stocked" },
      { t: "Free Shelter Slots", s: totalCapacity === 0 ? "No Centers" : `${totalFreeSlots} Slots` },
    ];
  } else {
    essentialTasks = [
      { t: "Inventory Validation", s: inventoryTaskStatus },
      { t: "Comms Stabilization", s: commsTaskStatus },
      { t: "Volunteer Briefing", s: volunteerTaskStatus },
    ];
  }

  const closeOperationsLabel = getCloseOperationsLabel(isClosingOperations, isCloseOperationsArmed);
  const operationalLabel = getOperationalLabel(openCenters, registeredCentersCount);
  const occupancyColors = getOccupancyColors(occupancyPct, phaseConfig.primaryColor);

  useEffect(() => {
    if (historicalDisasterReports.length === 0) {
      if (selectedReportId !== null) setSelectedReportId(null);
      return;
    }
    if (!selectedReportId || !historicalDisasterReports.some((r) => r.id === selectedReportId)) {
      setSelectedReportId(historicalDisasterReports[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalDisasterReports]);

  // Handlers
  const handleSubmitIncidentReport = async () => {
    if (!session?.accessToken || !session.user) {
      setIncidentSubmitError("Session expired. Please login again.");
      return;
    }

    if (!incidentFormState.type || !incidentFormState.location || !incidentFormState.description) {
      setIncidentSubmitError("Please fill in all required fields.");
      return;
    }

    const disasterId =
      disasterEvents.find((e) => e.status?.toLowerCase() === "active")?.id ??
      disasterEvents[0]?.id;

    if (!disasterId) {
      setIncidentSubmitError("No active disaster event found. Please create one first.");
      return;
    }

    setIsSubmittingIncident(true);
    setIncidentSubmitError(null);
    setIncidentSubmitSuccess(null);

    const normalizedSeverity = (() => {
      const value = incidentFormState.severity.trim().toLowerCase();
      if (value === "medium") return "moderate";
      if (value === "severe") return "critical";
      if (["low", "moderate", "high", "critical"].includes(value)) {
        return value;
      }
      return "high";
    })();

    try {
      await createIncidentReport(session.accessToken, {
        disasterId,
        reportedBy: session.user.id,
        title: incidentFormState.type,
        content: incidentFormState.description,
        severity: normalizedSeverity,
        location: incidentFormState.location,
      });

      setIncidentFormState({ type: "", severity: "High", description: "", location: "" });
      const freshReports = await getIncidentReports(session.accessToken);
      onIncidentReportsRefreshed(freshReports);
      setIncidentSubmitSuccess("Incident report submitted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit incident report";
      setIncidentSubmitError(message);
      console.error("Incident report error:", error);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const handleCloseOperations = async () => {
    if (!session?.accessToken) {
      setOperationsActionError("Session expired. Please login again.");
      return;
    }
    setOperationsActionError(null);
    setOperationsActionSuccess(null);

    if (!isCloseOperationsArmed) {
      setIsCloseOperationsArmed(true);
      setOperationsActionError("Click 'Close Shelter Operations' again to confirm shelter lockdown. This action cannot be undone.");
      return;
    }

    setIsClosingOperations(true);
    try {
      await closeOperations(session.accessToken);
      setOperationsActionSuccess("Operations closed successfully. Site is now in lockdown.");
      setIsCloseOperationsArmed(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to close operations";
      setOperationsActionError(message);
      console.error("Close operations error:", error);
    } finally {
      setIsClosingOperations(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!session?.accessToken) {
      setOperationsActionError("Session expired. Please login again.");
      return;
    }
    setOperationsActionError(null);
    setOperationsActionSuccess(null);
    setIsCloseOperationsArmed(false);
    setIsGeneratingReport(true);
    try {
      await generateSiteReport(session.accessToken);
      setOperationsActionSuccess("Site summary report generated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate report";
      setOperationsActionError(message);
      console.error("Generate report error:", error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const renderDashboardLayout = () => ( // NOSONAR
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Main Action Card */}
      <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold">{phaseConfig.checklistTitle}</h3>
            <p className="text-[#444743] text-sm">{phaseConfig.checklistDesc}</p>
          </div>
          <div className="bg-[#f4f4ef] dark:bg-[#232622] px-4 py-2 rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>verified</span>
            <span className="text-sm font-bold">Priority Status</span>
          </div>
        </div>

        {phase === "after" ? (
          <div className="space-y-6 mb-8 animate-in fade-in duration-500">
            {/* Recovery Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-[#dadad5]/40 dark:bg-[#3b3b3b]/30 p-1.5 rounded-2xl w-full">
              <button
                onClick={() => setRecoveryTab("assess")}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "assess" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                <span>1. People Operations</span>
              </button>
              <button
                onClick={() => setRecoveryTab("structure")}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "structure" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
              >
                <span className="material-symbols-outlined text-sm">home_work</span>
                <span>2. Shelter Demobilization</span>
              </button>
              <button
                onClick={() => setRecoveryTab("plans")}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "plans" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
              >
                <span className="material-symbols-outlined text-sm">target</span>
                <span>3. Recovery Plans</span>
              </button>
              <button
                onClick={() => setRecoveryTab("audit")}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "audit" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
              >
                <span className="material-symbols-outlined text-sm">assignment</span>
                <span>4. Audit & History</span>
              </button>
            </div>

            {/* Tab 1: People Operations Tracker */}
            {recoveryTab === "assess" && (
              <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6">
                <div>
                  <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                    <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>groups</span>
                    <span>Post-Event People Operations Tracker</span>
                  </h4>
                  <p className="text-xs text-[#707a6c] mt-1">Live after-calamity overview focused on evacuees, incidents, shelter closure readiness, and supply continuity.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-left">
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Evacuees Remaining</p>
                    <p className="text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">{currentlyShelteredCount}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">Still checked in at active shelters</p>
                  </div>
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Returned Safely</p>
                    <p className="text-2xl font-black mt-1 text-[#2E7D32]">{returnedHomeCount}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">Checked-out evacuees recorded in system</p>
                  </div>
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Open Incident Follow-ups</p>
                    <p className="text-2xl font-black mt-1" style={{ color: openIncidentCount > 0 ? "#ba1a1a" : "#2E7D32" }}>{openIncidentCount}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">{closedIncidentCount} closed of {incidentReports.length} total</p>
                  </div>
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Centers Ready To Close</p>
                    <p className="text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">{readyToCloseCenters}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">{activeCenters} centers still housing evacuees</p>
                  </div>
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Critical Supply Gaps</p>
                    <p className="text-2xl font-black mt-1" style={{ color: criticalSupplyGaps > 0 ? "#ba1a1a" : "#2E7D32" }}>{criticalSupplyGaps}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">Low or depleted inventory items</p>
                  </div>
                  <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Total Processed Evacuees</p>
                    <p className="text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">{totalProcessedEvacuees}</p>
                    <p className="text-[10px] font-bold mt-1 text-[#444743] dark:text-[#a0a39f]">All check-in/out records logged</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8,"
                        + "Record ID,Evacuee Number,Full Name,Zone,Location,Status\n"
                        + checkIns.map((entry) => `${entry.id},${entry.evacueeNumber},"${entry.fullName}","${entry.zone}","${entry.location}",${entry.status}`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "Damayan_Final_Evacuee_Roster.csv");
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}
                    className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] text-[#1a1c19] dark:text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#eeeeea] dark:hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>Finalize Evacuee Roster
                  </button>
                  <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="w-full bg-[#f4f4ef] dark:bg-[#232622] text-black dark:text-white border border-[#dadad5] dark:border-[#3b3b3b] py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 hover:bg-[#dadad5] dark:hover:bg-[#3b3b3b] disabled:opacity-50">
                    <span className={`material-symbols-outlined text-sm ${isGeneratingReport ? "animate-spin" : ""}`}>analytics</span>
                    {isGeneratingReport ? "Generating Report..." : "Generate Operations Summary"}
                  </button>
                  <button onClick={handleCloseOperations} disabled={isClosingOperations} className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    {closeOperationsLabel}
                  </button>
                </div>

                {operationsActionError && (
                  <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
                    {operationsActionError}
                  </div>
                )}

                {operationsActionSuccess && (
                  <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
                    {operationsActionSuccess}
                  </div>
                )}

                {isCloseOperationsArmed && !isClosingOperations && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setIsCloseOperationsArmed(false);
                        setOperationsActionError(null);
                      }}
                      className="text-xs font-black uppercase tracking-wider text-[#444743] dark:text-[#a0a39f] hover:text-[#1a1c19] dark:hover:text-white"
                    >
                      Cancel Close-Out
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Tab 2: Shelter Demobilization */}
            {recoveryTab === "structure" && (
              <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6 animate-in fade-in duration-500">
                <div className="text-left">
                  <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                    <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>home_work</span>
                    <span>Shelter Demobilization & Return Operations</span>
                  </h4>
                  <p className="text-xs text-[#707a6c] mt-1">Coordinate center closure readiness and evacuee return workflow using live occupancy and incident records.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4 text-left">
                    <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white pb-3 border-b border-[#dadad5]/50">Closure Readiness Snapshot</h5>
                    <div className="grid grid-cols-1 gap-3 text-xs">
                      <div className="rounded-xl bg-[#f4f4ef] dark:bg-[#232622] px-3 py-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Centers Ready to Close</p>
                        <p className="text-lg font-black text-[#1a1c19] dark:text-white mt-1">{readyToCloseCenters}</p>
                      </div>
                      <div className="rounded-xl bg-[#f4f4ef] dark:bg-[#232622] px-3 py-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">Centers Still Active</p>
                        <p className="text-lg font-black text-[#1a1c19] dark:text-white mt-1">{activeCenters}</p>
                      </div>
                      <div className="rounded-xl bg-[#f4f4ef] dark:bg-[#232622] px-3 py-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-[#707a6c]">High-Load Centers (&gt;=80%)</p>
                        <p className="text-lg font-black mt-1" style={{ color: highLoadCenters > 0 ? "#ba1a1a" : "#2E7D32" }}>{highLoadCenters}</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] overflow-hidden">
                    <div className="flex justify-between items-center pb-3.5 border-b border-[#dadad5]/50 mb-4">
                      <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">Center Occupancy & Follow-up Queue</h5>
                      <span className="bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 px-2.5 py-0.5 rounded text-[9px] font-black uppercase border border-green-200/50">Live</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[560px]">
                        <thead>
                          <tr className="border-b border-[#dadad5]/50 text-[#707a6c] font-black text-[9px] uppercase tracking-wider">
                            <th className="pb-3">Center</th>
                            <th className="pb-3 text-right">Occupancy</th>
                            <th className="pb-3 text-right">Capacity</th>
                            <th className="pb-3 text-right">Utilization</th>
                            <th className="pb-3 text-right">Available Slots</th>
                            <th className="pb-3 text-right">Readiness</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dadad5]/30">
                          {capacityCenters.map((center) => {
                            const occupancy = center.currentOccupancy ?? 0;
                            const capacity = center.capacity ?? 0;
                            const utilization = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
                            const readinessLabel = occupancy <= 0 ? "Ready" : "Active";
                            const readinessColor = occupancy <= 0 ? "#2E7D32" : "#ba1a1a";
                            return (
                              <tr key={center.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors font-bold">
                                <td className="py-3.5 text-[#1a1c19] dark:text-white">{center.name}</td>
                                <td className="py-3.5 text-right text-[#444743] dark:text-[#a0a39f]">{occupancy}</td>
                                <td className="py-3.5 text-right text-[#444743] dark:text-[#a0a39f]">{capacity}</td>
                                <td className="py-3.5 text-right text-[#444743] dark:text-[#a0a39f]">{utilization}%</td>
                                <td className="py-3.5 text-right text-[#444743] dark:text-[#a0a39f]">{center.availableSlots ?? Math.max(0, capacity - occupancy)}</td>
                                <td className="py-3.5 text-right">
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-[#f4f4ef] dark:bg-[#232622] px-2 py-0.5 rounded" style={{ color: readinessColor }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: readinessColor }}></span>{readinessLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Recovery Plans */}
            {recoveryTab === "plans" && (
              <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6">
                <div>
                  <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                    <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>target</span>
                    <span>Published Rehabilitation & Recovery Plans</span>
                  </h4>
                  <p className="text-xs text-[#707a6c] mt-1">Oversight panel to track, adjust, and report progress on ground execution.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recoveryPlans.map((plan) => (
                    <div key={plan.id} className="bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col justify-between gap-4 shadow-sm text-left">
                      <div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-50 text-[#2E7D32] dark:bg-green-950/40 dark:text-[#81C784] border border-[#2E7D32]/10">{plan.status}</span>
                          <span className="text-[10px] text-[#707a6c] font-bold">Lead: {plan.lead}</span>
                        </div>
                        <h5 className="font-black text-sm text-[#1a1c19] dark:text-white mt-3.5 leading-snug">{plan.name}</h5>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#444743] dark:text-[#a0a39f]">Completion Progress</span>
                          <span className="font-black text-sm" style={{ color: phaseConfig.primaryColor }}>{plan.progress}%</span>
                        </div>
                        <div className="w-full bg-[#f4f4ef] dark:bg-[#232622] h-2.5 rounded-full overflow-hidden border border-[#dadad5] dark:border-[#3b3b3b]">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${plan.progress}%`, background: phaseConfig.primaryColor }}></div>
                        </div>
                        <div className="rounded-xl bg-[#f4f4ef] dark:bg-[#232622] px-3 py-2 text-[10px] font-bold text-[#444743] dark:text-[#a0a39f]">
                          Derived from live shelter, incident, inventory, and disaster-event records.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Audit & History */}
            {recoveryTab === "audit" && (
              <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6 animate-in fade-in duration-500">
                <div className="text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                      <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>history</span>
                      <span>System Auditing & Historical Incident Logs</span>
                    </h4>
                    <p className="text-xs text-[#707a6c] mt-1">Review live operational activity and historical disaster events already stored in the backend.</p>
                  </div>
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8,"
                        + "Entry ID,Title,Timestamp,Source,Status,Note\n"
                        + operationalAuditEntries.map((entry) => `${entry.id},"${entry.title}","${entry.timestamp}",${entry.source},${entry.status},"${entry.note}"`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "Damayan_Auditing_Activity_Log.csv");
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}
                    className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] hover:bg-[#eeeeea] dark:hover:bg-white/5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shrink-0 text-[#1a1c19] dark:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>Export Auditing CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">1. Regional Historical Calamity Repository</h5>
                        <p className="text-[10px] text-[#707a6c] mt-0.5">Filter and reference response metrics of past tropical cyclones.</p>
                      </div>
                      <input type="text" value={historySearchQuery} onChange={(e) => setHistorySearchQuery(e.target.value)} placeholder="Search cyclones (e.g. Pepito)..." className="bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] rounded-full px-4 py-1.5 text-xs font-bold outline-none w-full sm:w-48 text-[#1a1c19] dark:text-white" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {historicalDisasterReports.filter((r) => r.name.toLowerCase().includes(historySearchQuery.toLowerCase())).map((rpt) => {
                        const isSelected = selectedReportId === rpt.id;
                        return (
                          <button
                            key={rpt.id}
                            type="button"
                            onClick={() => setSelectedReportId(rpt.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${isSelected ? "border-green-600 bg-green-50/20 dark:bg-green-950/10 shadow-sm" : "border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef]/30 dark:bg-[#232622]/30 hover:border-green-600/50"}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-black text-xs text-[#1a1c19] dark:text-white leading-tight">{rpt.name}</p>
                              <span className="text-[8px] font-black uppercase text-[#707a6c] shrink-0">{rpt.date}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-[#444743] dark:text-[#a0a39f] font-bold border-t border-[#dadad5]/50 pt-2.5">
                              <div><p className="text-[8px] uppercase tracking-wider text-[#707a6c]">Severity</p><p className="font-black text-[#1a1c19] dark:text-white">{rpt.severity}</p></div>
                              <div><p className="text-[8px] uppercase tracking-wider text-[#707a6c]">Affected Areas</p><p className="font-black text-[#1a1c19] dark:text-white">{rpt.affectedAreas}</p></div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedHistoricalReport && (
                      <div className="bg-[#f4f4ef]/50 dark:bg-[#232622]/50 border border-green-600/20 p-4 rounded-xl space-y-3 mt-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center pb-2 border-b border-[#dadad5]/50">
                          <span className="font-black text-[10px] uppercase text-green-700 tracking-wider">Lessons Learned File: {selectedHistoricalReport.name}</span>
                          <span className="material-symbols-outlined text-sm text-green-700">inventory</span>
                        </div>
                        <p className="font-bold text-[#444743] uppercase tracking-wider text-[8px]">Lessons Learned & Recommendations</p>
                        <p className="text-[#1a1c19] dark:text-[#e2e3dd] italic leading-relaxed">"{selectedHistoricalReport.lessonsLearned}"</p>
                        <p className="font-bold text-[#444743] uppercase tracking-wider text-[8px] pt-1">Full Incident Report Log</p>
                        <p className="text-[#444743] dark:text-[#a0a39f] leading-relaxed">{selectedHistoricalReport.fullText}</p>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-4 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-5 text-left">
                    <div className="pb-3 border-b border-[#dadad5]/50 flex justify-between items-center">
                      <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">2. Historical Event Snapshot</h5>
                      <span className="bg-green-50 text-green-700 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-green-200/50">BACKEND SYNCED</span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Historical Disaster Event</span>
                        <CustomSelect value={selectedReportId || ""} onChange={(val: any) => setSelectedReportId(val || null)} placeholder="-- Select Historical Event --" options={historicalDisasterReports.map((rpt) => ({ value: rpt.id, label: rpt.name }))} />
                      </div>
                      {selectedHistoricalReport ? (
                        <div className="space-y-3 rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] p-4 text-xs font-bold text-[#444743] dark:text-[#a0a39f]">
                          <div><p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Severity</p><p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.severity}</p></div>
                          <div><p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Province</p><p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.province}</p></div>
                          <div><p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Affected Areas</p><p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.affectedAreas}</p></div>
                          <div><p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Lifecycle Status</p><p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.status}</p></div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] p-4 text-xs font-bold text-[#707a6c]">No historical disaster records are available from the backend yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-12 bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">3. Operational Activity Feed</h5>
                      <span className="bg-[#2E7D32]/10 text-[#2E7D32] dark:text-[#81C784] text-[8px] font-black uppercase px-2 py-0.5 rounded border border-[#2E7D32]/20">{operationalAuditEntries.length} LIVE RECORDS</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-[#dadad5]/50 text-[#707a6c] font-black text-[9px] uppercase tracking-wider">
                            <th className="pb-2">Activity</th>
                            <th className="pb-2">Logged Time</th>
                            <th className="pb-2 text-center">Source</th>
                            <th className="pb-2 text-center">Status</th>
                            <th className="pb-2 text-right">Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dadad5]/30">
                          {operationalAuditEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors font-bold">
                              <td className="py-3"><p className="text-[#1a1c19] dark:text-white">{entry.title}</p><p className="text-[9px] text-[#707a6c] font-mono mt-0.5">{entry.note}</p></td>
                              <td className="py-3 font-medium text-[#707a6c] whitespace-nowrap">{entry.timestamp}</td>
                              <td className="py-3 text-center">{entry.source}</td>
                              <td className="py-3 text-center">{entry.status}</td>
                              <td className="py-3 text-right"><span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${entry.status.toLowerCase() === "resolved" || entry.status.toLowerCase() === "checked_in" || entry.status.toLowerCase() === "processed" ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>{entry.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Before / During phase checklist */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {phase === "before" ? (
              /* Evacuation Center Status — data from DB */
              <div className="rounded-2xl overflow-hidden flex flex-col shadow-sm border border-[#dadad5] dark:border-[#3a3d38] transition-all hover:shadow-md">
                {/* Header strip */}
                <div className="px-6 py-5 flex items-center justify-between" style={{ background: phaseConfig.primaryContainer }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl text-white/90">home_work</span>
                    <div>
                      <h4 className="font-black text-white text-base leading-tight">Evacuation Centers</h4>
                      <p className="text-white/60 text-[10px] uppercase tracking-wider mt-0.5">{registeredCentersCount} center{registeredCentersCount === 1 ? "" : "s"} registered</p>
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <span className="text-white text-[10px] font-black uppercase tracking-wider">
                      {operationalLabel}
                    </span>
                  </div>
                </div>
                {/* Stat row */}
                <div className="grid grid-cols-3 divide-x divide-[#dadad5] dark:divide-[#3a3d38] bg-[#f4f4ef] dark:bg-[#232622]">
                  {[
                    { label: "Open", count: openCenters, color: "#2E7D32", icon: "check_circle" },
                    { label: "Full", count: fullCenters, color: "#FFB300", icon: "warning" },
                    { label: "Closed", count: closedCenters, color: "#ba1a1a", icon: "cancel" },
                  ].map(({ label, count, color, icon }) => (
                    <div key={label} className="py-5 flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-lg" style={{ color }}>{icon}</span>
                      <p className="text-3xl font-black leading-none" style={{ color }}>{count}</p>
                      <p className="text-[9px] font-bold uppercase text-[#444743]">{label}</p>
                    </div>
                  ))}
                </div>
                {/* Occupancy bar */}
                <div className="px-6 py-5 bg-[#f4f4ef] dark:bg-[#232622] border-t border-[#dadad5] dark:border-[#3a3d38]">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[10px] font-black uppercase text-[#444743] tracking-wider">Total Occupancy</span>
                    <span className="text-xs font-black" style={{ color: occupancyColors.text }}>
                      {totalCapacity > 0 ? `${totalOccupancy.toLocaleString()} / ${totalCapacity.toLocaleString()}` : "No capacity data"}
                    </span>
                  </div>
                  <div className="w-full bg-[#dadad5] dark:bg-[#3a3d38] rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-700"
                      style={{
                        width: `${occupancyPct}%`,
                        background: occupancyColors.bar,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-[#444743]">{occupancyPct}% utilized</span>
                    <span className="text-[10px] text-[#444743]">{totalFreeSlots.toLocaleString()} slots free</span>
                  </div>
                </div>
                {/* Footer button */}
                <div className="px-6 py-5 bg-[#f4f4ef] dark:bg-[#232622]">
                  <button
                    onClick={() => router.push(`/site-manager/sitemap?phase=${phase}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all hover:shadow-md active:scale-95"
                    style={{ borderColor: phaseConfig.primaryColor, color: phaseConfig.primaryColor }}
                  >
                    <span className="material-symbols-outlined text-[18px]">map</span>
                    <span>View Site Map</span>
                  </button>
                </div>
              </div>
            ) : (
              /* During phase — Response Checkpoint */
              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-10 rounded-2xl border-b-4 flex flex-col items-center text-center transition-all hover:shadow-md" style={{ borderColor: phaseConfig.primaryColor }}>
                <span className="material-symbols-outlined text-5xl mb-4" style={{ color: phaseConfig.primaryColor }}>qr_code_scanner</span>
                <h4 className="font-bold text-lg mb-2">Response Checkpoint</h4>
                <p className="text-sm text-[#444743] mb-6">Use the Citizens tab for QR check-in/check-out and identity verification.</p>
                <button
                  onClick={() => router.push(`/site-manager/${phase}calamity?tab=citizens`)}
                  disabled={isSubmittingCheckIn || isClosingOperations}
                  className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                  style={{ background: phaseConfig.primaryColor }}
                >
                  {isSubmittingCheckIn || isClosingOperations ? "Processing..." : "Open Citizens Tab"}
                </button>
              </div>
            )}

            <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-8 rounded-2xl flex flex-col justify-between border border-[#dadad5] dark:border-[#3a3d38]">
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: phaseConfig.primaryColor }}>
                    <span className="material-symbols-outlined text-white text-[18px]">checklist</span>
                  </div>
                  <h4 className="font-black text-base">Pre-Disaster Checklist</h4>
                </div>
                <ul className="space-y-2">
                  {essentialTasks.map((task) => {
                    const tones = getChecklistTone(task.s);
                    return (
                      <li key={task.t} className="flex justify-between items-center text-sm py-3 px-3 rounded-xl bg-white/50 dark:bg-white/5 border-l-4" style={{ borderLeftColor: tones.accent }}>
                        <span className="font-medium text-[#1a1c19] dark:text-[#e2e3dd]">{task.t}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ml-2 shrink-0" style={{ background: tones.badgeBg, color: tones.badgeColor }}>{task.s}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {activityLogs.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#dadad5] dark:border-[#3a3d38]">
                  <p className="text-[10px] font-black text-[#444743] uppercase tracking-widest mb-1.5">Latest Activity</p>
                  <p className="text-xs text-[#444743] dark:text-[#a0a39f] leading-relaxed">{activityLogs[0].m}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Incident Report Section (During Phase Only) */}
        {phase === "during" && (
          <div className="mt-8 pt-8 border-t border-[#dadad5] animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1 pr-6">
                <h3 className="text-xl font-black text-[#1a1c19] dark:text-white leading-tight">Report Site Incident</h3>
                <p className="text-[#444743] text-sm">Log critical events or medical emergencies immediately.</p>
              </div>
              <button onClick={() => setIsAlertsModalOpen(true)} className="bg-orange-100 hover:bg-orange-200 text-[#FFB300] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95 cursor-pointer flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {activeAlerts} active alerts
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="block text-[10px] font-black uppercase text-[#444743] ml-1">Location <span className="text-red-600">*</span></span>
                <CustomSelect value={incidentFormState.location} onChange={(val: any) => setIncidentFormState({ ...incidentFormState, location: val })} placeholder={incidentLocationOptions.length > 0 ? "Select location" : "No center locations available"} options={incidentLocationOptions.map((location) => ({ value: location, label: location }))} />
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-black uppercase text-[#444743] ml-1">Incident Type <span className="text-red-600">*</span></span>
                <CustomSelect value={incidentFormState.type} onChange={(val: any) => setIncidentFormState({ ...incidentFormState, type: val })} placeholder={incidentTypeOptions.length > 0 ? "Select incident type" : "No incident types available"} options={incidentTypeOptions.map((option) => ({ value: option, label: option }))} />
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-black uppercase text-[#444743] ml-1">Severity <span className="text-red-600">*</span></span>
                <div className="flex gap-2">
                  {orderedIncidentSeverityButtons.map((severity) => {
                    const normalized = severity.toLowerCase();
                    const selected = incidentFormState.severity === severity;
                    const activeColor = getIncidentSeverityColor(normalized);
                    return (
                      <button key={severity} onClick={() => setIncidentFormState({ ...incidentFormState, severity })} className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl text-white shadow-md transition-all active:scale-95" style={{ background: selected ? activeColor : "#dadad5", color: selected ? "white" : "#444743" }}>
                        {severity}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <span className="block text-[10px] font-black uppercase text-[#444743] ml-1">Detailed Description <span className="text-red-600">*</span></span>
                <textarea className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-sm min-h-[100px]" placeholder="Describe the situation..." value={incidentFormState.description} onChange={(e) => setIncidentFormState({ ...incidentFormState, description: e.target.value })}></textarea>
              </div>
            </div>
            {incidentSubmitError && <p className="text-red-600 text-sm mt-3">{incidentSubmitError}</p>}
            {incidentSubmitSuccess && <p className="text-green-700 dark:text-green-400 text-sm mt-3 font-medium">{incidentSubmitSuccess}</p>}
            <button onClick={handleSubmitIncidentReport} disabled={isSubmittingIncident} className="mt-4 w-full bg-[#1a1c19] text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: "#1a1c19" }}>
              {isSubmittingIncident ? "Submitting..." : "Submit Incident Report"}
            </button>
          </div>
        )}
      </section>

      {/* Inventory Checklist */}
      <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8 border-b border-[#dadad5]/30 pb-6">
            <div>
              <h3 className="text-2xl font-bold">Essential Supply Checklist</h3>
              <p className="text-[#444743] dark:text-[#a0a39f] text-sm">{phase === "after" ? "Compact post-event supply snapshot. Open Inventory for full audit and adjustments." : "Real-time inventory levels across regional staging areas."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: "all", label: "All Items", color: phaseConfig.primaryColor },
                { key: "high", label: "High Supply", color: "#2E7D32" },
                { key: "low", label: "Low/Critical Stock", color: "#ba1a1a" },
              ] as const).map(({ key, label, color }) => (
                <button key={key} onClick={() => setChecklistFilter(key)} className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${checklistFilter === key ? "text-white shadow-md scale-105" : "bg-[#f4f4ef] dark:bg-[#1a1c19] text-[#444743] hover:bg-[#dadad5]/50"}`} style={checklistFilter === key ? { background: color ?? phaseConfig.primaryColor } : {}}>
                  {label}
                </button>
              ))}
              <div className="h-6 w-[1px] bg-[#dadad5] mx-2 hidden xl:block" />
              <button onClick={() => router.push("/site-manager/inventory")} className="text-white px-6 py-2 rounded-full font-bold text-xs shadow-lg hover:scale-105 transition-all disabled:opacity-50" style={{ background: phaseConfig.primaryColor }}>
                {phase === "after" ? "Open Inventory Tab" : "Update Site Inventory"}
              </button>
            </div>
          </div>

          {inventoryData.length === 0 ? (
            <div className="py-16 text-center text-[#707a6c] bg-[#f4f4ef]/30 dark:bg-[#1a1c19]/30 rounded-3xl border border-dashed border-[#dadad5] dark:border-[#3b3b3b]">
              <span className="material-symbols-outlined text-4xl mb-2 text-[#707a6c]/60">inventory_2</span>
              <p className="font-bold text-sm">No items found matching the selected filter</p>
              <p className="text-xs text-[#707a6c] mt-1">Try switching to another filter or check in new supplies.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
              {inventoryData.map((item) => (
                <div key={`inventory-card-${item.name}`} className="p-5 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] group hover:scale-[1.02] transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md" style={{ background: getInventoryCardColors(item.tone).iconBg }}>{item.name[0]}</div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded ${getInventoryCardColors(item.tone).badgeClass}`}>{item.status}</span>
                  </div>
                  <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                  <p className="text-xs text-[#444743] dark:text-[#a0a39f] mb-4">{item.detail}</p>
                  <div className="w-full h-1.5 bg-[#dadad5] dark:bg-[#3b3b3b] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: item.percent, background: getInventoryCardColors(item.tone).bar }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      {/* Alerts Modal */}
      {isAlertsModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#fcfdf6] dark:bg-[#1a1c19] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-[#dadad5] dark:border-[#3b3b3b] animate-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-[#dadad5]/50 dark:border-[#3b3b3b]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#1a1c19] dark:text-white">High Alerts</h3>
                  <p className="text-xs font-bold text-[#707a6c] uppercase tracking-widest mt-1">Active Site Incidents</p>
                </div>
              </div>
              <button onClick={() => setIsAlertsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-[#444743] dark:text-[#c4c7c0]">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#f4f4ef] dark:bg-[#232622]">
              <div className="space-y-4">
                {incidentReports
                  .filter((r) => r.severity?.toLowerCase().includes("high") || r.severity?.toLowerCase().includes("critical"))
                  .map((alert) => (
                    <div key={alert.id} className="bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-orange-200 dark:border-orange-900/30 shadow-sm relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-red-500"></div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            {alert.severity}
                          </span>
                          <h4 className="font-black text-[#1a1c19] dark:text-white text-base">{alert.title}</h4>
                        </div>
                        <span className="text-xs font-bold text-[#707a6c] whitespace-nowrap bg-[#f4f4ef] dark:bg-[#232622] px-2 py-1 rounded-lg">
                          {new Date(alert.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-[#444743] dark:text-[#c4c7c0] mb-4 leading-relaxed">{alert.content || "No detailed description provided."}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-[#dadad5]/50 dark:border-[#3b3b3b]/50">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#707a6c]">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span>{alert.location || "Unknown Location"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#707a6c]">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          <span>{alert.reportedBy?.split("@")[0] || "System"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                {incidentReports.filter((r) => r.severity?.toLowerCase().includes("high") || r.severity?.toLowerCase().includes("critical")).length === 0 && (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-4xl text-[#707a6c] mb-3 opacity-50">check_circle</span>
                    <p className="text-sm font-bold text-[#707a6c]">No high or critical alerts active right now.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return renderDashboardLayout();
}
