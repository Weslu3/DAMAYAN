"use client";

import React from "react";
import Link from "next/link";

export type NavDestination = "Overview" | "Family & ID" | "Safety Map" | "Relief Status";

interface CitizenSidebarProps {
  phase: "before" | "during" | "after";
  setPhase: (phase: "before" | "during" | "after") => void;
  onNavigate?: (destination: NavDestination | "Profile") => void;
  activeNav?: NavDestination | "Profile";
}

const CitizenSidebar: React.FC<CitizenSidebarProps> = ({ phase, setPhase, onNavigate, activeNav = "Overview" }) => {
  const phaseConfig = {
    before: {
      label: "Preparedness",
      color: "#2E7D32",
      icon: "task_alt",
    },
    during: {
      label: "Emergency",
      color: "#FFB300",
      icon: "warning",
    },
    after: {
      label: "Recovery",
      color: "#2E7D32",
      icon: "volunteer_activism",
    },
  }[phase];

  const navItems: { label: NavDestination; icon: string }[] = [
    { label: "Overview", icon: "dashboard" },
    { label: "Family & ID", icon: "group" },
    { label: "Safety Map", icon: "map" },
    { label: "Relief Status", icon: "package_2" },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col bg-[#f4f4ef] dark:bg-[#232622] border-r border-[#dadad5] dark:border-[#3b3b3b] p-6 z-50 transition-colors duration-300">
      {/* Brand */}
      <Link href="/citizen" className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: phaseConfig.color }}>
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
        </div>
        <div>
          <h1 className="font-black text-xl tracking-tight text-[#1a1c19] dark:text-[#e2e3dd]">DAMAYAN</h1>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#707a6c] dark:text-[#c4c7c0] opacity-70">Citizen Portal</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-grow space-y-2">
        {navItems.map((item) => {
          const isActive = activeNav === item.label;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate?.(item.label)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
                isActive 
                  ? "bg-white dark:bg-[#3b3b3b] shadow-md text-[#1a1c19] dark:text-white" 
                  : "text-[#444743] dark:text-[#c4c7c0] hover:bg-white/50 dark:hover:bg-white/5 hover:translate-x-1"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${isActive ? "" : "opacity-60"}`} style={isActive ? { color: phaseConfig.color } : {}}>
                {item.icon}
              </span>
              <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? "font-black" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Phase Status */}
      <div className="mt-auto pt-6 border-t border-[#dadad5] dark:border-[#3b3b3b]">
        <div className="bg-white dark:bg-[#3b3b3b] rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-sm" style={{ color: phaseConfig.color }}>{phaseConfig.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#707a6c] dark:text-[#c4c7c0]">Current Phase</span>
          </div>
          <div className="font-black text-sm" style={{ color: phaseConfig.color }}>{phaseConfig.label}</div>
        </div>

        {/* Phase Toggle (Simulated for Demo) */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#dadad5]/50 dark:bg-[#3b3b3b]/50 rounded-xl mb-4">
          {(["before", "during", "after"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`py-1 text-[8px] font-black uppercase rounded-lg transition-all ${
                phase === p ? "bg-white dark:bg-[#444743] shadow-sm text-[#1a1c19] dark:text-white" : "text-[#707a6c] dark:text-[#c4c7c0] hover:bg-white/30 dark:hover:bg-white/10"
              }`}
            >
              {p[0]}
            </button>
          ))}
        </div>

      </div>
    </aside>
  );
};

export default CitizenSidebar;
