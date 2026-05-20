import React, { Suspense } from "react";
import SiteManagerDashboard from "../components/SiteManagerDashboard";

export default function AfterCalamityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf5] dark:bg-[#1a1c19] flex items-center justify-center font-bold">Loading After Calamity...</div>}>
      <SiteManagerDashboard phase="after" />
    </Suspense>
  );
}
