"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SiteManagerProfilePage from "./SiteManagerProfilePage";
import { clearSession, hasRole, loadSession } from "../../lib/session";
import {
  getDashboard,
  getCapacity,
  getDisasterEvents,
  getIncidentReports,
  getInventory,
  getRecentCheckIns,
  getSiteManagerCitizens,
  SiteManagerCitizenRecord,
} from "../../lib/api";
import {
  AppRole,
  AuthSession,
  CapacityCenter,
  CheckInRecord,
  DashboardOverview,
  DisasterEvent,
  IncidentReport,
  InventoryItem,
} from "../../lib/types";
import type {
  AuditEntry,
  PhaseConfig,
  RecoveryPlanCard,
} from "./utils/siteManagerUtils";
import {
  clampProgress,
  progressStatus,
  formatTimestamp,
  getInventoryTone,
} from "./utils/siteManagerUtils";
import DashboardTab from "./tabs/DashboardTab";
import InventoryTab from "./tabs/InventoryTab";
import SiteMapTab from "./tabs/SiteMapTab";
import CitizensTab from "./tabs/CitizensTab";
import MovementTab from "./tabs/MovementTab";
import ActivityLogModal from "./modals/ActivityLogModal";

interface SiteManagerDashboardProps {
  phase: "before" | "during" | "after";
}

const getPhaseConfig = (phase: "before" | "during" | "after"): PhaseConfig => {
  return ({
    before: {
      label: "Pre-Disaster Readiness",
      mainTitle: "Pre-Disaster Readiness Center",
      mainDesc: "Active inventory staging, shelter preparation, and volunteer coordination.",
      statusLabel: "Pre-Disaster Phase",
      siteLocationLabel: "Staging & Preparedness Hub",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1B5E20",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Readiness Score",
      checklistTitle: "Emergency Readiness Protocol",
      checklistDesc: "Verify shelter, inventory, and volunteer readiness before a disaster.",
    },
    during: {
      label: "Active Disaster Response",
      mainTitle: "Active Disaster Response Operations",
      mainDesc: "Real-time evacuee tracking, incident management, and supply distribution.",
      statusLabel: "Active Disaster Response",
      siteLocationLabel: "Evacuation Command Post",
      accent: "#FFB300",
      primaryColor: "#FFB300",
      primaryContainer: "#FFA000",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Active High Alerts",
      checklistTitle: "Citizen Check-In/Out Station",
      checklistDesc: "Rapid intake and departure verification point for displaced citizens.",
    },
    after: {
      label: "Post-Disaster Recovery",
      mainTitle: "Post-Disaster Recovery Operations",
      mainDesc: "Recovery operations with check-out progress and replenishment tracking.",
      statusLabel: "Post-Disaster Recovery",
      siteLocationLabel: "Recovery Coordination Desk",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1b5e20",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Recovery Progress",
      checklistTitle: "Post-Disaster Recovery Reports",
      checklistDesc: "Submit verified shelter, damage, and recovery records based on synced disaster data.",
    },
  } as Record<"before" | "during" | "after", PhaseConfig>)[phase];
};

