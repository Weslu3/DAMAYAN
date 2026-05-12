"use client";

import { useState } from "react";
import CitizenAuthPage from "./CitizenAuthPage";
import CitizenSidebar, { NavDestination } from "./CitizenSidebar";
import CitizenHeader from "./CitizenHeader";
import CitizenBeforePage from "./CitizenBeforePage";
import CitizenDuringPage from "./CitizenDuringPage";
import CitizenAfterPage from "./CitizenAfterPage";
import CitizenProfilePage from "./CitizenProfilePage";

type Phase = "auth" | "before" | "during" | "after";

interface Props {
  initialPhase?: Phase;
}

export default function CitizenDashboard({ initialPhase = "auth" }: Props) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [activeNav, setActiveNav] = useState<NavDestination | "Profile">("Overview");
  const [targetStep, setTargetStep] = useState<string | null>(null);

  const handleNavigate = (dest: NavDestination | "Profile") => {
    if (dest === "Profile") {
      setActiveNav("Profile" as any);
      return;
    }
    
    setActiveNav(dest);
    
    switch (dest) {
      case "Overview":
        // Usually defaults to the current phase's main dashboard
        setTargetStep("dashboard");
        break;
      case "Family & ID":
        setPhase("before");
        setTargetStep("registration");
        break;
      case "Safety Map":
        setPhase("during");
        setTargetStep("map");
        break;
      case "Relief Status":
        setPhase("after");
        setTargetStep("relief_claim");
        break;
    }
  };

  // If in auth phase, show the full-screen auth page
  if (phase === "auth") {
    return <CitizenAuthPage onAuthenticated={() => setPhase("before")} />;
  }

  return (
    <div className="flex min-h-screen bg-[#fafaf5] dark:bg-[#1a1c19] text-[#1a1c19] dark:text-[#e2e3dd] font-['Public_Sans'] transition-colors duration-300">
      {/* Persistent Sidebar */}
      <CitizenSidebar 
        phase={phase as any} 
        setPhase={(p) => { setPhase(p as Phase); setActiveNav("Overview"); }} 
        onNavigate={handleNavigate}
        activeNav={activeNav}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Persistent Header */}
        <CitizenHeader phase={phase as any} onProfileClick={() => handleNavigate("Profile")} />

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto px-10 py-12 scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {activeNav === "Profile" ? (
              <CitizenProfilePage onBack={() => handleNavigate("Overview")} />
            ) : (
              <>
                {phase === "before" && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <CitizenBeforePage 
                      onGoToDuring={() => setPhase("during")} 
                      initialStep={targetStep === "registration" ? "registration" : "dashboard"}
                    />
                  </div>
                )}
                {phase === "during" && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <CitizenDuringPage 
                      onGoToAfter={() => setPhase("after")} 
                      initialStep={targetStep === "map" ? "map" : "decision"}
                    />
                  </div>
                )}
                {phase === "after" && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <CitizenAfterPage 
                      initialStep={targetStep === "relief_claim" ? "relief_claim" : "relief_claim"}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Dev Phase Switcher Overlay (Subtle) */}
      <div className="fixed bottom-6 right-6 z-[200] opacity-10 hover:opacity-100 transition-opacity duration-300 pointer-events-none hover:pointer-events-auto">
        <div className="bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-2 flex gap-1 border border-[#dadad5]">
           {(["auth", "before", "during", "after"] as Phase[]).map((p) => (
             <button
               key={p}
               onClick={() => { setPhase(p); setActiveNav("Overview"); }}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                 phase === p ? "bg-[#2E7D32] text-white" : "text-[#707a6c] hover:bg-[#f4f4ef]"
               }`}
             >
               {p}
             </button>
           ))}
        </div>
      </div>
    </div>
  );
}
