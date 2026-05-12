"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SiteManagerProfilePage from "./SiteManagerProfilePage";
import { clearSession, hasRole, loadSession } from "../../lib/session";
import {
  getDashboard,
  getCapacity,
  getIncidentReports,
  getInventory,
  getRecentCheckIns,
} from "../../lib/api";
import { AppRole, AuthSession, CapacityCenter, CheckInRecord, DashboardOverview, IncidentReport, InventoryItem } from "../../lib/types";

interface SiteManagerDashboardProps {
  phase: "before" | "during" | "after";
}

function getInventoryTone(status: string): "secure" | "warning" | "error" {
  const normalized = status.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("depleted")) {
    return "error";
  }
  if (normalized.includes("low") || normalized.includes("transit") || normalized.includes("scheduled")) {
    return "warning";
  }
  return "secure";
}

function formatRelativeTime(iso?: string): string {
  if (!iso) {
    return "Recent";
  }
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) {
    return "Recent";
  }
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SiteManagerDashboard: React.FC<SiteManagerDashboardProps> = ({ phase }) => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [checkInMode, setCheckInMode] = useState<"scan" | "manual">("scan");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Inventory" | "SiteMap">("Dashboard");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [capacityCenters, setCapacityCenters] = useState<CapacityCenter[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/site-manager" || pathname === "/site-manager/") {
      setActiveTab("Dashboard");
    } else if (pathname.startsWith("/site-manager/inventory")) {
      setActiveTab("Inventory");
    } else if (pathname.startsWith("/site-manager/sitemap")) {
      setActiveTab("SiteMap");
    }
  }, [pathname]);


  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const stored = loadSession();
    if (!hasRole(stored, AppRole.LINE_MANAGER)) {
      router.replace("/site-manager/login");
      return;
    }

    setSession(stored);

    async function hydrate() {
      if (!stored?.accessToken) {
        return;
      }

      setLoadingData(true);
      setLoadError(null);

      const [dashboardResult, inventoryResult, checkInResult, incidentResult, capacityResult] =
        await Promise.allSettled([
          getDashboard("site-manager", stored.accessToken),
          getInventory("site-manager", stored.accessToken),
          getRecentCheckIns(stored.accessToken, 8),
          getIncidentReports(stored.accessToken),
          getCapacity(stored.accessToken),
        ]);

      if (dashboardResult.status === "fulfilled") {
        setOverview(dashboardResult.value);
      }
      if (inventoryResult.status === "fulfilled") {
        setInventoryItems(inventoryResult.value);
      }
      if (checkInResult.status === "fulfilled") {
        setCheckIns(checkInResult.value);
      }
      if (incidentResult.status === "fulfilled") {
        setIncidentReports(incidentResult.value);
      }
      if (capacityResult.status === "fulfilled") {
        setCapacityCenters(capacityResult.value);
      }

      const allRejected = [dashboardResult, inventoryResult, checkInResult, incidentResult].every(
        (result) => result.status === "rejected",
      );
      if (allRejected) {
        setLoadError("Unable to load site manager dashboard data.");
      }

      setLoadingData(false);
    }

    hydrate();
  }, [router]);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const phaseConfig = {
    before: {
      label: "Pre-Disaster Phase",
      subLabel: "Readiness & Mitigation",
      mainTitle: "Regional Preparedness Dashboard",
      mainDesc: "Live readiness metrics for your assigned site cluster and logistics network.",
      statusLabel: "Active Preparedness Mode",
      accent: "#81C784",
      primaryColor: "#81C784",
      primaryContainer: "#66bb6a",
      heroMetricLabel: "Readiness Score",
      checklistTitle: "Before Calamity Checklist",
      checklistDesc: "Core readiness actions aligned to your swimlane before the response phase begins.",
    },
    during: {
      label: "Active Disaster Phase",
      subLabel: "Emergency Response",
      mainTitle: "Live Status Map & Command",
      mainDesc: "Operational command view with live incident and shelter response indicators.",
      statusLabel: "Active Response Mode",
      accent: "#FFB300",
      primaryColor: "#FFB300",
      primaryContainer: "#ffa000",
      heroMetricLabel: "High Alerts",
      checklistTitle: "Emergency Operational Guide",
      checklistDesc: "This view follows the daily process: evacuee arrival, identity capture, and relief distribution.",
    },
    after: {
      label: "Post-Disaster Phase",
      subLabel: "Recovery & Rehabilitation",
      mainTitle: "Central Relief Hub Dashboard",
      mainDesc: "Recovery operations with check-out progress and replenishment tracking.",
      statusLabel: "Post-Disaster Recovery",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1b5e20",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Recovery Progress",
      checklistTitle: "Citizen Check-out Station",
      checklistDesc: "Active intake point for departures. Finalize aid dispensing and registry update.",
    },
  }[phase];

  const displayName = session?.user.name?.trim() || "Site Manager";
  const fallbackInventory: InventoryItem[] = [
    { id: "f1", name: "Potable Water", category: "Water", quantity: 15000, unit: "Liters", status: "available" },
    { id: "f2", name: "Medical Kits", category: "Medical", quantity: 450, unit: "Units", status: "available" },
    { id: "f3", name: "Blankets & Shelter", category: "Shelter", quantity: 800, unit: "Kits", status: "low_stock" },
    { id: "f4", name: "Dry Rations", category: "Food", quantity: 2500, unit: "Boxes", status: "available" },
  ];
  const effectiveInventory = inventoryItems.length > 0 ? inventoryItems : fallbackInventory;
  const maxQuantity = Math.max(1, ...effectiveInventory.map((item) => item.quantity));

  const inventoryData = effectiveInventory.slice(0, 4).map((item) => {
    const percent = Math.max(5, Math.min(100, Math.round((item.quantity / maxQuantity) * 100)));
    const tone = getInventoryTone(item.status);
    return {
      name: item.name,
      detail: `${item.quantity.toLocaleString()} ${item.unit}`,
      percent: `${percent}%`,
      status: tone === "error" ? "Critical" : tone === "warning" ? "Low Stock" : "Secure",
      tone,
    };
  });

  const nextPhase = {
    before: "during",
    during: "after",
    after: "before",
  }[phase];

  const inventoryTable = effectiveInventory.slice(0, 8).map((item) => {
    const stockPercent = Math.max(5, Math.min(100, Math.round((item.quantity / maxQuantity) * 100)));
    const tone = getInventoryTone(item.status);
    return {
      category: item.name,
      stock: `${stockPercent}%`,
      incoming: tone === "warning" ? `${Math.max(0, Math.round(item.quantity * 0.3)).toLocaleString()} ${item.unit}` : "--",
      eta: tone === "warning" ? "Pending" : "--",
      status: tone === "error" ? "Critical" : tone === "warning" ? "Replenish" : "Stable",
      icon: "inventory_2",
      tone,
      quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
    };
  });

  const activeAlerts = overview?.incidentReports.highSeverityReports ?? incidentReports.filter((report) => report.severity.toLowerCase().includes("high") || report.severity.toLowerCase().includes("critical")).length;
  const readinessScore = overview
    ? Math.min(
        100,
        Math.round(
          ((overview.capacity.totalCapacity - overview.capacity.totalOccupancy) /
            Math.max(1, overview.capacity.totalCapacity)) *
            100,
        ),
      )
    : 88;
  const recoveryProgress = overview
    ? Math.min(
        100,
        Math.round(
          (overview.checkIns.totalCheckedOut / Math.max(1, overview.checkIns.total)) * 100,
        ),
      )
    : 94;
  const heroMetricValue =
    phase === "before"
      ? `${readinessScore}%`
      : phase === "during"
        ? String(activeAlerts)
        : `${recoveryProgress}%`;

  const activityLogs = [
    ...checkIns.slice(0, 3).map((entry) => ({
      t: formatRelativeTime(entry.checkInTime),
      m: `${entry.fullName || `${entry.firstName} ${entry.lastName}`} at ${entry.location || "Site"}`,
    })),
    ...incidentReports.slice(0, 2).map((report) => ({
      t: formatRelativeTime(report.createdAt),
      m: `${report.title} - ${report.status}`,
    })),
  ].slice(0, 4);

  const inventoryCards = [
    {
      label: "Total Assets",
      value: overview ? overview.inventory.itemCount.toLocaleString() : effectiveInventory.length.toLocaleString(),
      trend: overview ? `${overview.inventory.totalCategories} categories` : "Live",
      color: "#2196F3",
    },
    {
      label: "Critical Lows",
      value: overview ? String(overview.inventory.lowStockItems) : String(effectiveInventory.filter((item) => getInventoryTone(item.status) !== "secure").length),
      trend: "Needs attention",
      color: "#ba1a1a",
    },
    {
      label: "In Transit",
      value: String(effectiveInventory.filter((item) => item.status.toLowerCase().includes("transit") || item.status.toLowerCase().includes("scheduled")).length),
      trend: "Inbound",
      color: "#FFB300",
    },
  ];

  const activeShelters = overview?.capacity.totalCenters ?? 14;
  const totalPopulation = overview?.capacity.totalOccupancy ?? 2842;
  const shelterMarkers = (capacityCenters.length > 0 ? capacityCenters : []).map((center, index) => ({
    ...center,
    tone: center.utilizationRate >= 90 ? "error" : center.utilizationRate >= 70 ? "warning" : "secure",
    x: 18 + ((index * 23) % 62),
    y: 18 + ((index * 17) % 62),
  }));

  return (
    <div className="bg-[#fafaf5] dark:bg-[#1a1c19] text-[#1a1c19] dark:text-[#e2e3dd] min-h-screen font-['Public_Sans']">
      {/* TopAppBar */}
      {/* Floating Top Header Pill */}
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
          <div className="hidden md:block relative">
            <input
              className="bg-[#eeeeea] dark:bg-[#232622] border-none rounded-full px-4 py-2 text-sm focus:ring-2 w-64"
              placeholder="Search logistics..."
              type="text"
            />
            <span className="material-symbols-outlined absolute right-3 top-2 text-[#444743]">search</span>
          </div>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-105" 
              style={{ borderColor: phaseConfig.primaryColor }}
            >
              <img alt="Site Manager" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5o43MJlKk8bFumbe-kD--UwuoZpPYmQe13R3y_AruXj4fEkC5rsNLjsVpCnlJch4n3eAK6DOantbCAO4H0NxLI_QM2cwka9ht_-BobRE4JMDVEZNxPkeB7ETtlrSQKx9a4ZpsTuZCM3W4kfGoLIhLnvbd5PCT9NIjS-OcjyZELEQnYcn6codRevDEiY7M8cQFuMbDgnuEqj_XeYoZuLTlONTm_G7U6hmjKX3dgBjK4En5LrN2MPLVVtDJBbUIusSkbWnK6V5duC-W" />
            </button>
            
            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-4 w-64 bg-white/95 dark:bg-[#232622]/95 backdrop-blur-xl rounded-[2.5rem] border border-[#dadad5] dark:border-[#3b3b3b] shadow-2xl py-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="px-8 pb-4 border-b border-[#dadad5]/50 dark:border-[#3b3b3b]/50">
                  <p className="text-lg font-black text-[#1a1c19] dark:text-[#e2e3dd]">{displayName}</p>
                  <p className="text-[10px] font-bold text-[#707a6c] dark:text-[#c4c7c0] uppercase tracking-[0.2em] mt-1">{session?.user.role.replace("_", " ") ?? "Site Manager"}</p>
                </div>
                
                <div className="p-3 space-y-1">
                  <button 
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#E3F2FD] dark:bg-[#2196F3]/20">
                      <span className="material-symbols-outlined text-2xl text-[#2196F3]">
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
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      // In a real app, this would navigate to edit profile
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#FFF8E1] dark:bg-[#FFB300]/20">
                      <span className="material-symbols-outlined text-2xl text-[#FFB300]">edit</span>
                    </div>
                    <span className="text-base font-black text-[#1a1c19] dark:text-[#e2e3dd]">Edit Profile</span>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-[#dadad5]/50 dark:border-[#3b3b3b]/50 px-3">
                  <button
                    onClick={() => {
                      clearSession();
                      router.replace("/site-manager/login");
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

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#fafaf5] dark:bg-[#1a1c19] border-r border-[#dadad5] dark:border-[#3b3b3b] z-[30] hidden md:flex flex-col py-8 px-6">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-6 rounded-full" style={{ background: phaseConfig.primaryColor }}></div>
             <p className="font-black text-2xl tracking-tight">Damayan</p>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b]">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#707a6c]">{phaseConfig.label}</p>
          </div>
        </div>

        <nav className="space-y-2 flex-grow">
          {[
            { id: 'Dashboard', label: 'Dashboard', icon: 'grid_view', path: '/site-manager' },
            { id: 'Inventory', label: 'Inventory', icon: 'inventory_2', path: '/site-manager/inventory' },
            { id: 'SiteMap', label: 'Site Map', icon: 'map', path: '/site-manager/sitemap' },
          ].map((item) => {
            const isActive = activeTab === item.id && !showProfile;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group relative overflow-hidden ${
                  isActive 
                    ? 'text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] scale-[1.02]' 
                    : 'text-[#707a6c] hover:bg-[#f4f4ef] dark:hover:bg-white/5'
                }`}
                style={isActive ? { background: phaseConfig.primaryColor } : {}}
              >
                <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white' : ''}`}>
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
          <Link 
            href={`/site-manager/${nextPhase}calamity`}
            className="w-full group relative overflow-hidden rounded-3xl p-px transition-all hover:scale-[1.02] active:scale-95 shadow-xl block"
          >
            <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: phaseConfig.primaryColor }}></div>
            <div 
              className="relative flex items-center justify-center gap-3 px-6 py-5 rounded-[1.4rem] transition-colors"
              style={{ background: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
            >
               <span className="material-symbols-outlined text-white animate-pulse text-xl">arrow_forward</span>
               <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Next: {nextPhase}</span>
            </div>
          </Link>

        </div>
      </aside>


      {/* Main Content */}
      <main className="md:ml-64 pt-28 px-6 pb-24 max-w-7xl mx-auto">
        {showProfile ? (
          <SiteManagerProfilePage 
            onBack={() => setShowProfile(false)} 
            primaryColor={phaseConfig.primaryColor} 
          />
        ) : (
          <>
            {/* Hero Section */}
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
            </h2>
            <p className="text-[#444743] dark:text-[#c4c7c0] max-w-lg">
              {activeTab === "Dashboard" && `${displayName}: ${phaseConfig.mainDesc}`}
              {activeTab === "Inventory" && "Manage incoming and outgoing relief assets."}
              {activeTab === "SiteMap" && "Live monitoring of active shelters and supply routes."}
            </p>
            {loadingData && <p className="text-xs text-[#707a6c] mt-2">Loading live dashboard data...</p>}
            {loadError && <p className="text-xs text-red-600 mt-2">{loadError}</p>}
          </div>
          {activeTab === "Dashboard" && (
            <div className="flex gap-4">
              <div className="bg-white dark:bg-[#232622] p-4 rounded-2xl shadow-sm border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col items-center min-w-[120px]">
                <span className="text-3xl font-black" style={{ color: phaseConfig.primaryColor }}>{heroMetricValue}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#444743] dark:text-[#a0a39f]">{phaseConfig.heroMetricLabel}</span>
              </div>
            </div>
          )}
        </header>

        {activeTab === "Dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Main Action Card */}
          <section className="md:col-span-8 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
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

            {/* Checklist / Scanner Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-10 rounded-2xl border-b-4 flex flex-col items-center text-center transition-all hover:shadow-md" style={{ borderColor: phaseConfig.primaryColor }}>
                <span className="material-symbols-outlined text-5xl mb-4" style={{ color: phaseConfig.primaryColor }}>
                  {phase === 'before' ? 'checklist' : phase === 'during' ? 'qr_code_scanner' : 'how_to_reg'}
                </span>
                <h4 className="font-bold text-lg mb-2">
                  {phase === 'before' ? 'Readiness Check' : phase === 'during' ? 'Identity Verification' : 'Final Aid Dispensing'}
                </h4>
                <p className="text-sm text-[#444743] mb-6">
                  {phase === 'before' ? 'Verify all staging protocols and personnel presence.' : phase === 'during' ? 'Active intake: scan QR codes for rapid shelter entry.' : 'Verify citizen relief ID for recovery kit distribution.'}
                </p>
                {phase === 'during' && (
                  <div className="w-full space-y-3 mb-4">
                    <div className="flex gap-2 bg-[#dadad5] p-1 rounded-lg">
                      <button 
                        onClick={() => setCheckInMode("scan")}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "scan" ? "bg-white shadow-sm" : "text-[#444743]"}`}
                      >Scan QR</button>
                      <button 
                        onClick={() => setCheckInMode("manual")}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "manual" ? "bg-white shadow-sm" : "text-[#444743]"}`}
                      >Manual ID</button>
                    </div>
                    
                    {checkInMode === "scan" ? (
                      <div className="h-32 bg-black rounded-xl overflow-hidden relative flex items-center justify-center animate-in fade-in zoom-in duration-300">
                         <div className="absolute inset-4 border-2 border-dashed border-white/30 rounded-lg"></div>
                         <div className="w-full h-0.5 bg-red-500 absolute top-1/2 animate-bounce"></div>
                         <span className="text-[10px] text-white/50 uppercase tracking-widest z-10 font-bold">Camera Viewfinder</span>
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-300 w-full overflow-hidden">
                        <input className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm focus:ring-2" style={{ outlineColor: phaseConfig.primaryColor } as any} placeholder="Citizen Name or ID..." type="text" />
                        <div className="grid grid-cols-2 gap-3">
                          <input className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm" placeholder="Zone" type="text" />
                          <input className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm" placeholder="Group Size" type="number" min="0" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg" style={{ background: phaseConfig.primaryColor }}>
                  {phase === 'before' ? 'Log Readiness Status' : phase === 'during' ? 'Confirm Check-in' : 'Verify & Log Aid'}
                </button>
              </div>

              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-8 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>list_alt</span>
                    Essential Tasks
                  </h4>
                  <ul className="space-y-4">
                    {[
                      { t: "Inventory Validation", s: "Ready" },
                      { t: "Comms Stabilization", s: "Active" },
                      { t: "Volunteer Briefing", s: "Complete" }
                    ].map((task, i) => (
                      <li key={i} className="flex justify-between items-center text-sm pb-2 border-b border-[#dadad5]/50">
                        <span className="font-medium">{task.t}</span>
                        <span className="bg-white/50 px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ color: phaseConfig.primaryColor }}>{task.s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[#dadad5]">
                  <p className="text-[10px] font-bold text-[#444743] uppercase tracking-widest mb-2">Protocol Note</p>
                  <p className="text-xs italic text-[#444743]">"All resource reallocations must be synced to the central hub within 5 minutes of physical movement."</p>
                </div>
              </div>
            </div>

            {/* Incident Report Section (During Phase Only) */}
            {phase === 'during' && (
              <div className="mt-8 pt-8 border-t border-[#dadad5] animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Report Site Incident</h3>
                    <p className="text-[#444743] text-sm">Log critical events or medical emergencies immediately.</p>
                  </div>
                  <span className="bg-orange-100 text-[#FFB300] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{activeAlerts} active alerts</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Incident Type</label>
                    <select className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-sm font-bold appearance-none">
                      <option>Medical Emergency</option>
                      <option>Supply Shortage</option>
                      <option>Infrastructure Damage</option>
                      <option>Security/Conflict</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Severity</label>
                    <div className="flex gap-2">
                      <button className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl text-white shadow-md transition-all active:scale-95" style={{ background: '#ba1a1a' }}>Critical</button>
                      <button className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl text-white shadow-md transition-all active:scale-95" style={{ background: '#FFB300' }}>High</button>
                      <button className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl text-white shadow-md transition-all active:scale-95" style={{ background: '#81C784' }}>Moderate</button>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Detailed Description</label>
                    <textarea className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-sm min-h-[100px]" placeholder="Describe the situation..."></textarea>
                  </div>
                </div>
                <button className="mt-4 w-full bg-[#1a1c19] text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg hover:scale-[1.01] transition-transform active:scale-95" style={{ background: '#1a1c19' }}>Submit Incident Report</button>
              </div>
            )}
          </section>

          {/* Sidebar Area */}
          <section className="md:col-span-4 space-y-6">
            <div className="bg-[#1a1c19] text-white rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>analytics</span>
                Live Activity
              </h3>
              <div className="space-y-4">
                {activityLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-1 h-10 rounded-full mt-1" style={{ background: phaseConfig.primaryColor }}></div>
                    <div>
                      <p className="text-[10px] font-bold text-[#dadad5] uppercase">{log.t}</p>
                      <p className="text-xs text-[#dadad5]/80">{log.m}</p>
                    </div>
                  </div>
                ))}
                {activityLogs.length === 0 && (
                  <p className="text-xs text-[#dadad5]/80">No recent activity logs available.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#232622] rounded-3xl p-6 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm relative overflow-hidden group min-h-[200px]">
              <div className="absolute inset-0 opacity-40 group-hover:opacity-80 transition-opacity">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpSvAOIIisjz13eQiOCstFnz3vVDhXSLsC2wkcR0gzF0aE74mgQ4wHIUPQxpjnjM9rNALymOt0yzw4BUqDzXDmvL68DiBEHgtwXcoRktsaAjW4XF8rQ9xFDqsWjQVCUV3lpc9WdLCHcs9vEn68r458YriOvYDyAOpkuQmDaQXPWqqt7wAiApmtFpPyTHIgyKDI39znTvbgGnTysMQr1Ezpxs0enh_BMJvFIA9nVdUBqndsA8qbD84JSmQa6tncbOhO9dg-xTC8Mwxc" alt="Map" />
              </div>
              <div className="relative z-10 flex flex-col justify-end h-full">
                <div className="bg-white/90 p-4 rounded-2xl shadow-lg">
                  <h4 className="font-bold text-sm">Interactive Site Map</h4>
                  <p className="text-[10px] text-[#444743] uppercase tracking-widest">Real-time zone activity monitor</p>
                </div>
              </div>
            </div>

            {/* Closing Operations (After Phase Only) */}
            {phase === 'after' && (
              <div className="bg-[#1a1c19] text-white rounded-3xl p-6 shadow-xl animate-in fade-in duration-700">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary-fixed">
                  <span className="material-symbols-outlined">exit_to_app</span>
                  Closing Operations
                </h3>
                <p className="text-[#dadad5]/80 text-xs mb-6">Finalize day-of operations and prepare site handover documentation.</p>
                <div className="space-y-3">
                  <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">lock_clock</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Initiate Check-out</p>
                      <p className="text-[10px] text-[#dadad5]/50 uppercase tracking-widest">Site Lockdown</p>
                    </div>
                  </button>
                  <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Site Summary Report</p>
                      <p className="text-[10px] text-[#dadad5]/50 uppercase tracking-widest">Generate PDF & Sync</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Inventory Table Section (After Phase Specific) */}
          {phase === 'after' ? (
            <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Inventory Recovery & Intake</h3>
                  <p className="text-[#444743] text-sm">Managing physical relief goods arriving from regional terminals.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsReceiveModalOpen(true)}
                    className="bg-[#0d631b] text-white px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined">unarchive</span>
                    Receive Physical Goods
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f4f4ef] dark:bg-[#1a1c19] text-[#444743] text-[10px] uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Resource Category</th>
                      <th className="px-6 py-4">Stock Level</th>
                      <th className="px-6 py-4">Incoming</th>
                      <th className="px-6 py-4">ETA</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dadad5]/30">
                    {inventoryTable.map((row, i) => (
                      <tr key={i} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5 font-bold text-sm flex items-center gap-3">
                          <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>{row.icon}</span>
                          {row.category}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[#dadad5] rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: row.stock, background: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : phaseConfig.primaryColor }}></div>
                            </div>
                            <span className="text-xs font-bold" style={{ color: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : 'inherit' }}>{row.stock}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs font-medium text-[#444743]">{row.incoming}</td>
                        <td className="px-6 py-5 text-xs font-medium text-[#444743]">{row.eta}</td>
                        <td className="px-6 py-5">
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase" style={{ backgroundColor: row.tone === 'error' ? '#ffdad6' : row.tone === 'warning' ? '#fff3e0' : '#dadad5', color: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : '#444743' }}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => {
                              setSelectedItem(row);
                              setIsActionPanelOpen(true);
                            }}
                            className="material-symbols-outlined text-[#444743] hover:text-[#0d631b] p-2 hover:bg-[#f4f4ef] rounded-full transition-all active:scale-90"
                          >
                            edit_note
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-bold">Essential Supply Checklist</h3>
                <p className="text-[#444743] text-sm">Real-time inventory levels across regional staging areas.</p>
              </div>
              <button className="text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:opacity-90 transition-opacity" style={{ background: phaseConfig.primaryColor }}>
                Update Site Inventory
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {inventoryData.map((item, i) => (
                <div key={i} className="p-5 rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] group hover:scale-[1.02] transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md" style={{ background: item.tone === 'error' ? '#b91c1c' : item.tone === 'warning' ? '#d97706' : phaseConfig.primaryColor }}>
                      {item.name[0]}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${item.tone === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                  <p className="text-xs text-[#444743] mb-4">{item.detail}</p>
                  <div className="w-full h-1.5 bg-[#dadad5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: item.percent, background: item.tone === 'error' ? '#b91c1c' : phaseConfig.primaryColor }}></div>
                  </div>
                </div>
              ))}
            </div>
            </section>
          )}
        </div>
        )}

        {activeTab === "Inventory" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {inventoryCards.map((stat, i) => (
                <div key={i} className="bg-white dark:bg-[#232622] p-6 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#444743] mb-1">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h4 className="text-3xl font-black">{stat.value}</h4>
                    <span className="text-xs font-bold" style={{ color: stat.color }}>{stat.trend}</span>
                  </div>
                  <div className="w-full h-1 bg-[#f4f4ef] dark:bg-[#1a1c19] mt-4 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '70%', background: stat.color }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black">Stock Ledger</h3>
                <div className="flex gap-2">
                  <button className="bg-[#f4f4ef] dark:bg-[#1a1c19] px-4 py-2 rounded-xl text-xs font-bold border border-[#dadad5]">Export CSV</button>
                  <button className="text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg" style={{ background: phaseConfig.primaryColor }}>+ New Batch</button>
                </div>
              </div>
              <div className="space-y-4">
                {inventoryTable.slice(0, 6).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[#f4f4ef]/50 dark:bg-white/5 border border-transparent hover:border-[#dadad5] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1a1c19] flex items-center justify-center border border-[#dadad5] dark:border-[#3b3b3b]">
                        <span className="material-symbols-outlined" style={{ color: item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32" }}>package_2</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.category}</p>
                        <p className="text-[10px] text-[#444743] uppercase tracking-widest">{item.quantity}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: item.tone === "error" ? "#ffdad6" : item.tone === "warning" ? "#fff3e0" : "#e8f5e9", color: item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32" }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "SiteMap" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-[#232622] rounded-3xl p-6 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm min-h-[500px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,199,132,0.15),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(255,179,0,0.12),_transparent_32%),linear-gradient(135deg,_#f7f7f2,_#eef5ef)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,199,132,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(255,179,0,0.08),_transparent_32%),linear-gradient(135deg,_#1a1c19,_#21251f)]" />
                <div className="relative z-10 h-full min-h-[440px] rounded-[2rem] border border-white/40 dark:border-white/10 overflow-hidden">
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-25">
                    {Array.from({ length: 36 }).map((_, idx) => (
                      <div key={idx} className="border border-black/5 dark:border-white/5" />
                    ))}
                  </div>
                  {shelterMarkers.map((center) => (
                    <div
                      key={center.id}
                      className="absolute group"
                      style={{ left: `${center.x}%`, top: `${center.y}%` }}
                    >
                      <div className={`w-4 h-4 rounded-full animate-ping absolute -left-1 -top-1 opacity-60 ${center.tone === "error" ? "bg-red-500" : center.tone === "warning" ? "bg-amber-400" : "bg-emerald-500"}`} />
                      <button
                        type="button"
                        className={`relative w-10 h-10 rounded-2xl shadow-xl border-4 border-white dark:border-[#1a1c19] flex items-center justify-center transition-transform group-hover:scale-110 ${center.tone === "error" ? "bg-red-600" : center.tone === "warning" ? "bg-amber-500" : "bg-emerald-600"}`}
                      >
                        <span className="material-symbols-outlined text-white text-lg">home</span>
                      </button>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                        <div className="bg-white/95 dark:bg-[#111310]/95 backdrop-blur-md rounded-xl shadow-xl border border-white/30 dark:border-white/10 px-3 py-2 text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest">{center.name}</p>
                          <p className="text-[9px] text-[#707a6c] dark:text-[#c4c7c0]">{center.barangay}, {center.municipality}</p>
                          <p className="text-[9px] font-bold">{center.currentOccupancy.toLocaleString()} / {center.capacity.toLocaleString()} pax</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {shelterMarkers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-[#707a6c]">No shelter centers returned by the backend yet.</div>
                  )}
                </div>
                <div className="absolute top-6 left-6 bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/20">
                  <h4 className="text-xs font-black uppercase tracking-widest mb-3">Live Telemetry</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-[10px] font-bold text-[#444743]">Active Shelters</span>
                      <span className="text-xs font-black" style={{ color: phaseConfig.primaryColor }}>{activeShelters} Locations</span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-[10px] font-bold text-[#444743]">Total Pop.</span>
                      <span className="text-xs font-black">{totalPopulation.toLocaleString()} pax</span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-[10px] font-bold text-[#444743]">High Utilization</span>
                      <span className="text-xs font-black">{overview?.capacity.highUtilizationCenters ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-6 right-6 flex gap-4">
                  <button className="bg-white dark:bg-[#1a1c19] w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"><span className="material-symbols-outlined">add</span></button>
                  <button className="bg-white dark:bg-[#1a1c19] w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"><span className="material-symbols-outlined">remove</span></button>
                  <button className="text-white w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform" style={{ background: phaseConfig.primaryColor }}><span className="material-symbols-outlined">my_location</span></button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-[#232622] rounded-3xl p-5 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-4">Shelter Directory</h4>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {capacityCenters.slice(0, 8).map((center) => (
                      <div key={center.id} className="p-4 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-sm">{center.name}</p>
                            <p className="text-[10px] text-[#707a6c] uppercase tracking-widest">{center.barangay}, {center.municipality}</p>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full" style={{ background: center.utilizationRate >= 90 ? "#ffdad6" : center.utilizationRate >= 70 ? "#fff3e0" : "#e8f5e9", color: center.utilizationRate >= 90 ? "#ba1a1a" : center.utilizationRate >= 70 ? "#FFB300" : "#2E7D32" }}>
                            {Math.round(center.utilizationRate)}%
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#444743]">
                          <span>{center.currentOccupancy.toLocaleString()} Occupied</span>
                          <span>{center.availableSlots.toLocaleString()} Available</span>
                        </div>
                      </div>
                    ))}
                    {capacityCenters.length === 0 && (
                      <p className="text-sm text-[#707a6c]">No shelter records available yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* BottomNav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-2xl border-t border-[#dadad5] shadow-lg rounded-t-3xl">
          <Link href="/site-manager" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'Dashboard' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'Dashboard' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">dashboard</span>
          </Link>
          <Link href="/site-manager/inventory" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'Inventory' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'Inventory' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">inventory_2</span>
          </Link>
          <Link href="/site-manager/sitemap" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'SiteMap' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'SiteMap' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">map</span>
          </Link>
      </nav>

      {/* Item Action Side Panel */}
      {isActionPanelOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsActionPanelOpen(false)}></div>
          <aside className="relative w-full max-w-xl bg-white dark:bg-[#1a1c19] rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] p-12 animate-in zoom-in-95 duration-500 flex flex-col border border-white/20">
            <div className="flex justify-between items-start mb-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: phaseConfig.primaryColor }}></span>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#707a6c]">Internal Registry</span>
                </div>
                <h3 className="text-4xl font-black tracking-tight">Stock Adjustment</h3>
              </div>
              <button onClick={() => setIsActionPanelOpen(false)} className="w-12 h-12 flex items-center justify-center bg-[#f4f4ef] hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Premium Item Header */}
            <div className="bg-[#f4f4ef] dark:bg-[#232622] p-8 rounded-[2.5rem] mb-10 border border-[#dadad5] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <span className="material-symbols-outlined text-8xl rotate-12">{selectedItem.icon}</span>
              </div>
              
              <div className="flex items-center gap-6 mb-8 relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center border border-[#dadad5] shadow-xl">
                   <span className="material-symbols-outlined text-4xl" style={{ color: phaseConfig.primaryColor }}>{selectedItem.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black">{selectedItem.category}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#dadad5] text-[9px] font-black uppercase tracking-widest text-[#444743]">ID: {selectedItem.category.slice(0,3).toUpperCase()}-2026</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest" style={{ background: selectedItem.tone === 'error' ? '#ffdad6' : '#e8f5e9', color: selectedItem.tone === 'error' ? '#ba1a1a' : '#2E7D32' }}>{selectedItem.status}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white">
                   <p className="text-[10px] font-black text-[#707a6c] uppercase tracking-widest mb-1">Live Quantity</p>
                   <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-black">{selectedItem.stock}</span>
                     <span className="text-xs font-bold text-[#707a6c]">Available</span>
                   </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white">
                   <p className="text-[10px] font-black text-[#707a6c] uppercase tracking-widest mb-1">Impact Radius</p>
                   <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-black text-orange-600">High</span>
                     <span className="text-xs font-bold text-[#707a6c]">Zone A</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Input Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
               <div className="space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Manual Override</label>
                 <div className="flex items-center gap-3 bg-[#f4f4ef] p-2 rounded-2xl border border-[#dadad5] shadow-inner">
                   <button className="w-12 h-12 rounded-xl bg-white shadow-sm font-black text-xl hover:scale-105 active:scale-95 transition-all">-</button>
                   <div className="flex-grow flex flex-col items-center">
                     <input 
                       className="w-full bg-transparent border-none text-center font-black text-2xl focus:ring-0 p-0" 
                       defaultValue={parseInt(selectedItem.stock)} 
                     />
                     <span className="text-[9px] font-black text-[#707a6c] uppercase tracking-tighter">Units</span>
                   </div>
                   <button className="w-12 h-12 rounded-xl bg-white shadow-sm font-black text-xl hover:scale-105 active:scale-95 transition-all">+</button>
                 </div>
               </div>

               <div className="space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Change Reason</label>
                 <div className="relative group">
                   <select className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-2xl h-16 px-6 font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all" style={{ outlineColor: phaseConfig.primaryColor } as any}>
                     <option>Distribution Update</option>
                     <option>Damaged Goods</option>
                     <option>Correction/Audit</option>
                     <option>Expiry Removal</option>
                   </select>
                   <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#707a6c] group-hover:translate-y-[-40%] transition-transform">unfold_more</span>
                 </div>
               </div>

               <div className="md:col-span-2 space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Adjustment Notes</label>
                 <textarea 
                    className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-2xl p-5 text-sm font-medium focus:ring-2 min-h-[100px] transition-all" 
                    placeholder="Provide context for this registry update..."
                    style={{ outlineColor: phaseConfig.primaryColor } as any}
                 ></textarea>
               </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-4 mt-auto">
              <button 
                onClick={() => setIsActionPanelOpen(false)} 
                className="flex-1 bg-[#f4f4ef] text-[#444743] py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-[#eeeeea] active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                className="flex-[2] text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all" 
                style={{ background: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
              >
                Confirm Update
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Receive Goods Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsReceiveModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-[#1a1c19] w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black mb-2">New Shipment Intake</h3>
                <p className="text-[#444743] text-sm font-medium">Scan or manually enter physical relief goods being received at this site.</p>
              </div>
              <button onClick={() => setIsReceiveModalOpen(false)} className="material-symbols-outlined p-2 hover:bg-[#f4f4ef] rounded-full">close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="h-64 bg-[#1a1c19] rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer border-4 border-dashed border-white/20 hover:border-white/40 transition-colors">
                  <span className="material-symbols-outlined text-5xl text-white/40 mb-4 group-hover:scale-110 transition-transform">qr_code_scanner</span>
                  <p className="text-white/60 font-black text-xs uppercase tracking-widest">Open Scanner</p>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Arrival Terminal</label>
                    <input className="w-full bg-[#f4f4ef] border-none rounded-xl h-12 px-4 font-bold" placeholder="e.g. North Dock 4" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Waybill Number</label>
                    <input className="w-full bg-[#f4f4ef] border-none rounded-xl h-12 px-4 font-bold" placeholder="WB-9982-X" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Condition</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="py-2 text-[10px] font-black uppercase rounded-lg bg-green-100 text-green-700 border-2 border-green-500">Intact</button>
                      <button className="py-2 text-[10px] font-black uppercase rounded-lg bg-[#f4f4ef] text-[#444743]">Minor</button>
                      <button className="py-2 text-[10px] font-black uppercase rounded-lg bg-[#f4f4ef] text-[#444743]">Damaged</button>
                    </div>
                  </div>
               </div>
            </div>

            <div className="mt-10 flex gap-4">
               <button onClick={() => setIsReceiveModalOpen(false)} className="flex-1 bg-[#f4f4ef] py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
               <button className="flex-[2] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all" style={{ background: phaseConfig.primaryColor }}>Log Physical Intake</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteManagerDashboard;