const SiteManagerDashboard: React.FC<SiteManagerDashboardProps> = ({ phase }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [activeTab, setActiveTab] = useState<"Dashboard" | "Inventory" | "SiteMap" | "Citizens" | "Movement">("Dashboard");
  const pathname = usePathname();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [capacityCenters, setCapacityCenters] = useState<CapacityCenter[]>([]);
  const [disasterEvents, setDisasterEvents] = useState<DisasterEvent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [citizenRegistry, setCitizenRegistry] = useState<SiteManagerCitizenRecord[]>([]);
  const [citizenRegistryLoading, setCitizenRegistryLoading] = useState(false);
  const [citizenRegistryError, setCitizenRegistryError] = useState<string | null>(null);
  const [citizenSearchQuery, setCitizenSearchQuery] = useState("");

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab")?.toLowerCase();
    const isPhasePage = /\/site-manager\/(before|during|after)calamity$/.test(pathname);

    if ((pathname === "/site-manager" || pathname === "/site-manager/" || isPhasePage) && tabParam === "citizens") {
      setActiveTab("Citizens");
    } else if ((pathname === "/site-manager" || pathname === "/site-manager/" || isPhasePage) && tabParam === "movement") {
      setActiveTab("Movement");
    } else if (pathname === "/site-manager" || pathname === "/site-manager/" || isPhasePage) {
      setActiveTab("Dashboard");
    } else if (pathname.startsWith("/site-manager/inventory")) {
      setActiveTab("Inventory");
    } else if (pathname.startsWith("/site-manager/sitemap")) {
      setActiveTab("SiteMap");
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const stored = loadSession();
    if (!hasRole(stored, AppRole.LINE_MANAGER)) {
      router.replace("/login");
      return;
    }

    if (stored?.user.accountStatus === "pending") {
      router.replace("/login");
      return;
    }

    setSession(stored);

    async function hydrate() {
      if (!stored?.accessToken) {
        return;
      }

      setLoadingData(true);
      setLoadError(null);

      const dashboardPromise = getDashboard("site-manager", stored.accessToken)
        .then(setOverview)
        .catch(() => setOverview(null));

      const inventoryPromise = getInventory("site-manager", stored.accessToken)
        .then(setInventoryItems)
        .catch(() => setInventoryItems([]));

      const checkInPromise = getRecentCheckIns(stored.accessToken, 8)
        .then(setCheckIns)
        .catch(() => setCheckIns([]));

      const incidentPromise = getIncidentReports(stored.accessToken)
        .then(setIncidentReports)
        .catch(() => setIncidentReports([]));

      const capacityPromise = getCapacity(stored.accessToken)
        .then(setCapacityCenters)
        .catch(() => setCapacityCenters([]));

      const disastersPromise = getDisasterEvents("site-manager", stored.accessToken)
        .then(async (payload) => {
          let eventList: DisasterEvent[] = [];
          if (Array.isArray(payload)) {
            eventList = payload;
          } else if (payload && Array.isArray((payload as { disasterEvents?: DisasterEvent[] }).disasterEvents)) {
            eventList = (payload as { disasterEvents: DisasterEvent[] }).disasterEvents;
          }
          setDisasterEvents(eventList);
        })
        .catch(() => setDisasterEvents([]));

      const citizensPromise = getSiteManagerCitizens(stored.accessToken)
        .then(setCitizenRegistry)
        .catch(() => setCitizenRegistry([]));

      await Promise.allSettled([
        dashboardPromise,
        inventoryPromise,
        checkInPromise,
        incidentPromise,
        capacityPromise,
        disastersPromise,
        citizensPromise,
      ]);

      setLoadingData(false);
    }

    void hydrate();
  }, [router]);

  useEffect(() => {
    async function hydrateCitizens() {
      if (!session?.accessToken || activeTab !== "Citizens") {
        return;
      }

      setCitizenRegistryLoading(true);
      setCitizenRegistryError(null);
      try {
        const records = await getSiteManagerCitizens(session.accessToken, citizenSearchQuery);
        setCitizenRegistry(records);
      } catch (error) {
        setCitizenRegistryError(error instanceof Error ? error.message : "Failed to load citizens");
      } finally {
        setCitizenRegistryLoading(false);
      }
    }

    void hydrateCitizens();
  }, [activeTab, citizenSearchQuery, session?.accessToken]);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  const phaseConfig = getPhaseConfig(phase);

  const totalCapacity = overview?.capacity.totalCapacity ?? capacityCenters.reduce((sum, center) => sum + center.capacity, 0);
  const totalOccupancy = overview?.capacity.totalOccupancy ?? capacityCenters.reduce((sum, center) => sum + center.currentOccupancy, 0);

  const shelterCloseoutProgress = totalCapacity > 0
    ? clampProgress(((totalCapacity - totalOccupancy) / totalCapacity) * 100)
    : 0;
  const resolvedIncidents = incidentReports.filter((report) => !["pending", "open", "new"].includes(report.status.toLowerCase())).length;
  const incidentResolutionProgress = incidentReports.length > 0
    ? clampProgress((resolvedIncidents / incidentReports.length) * 100)
    : 0;
  const inventoryReadyItems = inventoryItems.filter((item) => getInventoryTone(item.status) !== "error").length;
  const inventoryReconciliationProgress = inventoryItems.length > 0
    ? clampProgress((inventoryReadyItems / inventoryItems.length) * 100)
    : 0;
  const archivedDisasterEvents = disasterEvents.filter((event) => event.status.toLowerCase() !== "active" || Boolean(event.dateEnded));
  const documentationProgress = disasterEvents.length > 0
    ? clampProgress((archivedDisasterEvents.length / disasterEvents.length) * 100)
    : 0;

  const recoveryPlans: RecoveryPlanCard[] = [
    {
      id: "recovery-shelter-closeout",
      name: "Shelter Decongestion & Resettlement Handover",
      progress: shelterCloseoutProgress,
      lead: "Shelter Operations",
      status: progressStatus(shelterCloseoutProgress),
    },
    {
      id: "recovery-incident-validation",
      name: "Incident Validation & Damage Resolution",
      progress: incidentResolutionProgress,
      lead: "Incident Desk",
      status: progressStatus(incidentResolutionProgress),
    },
    {
      id: "recovery-inventory-closeout",
      name: "Inventory Reconciliation & Aid Closeout",
      progress: inventoryReconciliationProgress,
      lead: "Logistics Unit",
      status: progressStatus(inventoryReconciliationProgress),
    },
    {
      id: "recovery-documentation",
      name: "Disaster Documentation & Archive Readiness",
      progress: documentationProgress,
      lead: "Admin Coordination",
      status: progressStatus(documentationProgress),
    },
  ];

  const allAuditEntries: AuditEntry[] = (() => {
    const incidentEntries: AuditEntry[] = incidentReports
      .map((report) => ({
        id: `incident-${report.id}`,
        title: report.title || "Incident Report",
        timestamp: formatTimestamp(report.createdAt),
        source: "Incident Report",
        status: report.status || "logged",
        note:
          report.content?.trim() ||
          `${report.severity || "Unspecified severity"} at ${report.location || "Unknown location"}`,
        sortAt: new Date(report.createdAt).getTime() || 0,
      }))
      .filter((entry) => entry.sortAt > 0);

    const checkInEntries: AuditEntry[] = checkIns
      .map((entry) => {
        const eventStatus = (entry.status || "").toLowerCase();
        const isBeforeOrDuring = phase === "before" || phase === "during";
        const isAfter = phase === "after";

        if (isBeforeOrDuring && eventStatus === "checked-out") {
          return null;
        }
        if (isAfter && eventStatus !== "checked-out") {
          return null;
        }

        return {
          id: `checkin-${entry.id}`,
          title: entry.fullName || `${entry.firstName || ""} ${entry.lastName || ""}`.trim() || entry.evacueeNumber,
          timestamp: formatTimestamp(entry.checkInTime),
          source: eventStatus === "checked-out" ? "Check-out" : "Check-in",
          status: entry.status || "logged",
          note: `${entry.zone || "Unknown zone"} • ${entry.location || "Unknown location"}`,
          sortAt: new Date(entry.checkInTime ?? "").getTime() || 0,
        };
      })
      .filter((entry): entry is AuditEntry => Boolean(entry && entry.sortAt > 0));

    const disasterEntries: AuditEntry[] = disasterEvents
      .map((event) => {
        const eventAt = event.dateEnded || event.dateStarted;
        return {
          id: `disaster-${event.id}`,
          title: event.name,
          timestamp: formatTimestamp(eventAt),
          source: "Disaster Event",
          status: event.status,
          note: `${event.type} • ${event.severityLevel} • ${event.province}`,
          sortAt: new Date(eventAt).getTime() || 0,
        };
      })
      .filter((entry) => entry.sortAt > 0);

    return [...incidentEntries, ...checkInEntries, ...disasterEntries]
      .sort((left, right) => right.sortAt - left.sortAt)
      .slice(0, 50);
  })();

  const readinessScore = overview
    ? Math.min(
        100,
        Math.round(
          ((overview.capacity.totalCapacity - overview.capacity.totalOccupancy) /
            Math.max(1, overview.capacity.totalCapacity)) *
            100,
        ),
      )
    : null;
  const recoveryProgress = overview
    ? Math.min(
        100,
        Math.round(
          (overview.checkIns.totalCheckedOut / Math.max(1, overview.checkIns.total)) * 100,
        ),
      )
    : null;

  let heroMetricValue = "N/A";
  if (phase === "before") {
    heroMetricValue = readinessScore != null ? `${readinessScore}%` : "N/A";
  } else if (phase === "during") {
    heroMetricValue = overview?.incidentReports.highSeverityReports != null ? String(overview.incidentReports.highSeverityReports) : "N/A";
  } else {
    heroMetricValue = recoveryProgress != null ? `${recoveryProgress}%` : "N/A";
  }

  const heroMetricBreakdown =
    phase === "before"
      ? [
          {
            label: "Capacity Ratio",
            value: `${Math.max(0, (overview?.capacity.totalCapacity ?? 0) - (overview?.capacity.totalOccupancy ?? 0)).toLocaleString()} / ${(overview?.capacity.totalCapacity ?? 0).toLocaleString()}`,
          },
          {
            label: "Available Capacity",
            value: `${Math.max(0, (overview?.capacity.totalCapacity ?? 0) - (overview?.capacity.totalOccupancy ?? 0)).toLocaleString()} slots`,
          },
          {
            label: "Total Capacity",
            value: `${(overview?.capacity.totalCapacity ?? 0).toLocaleString()} slots`,
          },
        ]
      : phase === "during"
        ? [{ label: "Total Incident Reports", value: `${overview?.incidentReports.totalReports ?? 0}` }]
        : [
            { label: "Checked-Out", value: `${overview?.checkIns.totalCheckedOut ?? 0}` },
            { label: "Total Check-ins", value: `${overview?.checkIns.total ?? 0}` },
          ];

  const avatarInitials = (() => {
    if (!session?.user) {
      return "SM";
    }

    const firstInitial = session.user.firstName?.trim()?.[0]?.toUpperCase();
    const lastInitial = session.user.lastName?.trim()?.[0]?.toUpperCase();

    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    }

    const nameParts = session.user.name?.trim()?.split(/\s+/)?.filter(Boolean) ?? [];
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }

    return (firstInitial ?? nameParts[0]?.[0] ?? "S").toUpperCase();
  })();

  const displayName = session?.user.name?.trim() || "Site Manager";
  const nextPhase = {
    before: "during",
    during: "after",
    after: "before",
  }[phase];
  const activeAlerts = overview?.incidentReports.highSeverityReports;

  return (
    <div className="bg-[#fafaf5] dark:bg-[#1a1c19] text-[#1a1c19] dark:text-[#e2e3dd] min-h-screen font-['Public_Sans']">
      <header className="fixed top-6 right-6 left-6 md:left-[280px] z-[40] flex justify-between items-center px-8 py-3 bg-white/70 dark:bg-[#1a1c19]/70 backdrop-blur-2xl border border-white/20 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] animate-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-6">
          <Link href="/site-manager/beforecalamity" className="font-black text-xs tracking-[0.2em] hover:opacity-80 transition-opacity" style={{ color: phaseConfig.primaryColor }}>
            DAMAYAN
          </Link>
          <div className="h-4 w-[1px] bg-[#dadad5] dark:bg-[#3b3b3b]"></div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#707a6c]">
            <span>Portal</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-[#1a1c19] dark:text-white">{activeTab}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsActivityModalOpen(true)}
            className="flex items-center gap-1.5 px-4 h-10 rounded-full border border-[#dadad5] dark:border-[#3b3b3b] hover:bg-[#eeeeea] dark:hover:bg-[#232622] transition-colors text-xs font-black uppercase tracking-wider text-[#1a1c19] dark:text-[#e2e3dd]"
          >
            <span className="material-symbols-outlined text-sm" style={{ color: phaseConfig.primaryColor }}>analytics</span>
            Live Activity
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 flex items-center justify-center font-black text-white bg-gradient-to-br"
              style={{ borderColor: phaseConfig.primaryColor, backgroundImage: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
            >
              <span className="text-sm">{avatarInitials}</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-4 w-64 bg-white dark:bg-[#232622] rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] shadow-2xl py-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="px-8 pb-4 border-b border-[#dadad5]/50 dark:border-[#3b3b3b]/50">
                  <p className="text-lg font-black text-[#1a1c19] dark:text-[#e2e3dd]">{displayName}</p>
                  <p className="text-[10px] font-bold text-[#707a6c] dark:text-[#c4c7c0] uppercase tracking-[0.2em] mt-1">{session?.user.role.replace("_", " ") ?? "Site Manager"}</p>
                </div>

                <div className="p-3 space-y-1">
                  <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#FFF8E1] dark:bg-[#FFB300]/20">
                      <span className="material-symbols-outlined text-2xl text-[#FFB300]">
                        {isDarkMode ? "light_mode" : "dark_mode"}
                      </span>
                    </div>
                    <span className="text-base font-black text-[#1a1c19] dark:text-[#e2e3dd]">
                      {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setShowProfile(true);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#E8F5E9] dark:bg-[#2E7D32]/20">
                      <span className="material-symbols-outlined text-2xl text-[#2E7D32]">person</span>
                    </div>
                    <span className="text-base font-black text-[#1a1c19] dark:text-[#e2e3dd]">View Profile</span>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-[#dadad5]/50 dark:border-[#3b3b3b]/50 px-3">
                  <button
                    onClick={() => {
                      clearSession();
                      router.replace("/login");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] bg-[#FFEBEE] dark:bg-red-500/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-red-600">logout</span>
                    </div>
                    <span className="text-base font-black text-red-600">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-0 h-full w-64 bg-[#fafaf5] dark:bg-[#1a1c19] border-r border-[#dadad5] dark:border-[#3b3b3b] z-[30] hidden md:flex flex-col py-8 px-6">
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <div
              className="h-12 w-12"
              style={{
                backgroundColor: phaseConfig.primaryColor,
                WebkitMaskImage: "url('/damayan_logo.svg')",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                WebkitMaskSize: "contain",
                maskImage: "url('/damayan_logo.svg')",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                maskSize: "contain",
              }}
            />
            <p className="font-black text-2xl tracking-tight uppercase text-[#1a1c19] dark:text-[#e2e3dd]">DAMAYAN</p>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b]">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#707a6c]">{phaseConfig.label}</p>
          </div>
        </div>

        <nav className="space-y-2 flex-grow">
          {[
            { id: "Dashboard", label: "Dashboard", icon: "space_dashboard", path: `/site-manager/${phase}calamity` },
            { id: "Inventory", label: "Inventory", icon: "inventory", path: `/site-manager/inventory?phase=${phase}` },
            { id: "SiteMap", label: "Interactive Site Map", icon: "travel_explore", path: `/site-manager/sitemap?phase=${phase}` },
            { id: "Citizens", label: "Citizen Check-In/Out", icon: "qr_code_scanner", path: `/site-manager/${phase}calamity?tab=citizens` },
            { id: "Movement", label: "Citizen Tracker", icon: "timeline", path: `/site-manager/${phase}calamity?tab=movement` },
          ].map((item) => {
            const isActive = activeTab === item.id && !showProfile;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group relative overflow-hidden ${
                  isActive
                    ? "text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] scale-[1.02]"
                    : "text-[#1a1c19] dark:text-[#e2e3dd] hover:bg-[#f4f4ef] dark:hover:bg-white/5"
                }`}
                style={isActive ? { background: phaseConfig.primaryColor } : {}}
              >
                <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? "text-white" : ""}`}>
                  {item.icon}
                </span>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? "text-white" : ""}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute right-0 top-0 h-full w-1.5 bg-white/30 rounded-l-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-4">
          {phase !== "before" && (
            <Link
              href={`/site-manager/${phase === "after" ? "during" : "before"}calamity`}
              className="w-full group relative overflow-hidden rounded-3xl p-px transition-all hover:scale-[1.02] active:scale-95 shadow-sm block"
            >
              <div className="relative flex items-center justify-center gap-3 px-6 py-4 rounded-[1.4rem] transition-colors border border-[#dadad5] dark:border-[#3b3b3b] bg-white dark:bg-[#232622] hover:bg-[#f4f4ef] dark:hover:bg-white/5">
                <span className="material-symbols-outlined text-[#707a6c] transition-transform group-hover:-translate-x-1 text-xl" aria-hidden="true">arrow_back</span>
                <span className="text-[#707a6c] text-[10px] font-black uppercase tracking-[0.2em]">Back: {phase === "after" ? "During" : "Before"}</span>
              </div>
            </Link>
          )}

          {phase !== "after" && (
            <Link
              href={`/site-manager/${nextPhase}calamity`}
              className="w-full group relative overflow-hidden rounded-3xl p-px transition-all hover:scale-[1.02] active:scale-95 shadow-xl block"
            >
              <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: phaseConfig.primaryColor }}></div>
              <div className="relative flex items-center justify-center gap-3 px-6 py-5 rounded-[1.4rem] transition-colors" style={{ background: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}>
                <span className="material-symbols-outlined text-white animate-pulse text-xl">arrow_forward</span>
                <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Next: {nextPhase}</span>
              </div>
            </Link>
          )}
        </div>
      </aside>

      <main className="md:ml-64 pt-28 px-6 pb-24 max-w-7xl mx-auto">
        {showProfile ? (
          <SiteManagerProfilePage
            onBack={() => setShowProfile(false)}
            primaryColor={phaseConfig.primaryColor}
            session={session}
            onSessionUpdated={setSession}
          />
        ) : (
          <>
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex-grow">
                <span className="bg-[#dadad5] dark:bg-[#3b3b3b] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center w-fit mb-3">
                  <span className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ background: phaseConfig.primaryColor }}></span>
                  {phaseConfig.statusLabel}
                </span>
                <h2 className="text-4xl font-black tracking-tight mb-2">
                  {activeTab === "Dashboard" && phaseConfig.mainTitle}
                  {activeTab === "Inventory" && "Logistics & Inventory"}
                  {activeTab === "SiteMap" && "Regional Site Map"}
                  {activeTab === "Citizens" && "Citizen Check-In/Out & Registry"}
                  {activeTab === "Movement" && "Citizen Tracker"}
                </h2>
                <div className="text-[#444743] dark:text-[#c4c7c0] max-w-lg flex flex-col gap-2">
                  <p>
                    {activeTab === "Dashboard" && `${displayName}: ${phaseConfig.mainDesc}`}
                    {activeTab === "Inventory" && "Manage incoming and outgoing relief assets."}
                    {activeTab === "SiteMap" && "Live monitoring of active shelters and supply routes."}
                    {activeTab === "Citizens" && "Use QR/manual verification to record citizen arrivals and departures, then review the current registry."}
                    {activeTab === "Movement" && "Track citizen arrivals, departures, and movement history with searchable records."}
                  </p>
                  {activeTab === "Dashboard" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#5f6b5e] dark:text-[#a0a39f] bg-[#f4f4ef] dark:bg-[#1a1c19] w-fit px-3 py-1.5 rounded-lg border border-[#dadad5] dark:border-[#3b3b3b]">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      <span>
                        Site Post: {phaseConfig.siteLocationLabel} | Assigned Area: {session?.user?.municipality || "N/A"}, {session?.user?.barangay || "N/A"}
                      </span>
                    </div>
                  )}
                </div>
                {loadingData && <p className="text-xs text-[#707a6c] mt-2">Loading live dashboard data...</p>}
                {loadError && <p className="text-xs text-red-600 mt-2">{loadError}</p>}
              </div>
              {activeTab === "Dashboard" && (
                <div className="flex gap-4">
                  <div className="bg-white dark:bg-[#232622] p-4 rounded-2xl shadow-sm border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col min-w-[300px]">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-3xl font-black" style={{ color: phaseConfig.primaryColor }}>{heroMetricValue}</span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#444743] dark:text-[#a0a39f]">{phaseConfig.heroMetricLabel}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#dadad5]/60 dark:border-[#3b3b3b] space-y-1.5">
                      {heroMetricBreakdown.map((item) => (
                        <div key={item.label} className="flex items-start justify-between gap-3 text-[10px]">
                          <span className="font-black uppercase tracking-widest text-[#707a6c]">{item.label}</span>
                          <span className="font-bold text-right text-[#1a1c19] dark:text-[#e2e3dd]">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </header>

            {activeTab === "Dashboard" && (
              <DashboardTab
                phase={phase}
                phaseConfig={phaseConfig}
                session={session}
                overview={overview}
                inventoryItems={inventoryItems}
                checkIns={checkIns}
                incidentReports={incidentReports}
                capacityCenters={capacityCenters}
                disasterEvents={disasterEvents}
                loadingData={loadingData}
                loadError={loadError}
                displayName={displayName}
                activeAlerts={activeAlerts}
                recoveryPlans={recoveryPlans}
                onIncidentReportsRefreshed={setIncidentReports}
                onInventoryRefreshed={setInventoryItems}
                onOpenActivityModal={() => setIsActivityModalOpen(true)}
              />
            )}

            {activeTab === "Inventory" && (
              <InventoryTab
                phase={phase}
                phaseConfig={phaseConfig}
                session={session}
                overview={overview}
                inventoryItems={inventoryItems}
                loadingData={loadingData}
                onInventoryRefreshed={setInventoryItems}
              />
            )}

            {activeTab === "SiteMap" && (
              <SiteMapTab
                phase={phase}
                phaseConfig={phaseConfig}
                session={session}
                capacityCenters={capacityCenters}
                overview={overview}
                inventoryItems={inventoryItems}
                incidentReports={incidentReports}
                loadingData={loadingData}
              />
            )}

            {activeTab === "Citizens" && (
              <CitizensTab
                phase={phase}
                phaseConfig={phaseConfig}
                session={session}
                checkIns={checkIns}
                capacityCenters={capacityCenters}
                citizenRegistry={citizenRegistry}
                citizenRegistryLoading={citizenRegistryLoading}
                citizenRegistryError={citizenRegistryError}
                citizenSearchQuery={citizenSearchQuery}
                onCitizenSearchChange={setCitizenSearchQuery}
                onCheckInsRefreshed={setCheckIns}
              />
            )}

            {activeTab === "Movement" && (
              <MovementTab
                phase={phase}
                phaseConfig={phaseConfig}
                session={session}
                checkIns={checkIns}
                onRecordsRefreshed={setCheckIns}
              />
            )}
          </>
        )}
      </main>

      {isActivityModalOpen && (
        <ActivityLogModal
          phase={phase}
          allAuditEntries={allAuditEntries}
          onClose={() => setIsActivityModalOpen(false)}
        />
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1a1c19]/95 backdrop-blur-xl border-t border-[#dadad5] dark:border-[#3b3b3b] z-[40] px-2 pb-safe">
        <div className="flex">
          {[
            { id: "Dashboard", icon: "grid_view", label: "Home", path: `/site-manager/${phase}calamity` },
            { id: "Inventory", icon: "inventory_2", label: "Inventory", path: `/site-manager/inventory?phase=${phase}` },
            { id: "SiteMap", icon: "map", label: "Site Map", path: `/site-manager/sitemap?phase=${phase}` },
            { id: "Citizens", icon: "badge", label: "Check In/Out", path: `/site-manager/${phase}calamity?tab=citizens` },
            { id: "Movement", icon: "list_alt", label: "Tracker", path: `/site-manager/${phase}calamity?tab=movement` },
          ].map((item) => {
            const isActive = activeTab === item.id && !showProfile;
            return (
              <Link
                key={item.id}
                href={item.path}
                className="flex-1 flex flex-col items-center py-3 gap-1 transition-all"
              >
                <span
                  className="material-symbols-outlined text-xl transition-all"
                  style={{ color: isActive ? phaseConfig.primaryColor : "#707a6c" }}
                >
                  {item.icon}
                </span>
                <span
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: isActive ? phaseConfig.primaryColor : "#707a6c" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default SiteManagerDashboard;
