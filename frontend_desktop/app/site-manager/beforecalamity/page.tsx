import React, { Suspense } from "react";
import SiteManagerDashboard from "../components/SiteManagerDashboard";

export default function BeforeCalamityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf5] dark:bg-[#1a1c19] flex items-center justify-center font-bold">Loading Before Calamity...</div>}>
      <SiteManagerDashboard phase="before" />
    </Suspense>
  );
}
