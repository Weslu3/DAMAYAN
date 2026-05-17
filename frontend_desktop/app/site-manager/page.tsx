"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SiteManagerDashboard from "./components/SiteManagerDashboard";

function DashboardContent() {
  const searchParams = useSearchParams();
  const phaseParam = searchParams.get("phase") || "before";
  const phase = (phaseParam === "during" || phaseParam === "after" || phaseParam === "before") ? phaseParam : "before";

  return <SiteManagerDashboard phase={phase} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf5] dark:bg-[#1a1c19] flex items-center justify-center font-bold">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
