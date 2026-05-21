import type { IncidentReport } from "../../../lib/types";

export interface StructureDamageRecord {
  id: string;
  ownerName: string;
  address: string;
  severity: string;
  needsAid: boolean;
  status: string;
}

export interface RecoveryPlanCard {
  id: string;
  name: string;
  progress: number;
  lead: string;
  status: string;
}

export interface AuditEntry {
  id: string;
  title: string;
  timestamp: string;
  source: string;
  status: string;
  note: string;
  sortAt: number;
}

export interface HistoricalDisasterRecord {
  id: string;
  name: string;
  date: string;
  severity: string;
  province: string;
  affectedAreas: number;
  status: string;
  lessonsLearned: string;
  fullText: string;
}

export interface InventoryTableRow {
  id: string;
  category: string;
  stock: string;
  incoming: string;
  eta: string;
  status: string;
  icon: string;
  tone: "secure" | "warning" | "error";
  quantity: string;
}

export interface PhaseConfig {
  label: string;
  subLabel: string;
  mainTitle: string;
  mainDesc: string;
  statusLabel: string;
  siteLocationLabel: string;
  accent: string;
  primaryColor: string;
  primaryContainer: string;
  heroMetricLabel: string;
  checklistTitle: string;
  checklistDesc: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

export interface DamageAssessmentState {
  infraStatus: string;
  estimatedCost: string;
  reliefNeeded: string;
  durationDays: string;
  shelterRating: string;
  successNotes: string;
  bottlenecks: string;
  isSubmitted: boolean;
}

export function normalizeDamageSeverity(severity: string, content?: string): string {
  const combined = `${severity} ${content ?? ""}`.toLowerCase();
  if (combined.includes("collapse") || combined.includes("severe")) {
    return "Severe / Collapse";
  }
  if (combined.includes("major")) {
    return "Major Damage";
  }
  return "Minor Damage";
}

export function toStructureDamageRecord(report: IncidentReport): StructureDamageRecord | null {
  const combinedText = `${report.title} ${report.content}`.toLowerCase();
  const looksLikeDamageRecord =
    report.title.toLowerCase().startsWith("damage assessment") ||
    /(damage|collapse|structural|rehab|house|home assessment)/i.test(combinedText);

  if (!looksLikeDamageRecord) {
    return null;
  }

  const ownerName = report.title.replace(/^damage assessment:\s*/i, "").trim() || report.reportedBy;
  const needsAid =
    /immediate financial assistance:\s*yes/i.test(report.content) ||
    /(severe|major)/i.test(report.severity);

  return {
    id: report.id,
    ownerName: ownerName || "Unspecified homeowner",
    address: report.location,
    severity: normalizeDamageSeverity(report.severity, report.content),
    needsAid,
    status: report.status || "logged",
  };
}

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function progressStatus(progress: number): string {
  if (progress >= 100) return "Complete";
  if (progress >= 70) return "Active";
  if (progress >= 40) return "In Progress";
  return "Planning";
}

export function formatTimestamp(value?: string): string {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function formatMonthYear(value?: string): string {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function getInventoryTone(status: string): "secure" | "warning" | "error" {
  const normalized = status.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("depleted")) {
    return "error";
  }
  if (normalized.includes("low") || normalized.includes("transit") || normalized.includes("scheduled")) {
    return "warning";
  }
  return "secure";
}

export function getSeverityBadgeClass(severity: string): string {
  if (severity === "Severe / Collapse") {
    return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
  if (severity === "Major Damage") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300";
}

export function formatRelativeTime(iso?: string): string {
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

export function getPhaseConfig(phase: "before" | "during" | "after"): PhaseConfig {
  const configs: Record<string, PhaseConfig> = {
    before: {
      label: "Pre-Disaster Phase",
      subLabel: "Readiness & Mitigation",
      mainTitle: "Regional Preparedness Dashboard",
      mainDesc: "Live readiness metrics for your assigned site cluster and logistics network.",
      statusLabel: "Active Preparedness Mode",
      siteLocationLabel: "Staging & Preparedness Hub",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1B5E20",
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
      siteLocationLabel: "Evacuation Command Post",
      accent: "#FFB300",
      primaryColor: "#FFB300",
      primaryContainer: "#FFA000",
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
      siteLocationLabel: "Recovery Coordination Desk",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1B5E20",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Recovery Progress",
      checklistTitle: "Post-Disaster Recovery Reports",
      checklistDesc: "Submit verified shelter, damage, and recovery records based on synced disaster data.",
    },
  };
  return configs[phase];
}

export function buildInventoryTable(
  inventoryItems: import("../../../lib/types").InventoryItem[],
  scaleMax: number,
  inventoryFilter: "all" | "critical" | "low" | "secure" = "all",
  limit = 8,
): InventoryTableRow[] {
  const sorted = inventoryItems.slice().sort((a, b) => {
    const priority = { error: 0, warning: 1, secure: 2 };
    return (priority[getInventoryTone(a.status)] ?? 2) - (priority[getInventoryTone(b.status)] ?? 2);
  });

  const filtered = sorted.filter((item) => {
    if (inventoryFilter === "all") return true;
    const tone = getInventoryTone(item.status);
    if (inventoryFilter === "critical") return tone === "error";
    if (inventoryFilter === "low") return tone === "warning";
    if (inventoryFilter === "secure") return tone === "secure";
    return true;
  });

  return filtered.slice(0, limit).map((item) => {
    const stockPercent = Math.max(5, Math.min(100, Math.round((item.quantity / scaleMax) * 100)));
    const tone = getInventoryTone(item.status);
    const statusMap: Record<string, string> = { error: "Critical", warning: "Replenish" };
    return {
      id: item.id,
      category: item.name,
      stock: `${stockPercent}%`,
      incoming: tone === "warning" ? `${Math.max(0, Math.round(item.quantity * 0.3)).toLocaleString()} ${item.unit}` : "--",
      eta: tone === "warning" ? "Pending" : "--",
      status: statusMap[tone] || "Stable",
      icon: "inventory_2",
      tone,
      quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
    };
  });
}

export function computeScaleMax(inventoryItems: import("../../../lib/types").InventoryItem[]): number {
  const quantities = inventoryItems.map((item) => item.quantity);
  const sorted = quantities.slice().sort((a, b) => a - b);
  return sorted.length > 0
    ? Math.max(100, Math.min(2000, sorted[Math.floor(sorted.length * 0.75)] || sorted[sorted.length - 1]))
    : 1000;
}
