// ─── Types ────────────────────────────────────────────────────────────────────
export type NavPage = "dashboard" | "resource-map" | "rescue-monitoring" | "incidents" | "resources" | "ask-volunteers" | "profile";
export type UnitStatus = "Available" | "On Route" | "On Scene" | "Offline";
export type UnitType = "FIELD" | "MEDIC" | "LOGISTICS";
export type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "New" | "Waiting" | "Dispatched" | "In Progress" | "Resolved" | "Invalid";
export type SituationType = "Under Control" | "Escalating" | "Critical";
export type TeamStatus = "Ready" | "Deployed" | "Standby" | "Offline";

export function shortenId(id: string) {
  if (!id) return "";
  if (id.startsWith("INC-")) return id;
  if (id.length >= 24) return `INC-${id.substring(id.length - 6).toUpperCase()}`;
  if (id.includes("-")) return `INC-${id.split("-")[0].toUpperCase()}`;
  return `INC-${id.substring(0, 6).toUpperCase()}`;
}

export interface DispatcherProfile {
  id: string; name: string; username: string; email: string; phone: string;
  badge: string; rank: string; cluster: string; station: string;
  initials: string; joinedDate: string; totalDispatches: number; resolvedToday: number;
}

export interface Unit {
  id: string; type: UnitType; name: string; station: string;
  status: UnitStatus; lat: number; lng: number;
  personnel: number; distance: string; eta: string;
  teamLeader: string; contact: string; plateNumber: string; lastActive: string;
}

export interface Incident {
  id: string; type: string; category: UnitType | "Other";
  disasterId?: string;
  reporter: string; reporterPhone: string;
  address: string; barangay: string; city: string; location: string;
  lat: number; lng: number;
  timeReported: string; dateReported: string;
  priority: IncidentPriority; status: IncidentStatus;
  situationType: SituationType;
  assignedUnits: string[];
  description: string; notes: string;
  timeActive: number;
  invalidReason?: string; dispatchedAt?: string; resolvedAt?: string;
}

export interface Team {
  id: string; name: string; type: UnitType;
  members: number; vehicles: number;
  station: string; contact: string; leader: string;
  status: TeamStatus; equipment: string[]; coverage: string;
  assignedArea?: string; // For pre-positioning
}

export interface BarangayDemographics {
  name: string;
  population?: number;
  density?: number;
  elderly?: number;
  infants?: number;
  riskLevel: "Low" | "Medium" | "High";
  coordinates: [number, number];
  province?: string;
  region?: string;
}

export interface PreparednessReport {
  id: string;
  title: string;
  date: string;
  status: "Draft" | "Published";
  summary: string;
}

// ─── Mock Dispatcher ──────────────────────────────────────────────────────────
export const MOCK_DISPATCHER: DispatcherProfile = {
  id: "DSP-001", name: "Daniel Santos", username: "d.santos",
  email: "d.santos@ndrrmc.gov.ph", phone: "+63 917 345 6789",
  badge: "DS-3042", rank: "Senior Dispatcher",
  cluster: "Metro Cluster 3", station: "Sampaloc Command Center",
  initials: "DS", joinedDate: "March 14, 2021",
  totalDispatches: 1_284, resolvedToday: 7,
};

export const MOCK_BARANGAY_DATA: BarangayDemographics[] = [
  { name: "Brgy. 390", population: 5200, density: 45000, elderly: 450, infants: 120, riskLevel: "High", coordinates: [14.6105, 120.9982] },
  { name: "Brgy. 485", population: 3800, density: 32000, elderly: 280, infants: 85, riskLevel: "Medium", coordinates: [14.6130, 120.9943] },
  { name: "Brgy. 522", population: 6100, density: 51000, elderly: 510, infants: 145, riskLevel: "High", coordinates: [14.6053, 120.9901] },
  { name: "Brgy. 412", population: 4200, density: 38000, elderly: 320, infants: 90, riskLevel: "Medium", coordinates: [14.6015, 121.0018] },
  { name: "Brgy. Dona Imelda", population: 8500, density: 28000, elderly: 620, infants: 180, riskLevel: "Medium", coordinates: [14.6072, 121.0038] },
];

export const MOCK_REPORTS: PreparednessReport[] = [
  { id: "REP-001", title: "Q3 Flood Readiness Assessment", date: "2026-03-20", status: "Published", summary: "Assessment of drainage systems and evacuation route accessibility in Sampaloc." },
  { id: "REP-002", title: "Fire Safety Audit - District 4", date: "2026-04-05", status: "Published", summary: "Annual audit of fire hydrant locations and community volunteer training status." },
  { id: "REP-003", title: "Coastal Surge Preparedness", date: "2026-05-10", status: "Draft", summary: "Drafting response plans for potential storm surges affecting low-lying clusters." },
];

// ─── Mock Units ───────────────────────────────────────────────────────────────
export const MOCK_UNITS: Unit[] = [
  {
    id: "FIELD-10", type: "FIELD", name: "Field Volunteer Echo-1", station: "Sampaloc Command Center",
    status: "Available", lat: 14.6098, lng: 120.9974, personnel: 6, distance: "0.8 km", eta: "00:06",
    teamLeader: "Rafael Cruz", contact: "+63 917 210 4410", plateNumber: "Volunteer", lastActive: "2 min ago",
  },
  {
    id: "MEDIC-03", type: "MEDIC", name: "Medic Volunteer Alpha", station: "UST Health Post",
    status: "Available", lat: 14.6117, lng: 120.9918, personnel: 4, distance: "1.1 km", eta: "00:08",
    teamLeader: "Dr. Lina Reyes", contact: "+63 917 210 4411", plateNumber: "Volunteer", lastActive: "Just now",
  },
  {
    id: "LOG-04", type: "LOGISTICS", name: "Logistics Volunteer Delta", station: "Lacson Supply Hub",
    status: "On Route", lat: 14.6048, lng: 120.9931, personnel: 5, distance: "1.6 km", eta: "00:12",
    teamLeader: "Noel Garcia", contact: "+63 917 210 4412", plateNumber: "Volunteer", lastActive: "5 min ago",
  },
  {
    id: "FIELD-12", type: "FIELD", name: "Field Volunteer Bravo", station: "Dapitan Staging Area",
    status: "Available", lat: 14.6134, lng: 120.9949, personnel: 7, distance: "1.3 km", eta: "00:09",
    teamLeader: "Mika Santos", contact: "+63 917 210 4413", plateNumber: "Volunteer", lastActive: "4 min ago",
  },
];

// ─── Mock Incidents ───────────────────────────────────────────────────────────
export const MOCK_INCIDENTS: Incident[] = [
  {
    id: "INC-0145", type: "Structure Fire", category: "FIELD",
    reporter: "Brgy. Watch Team", reporterPhone: "+63 917 111 0001",
    address: "1113 Aurora Blvd, cor. Gilmore Ave", barangay: "Brgy. Dona Imelda", city: "Quezon City", location: "Aurora Blvd",
    lat: 14.6072, lng: 121.0038, timeReported: "9:41 AM", dateReported: "2026-04-14",
    priority: "HIGH", status: "New", situationType: "Critical", assignedUnits: [],
    description: "3-storey residential building on fire. Ground floor fully engulfed. Neighbors report hearing explosions. 2 persons possibly trapped on 2nd floor.",
    notes: "", timeActive: 1,
  },
  {
    id: "INC-0146", type: "Structure Fire", category: "FIELD",
    reporter: "Anonymous Caller", reporterPhone: "+63 917 111 0002",
    address: "45 Pnoval St., near Bustillos", barangay: "Brgy. 390", city: "Sampaloc, Manila", location: "Pnoval St.",
    lat: 14.6105, lng: 120.9982, timeReported: "9:42 AM", dateReported: "2026-04-14",
    priority: "HIGH", status: "Waiting", situationType: "Critical", assignedUnits: [],
    description: "Commercial building fire. Heavy smoke visible from 2 blocks away. Fire spreading to adjacent structure.",
    notes: "", timeActive: 1,
  },
  {
    id: "INC-0147", type: "Flash Flood", category: "Other",
    reporter: "PAGASA Monitor", reporterPhone: "+63 2 8527 1541",
    address: "Dapitan St., cor. España Blvd.", barangay: "Brgy. 485", city: "Sampaloc, Manila", location: "Dapitan St.",
    lat: 14.6130, lng: 120.9943, timeReported: "9:43 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "Waiting", situationType: "Escalating", assignedUnits: [],
    description: "Flood water reaching knee-level. Canal overflow due to heavy rainfall. 3 families requesting evacuation assistance.",
    notes: "", timeActive: 2,
  },
  {
    id: "INC-0148", type: "Medical Emergency", category: "MEDIC",
    reporter: "Maria Santos", reporterPhone: "+63 917 111 0004",
    address: "872 Lacson Avenue, Sampaloc", barangay: "Brgy. 522", city: "Sampaloc, Manila", location: "Lacson Avenue",
    lat: 14.6053, lng: 120.9901, timeReported: "9:44 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "Dispatched", situationType: "Under Control", assignedUnits: ["AMB-03"],
    description: "Elderly male, 72 y/o, fell from stairs. Suspected femur fracture. Conscious but in severe pain.",
    notes: "Patient is diabetic. Family waiting downstairs.", timeActive: 3,
    dispatchedAt: "9:45 AM",
  },
  {
    id: "INC-0149", type: "Road Accident", category: "LOGISTICS",
    reporter: "Bystander", reporterPhone: "+63 917 111 0005",
    address: "Cayco St. near Jhocson College", barangay: "Brgy. 412", city: "Sampaloc, Manila", location: "Cayco St.",
    lat: 14.6015, lng: 121.0018, timeReported: "9:35 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "In Progress", situationType: "Escalating", assignedUnits: ["AMB-03", "POL-04"],
    description: "2-vehicle collision. Motorcycle vs. SUV. Motorcyclist unresponsive. SUV driver injured. Traffic severely disrupted.",
    notes: "Road closure needed. Fuel leak from SUV.", timeActive: 10,
    dispatchedAt: "9:37 AM",
  },
  {
    id: "INC-0150", type: "Road Accident", category: "LOGISTICS",
    reporter: "Juan dela Cruz", reporterPhone: "+63 917 111 0006",
    address: "Aurora Blvd. near Katipunan LRT", barangay: "Brgy. Loyola Heights", city: "Quezon City", location: "Aurora Blvd.",
    lat: 14.5985, lng: 121.0082, timeReported: "9:28 AM", dateReported: "2026-04-14",
    priority: "LOW", status: "In Progress", situationType: "Under Control", assignedUnits: ["AMB-01", "AMB-05", "POL-01"],
    description: "Multi-vehicle collision involving a bus and 2 cars. 4 injured, none critical. Scene managed by initial responders.",
    notes: "LRT unaffected. MMDA on site.", timeActive: 13,
    dispatchedAt: "9:30 AM",
  },
  {
    id: "INC-0151", type: "Medical Emergency", category: "MEDIC",
    reporter: "Barangay Health Center", reporterPhone: "+63 917 111 0007",
    address: "Brgy. San Felipe, San Felipe Neri", barangay: "Brgy. San Felipe Neri", city: "Mandaluyong", location: "Brgy. San Felipe",
    lat: 14.6150, lng: 121.0070, timeReported: "9:21 AM", dateReported: "2026-04-14",
    priority: "LOW", status: "In Progress", situationType: "Critical", assignedUnits: ["AMB-07"],
    description: "Suspected cardiac arrest, 58 y/o male. CPR administered by barangay health worker. AED on site.",
    notes: "Patient has history of heart disease.", timeActive: 20,
    dispatchedAt: "9:23 AM",
  },
  {
    id: "INC-0138", type: "Structure Fire", category: "FIELD",
    reporter: "Tondo Fire Station", reporterPhone: "+63 912 000 0001",
    address: "Flores St., Tondo", barangay: "Brgy. 105", city: "Tondo, Manila", location: "Flores St.",
    lat: 14.6187, lng: 120.9660, timeReported: "7:15 AM", dateReported: "2026-04-14",
    priority: "HIGH", status: "Resolved", situationType: "Under Control", assignedUnits: ["FIRE-01", "FIRE-03", "POL-09"],
    description: "Residential structure fire. Fully contained. 12 families displaced.",
    notes: "Coordinated with BFP QC for additional tankers.", timeActive: 65,
    dispatchedAt: "7:18 AM", resolvedAt: "8:23 AM",
  },
  {
    id: "INC-0139", type: "Medical Emergency", category: "MEDIC",
    reporter: "Barangay Tanod", reporterPhone: "+63 917 222 0001",
    address: "167 Dagupan St., Tondo", barangay: "Brgy. 124", city: "Tondo, Manila", location: "Dagupan St.",
    lat: 14.6210, lng: 120.9640, timeReported: "7:40 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "Resolved", situationType: "Under Control", assignedUnits: ["AMB-01"],
    description: "Child, 8 y/o, with severe asthma attack. Transported to Ospital ng Tondo.",
    notes: "Parents notified. Child stable.", timeActive: 30,
    dispatchedAt: "7:43 AM", resolvedAt: "8:13 AM",
  },
];

// ─── Mock Teams ───────────────────────────────────────────────────────────────
export const MOCK_TEAMS: Team[] = [
  {
    id: "TEAM-FIELD-01", name: "Sampaloc Field Response", type: "FIELD",
    members: 12, vehicles: 2, station: "Sampaloc Command Center", contact: "+63 917 310 8801",
    leader: "Rafael Cruz", status: "Ready", equipment: ["Rescue rope", "Portable radios", "Flood lights"],
    coverage: "Brgy. 390, Brgy. 485, Brgy. 522",
  },
  {
    id: "TEAM-MEDIC-01", name: "UST Medical Volunteer Team", type: "MEDIC",
    members: 8, vehicles: 1, station: "UST Health Post", contact: "+63 917 310 8802",
    leader: "Dr. Lina Reyes", status: "Standby", equipment: ["Trauma kits", "AED", "Patient tags"],
    coverage: "Brgy. 485, Brgy. 522",
  },
  {
    id: "TEAM-LOG-01", name: "Lacson Logistics Support", type: "LOGISTICS",
    members: 10, vehicles: 3, station: "Lacson Supply Hub", contact: "+63 917 310 8803",
    leader: "Noel Garcia", status: "Ready", equipment: ["Relief packs", "Water containers", "Generator"],
    coverage: "Brgy. 390, Brgy. 412",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function priorityClass(p: IncidentPriority) {
  return { CRITICAL: "dp-badge-red", HIGH: "dp-badge-red", MEDIUM: "dp-badge-amber", LOW: "dp-badge-green" }[p];
}

export function statusClass(s: IncidentStatus) {
  return { New: "dp-badge-red", Waiting: "dp-badge-amber", Dispatched: "dp-badge-blue", "In Progress": "dp-badge-purple", Resolved: "dp-badge-green", Invalid: "dp-badge-grey" }[s];
}

export function situationClass(s: SituationType) {
  return { "Under Control": "dp-badge-green", Escalating: "dp-badge-amber", Critical: "dp-badge-red" }[s];
}

export function situationColor(s: SituationType) {
  return { "Under Control": "#2e7d32", Escalating: "#c77700", Critical: "#c62828" }[s];
}

export function unitStatusColor(s: UnitStatus) {
  return { Available: "#2e7d32", "On Route": "#1565c0", "On Scene": "#c62828", Offline: "#9e9e9e" }[s];
}

export function unitTypeColor(t: UnitType) {
  return { FIELD: "#2e7d32", MEDIC: "#1565c0", LOGISTICS: "#c77700" }[t];
}

export function priorityColor(p: IncidentPriority) {
  return { CRITICAL: "#c62828", HIGH: "#c2440a", MEDIUM: "#c77700", LOW: "#2e7d32" }[p];
}

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  FIELD: "Field Volunteer",
  MEDIC: "Medic Volunteer",
  LOGISTICS: "Logistics Volunteer",
};

export const CATEGORY_LABEL: Record<string, string> = {
  FIELD: "Field Volunteer",
  MEDIC: "Medic Volunteer",
  LOGISTICS: "Logistics Volunteer",
  Other: "Volunteer",
};
export const UNIT_TYPE_ICON: Record<UnitType, string> = { FIELD: "FIELD", MEDIC: "MEDIC", LOGISTICS: "LOG" };
export const CATEGORY_ICON: Record<string, string> = { FIELD: "FIELD", MEDIC: "MEDIC", LOGISTICS: "LOG", Other: "ALERT" };

// ─── Backend Mapping Functions ────────────────────────────────────────────────
// These are used to convert backend API responses to frontend data structures
import { IncidentReport, Organization } from "../lib/types";

export function mapBackendToFrontendIncident(report: IncidentReport): Incident {
  const priorityMap: Record<string, IncidentPriority> = {
    low: "LOW",
    moderate: "MEDIUM",
    high: "HIGH",
    critical: "CRITICAL",
  };

  const statusMap: Record<string, IncidentStatus> = {
    pending: "New",
    reviewed: "Waiting",
    actioned: "Dispatched",
    closed: "Resolved",
  };
  const incidentType = report.title.toLowerCase();
  const category: Incident["category"] =
    /(medical|injur|health|patient|cardiac|fracture)/.test(incidentType) ? "MEDIC" :
    /(relief|supply|food|transport|evacuat|distribution)/.test(incidentType) ? "LOGISTICS" :
    /(fire|flood|rescue|collapse|damage)/.test(incidentType) ? "FIELD" :
    "Other";

  return {
    id: report.id,
    disasterId: report.disasterId,
    type: report.title,
    category,
    reporter: "Citizen Report",
    reporterPhone: "Verified",
    address: report.resolvedAddress || report.location,
    barangay: "",
    city: "",
    location: report.location,
    lat: report.latitude ?? 14.6042,
    lng: report.longitude ?? 120.9822,
    timeReported: new Date(report.createdAt).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    dateReported: new Date(report.createdAt).toLocaleDateString("en-PH"),
    priority: priorityMap[report.severity?.toLowerCase() || "moderate"] || "MEDIUM",
    status: statusMap[report.status?.toLowerCase() || "pending"] || "New",
    situationType: "Under Control",
    assignedUnits: [],
    description: report.content,
    notes: "",
    timeActive: 0,
  };
}

function classifyVolunteerType(org: Organization): UnitType {
  const haystack = `${org.name} ${org.type}`.toLowerCase();
  if (/(medic|medical|health|clinic|hospital|nurse|doctor|rescue)/.test(haystack)) return "MEDIC";
  if (/(logistics|supply|warehouse|transport|delivery|food|relief|private)/.test(haystack)) return "LOGISTICS";
  return "FIELD";
}

export function mapOrganizationToVolunteer(org: Organization, index: number): Unit {
  const type = classifyVolunteerType(org);
  const latOffset = ((index % 5) - 2) * 0.004;
  const lngOffset = (Math.floor(index / 5) - 1) * 0.004;

  return {
    id: org.id,
    type,
    name: org.name,
    station: (org as any).address || "Bayanihub volunteer network",
    status: org.verified ? "Available" : "Offline",
    lat: 14.604 + latOffset,
    lng: 120.997 + lngOffset,
    personnel: 1,
    distance: "From hub",
    eta: "On request",
    teamLeader: UNIT_TYPE_LABEL[type],
    contact: org.contactPhone || org.contactEmail || "Bayanihub",
    plateNumber: "Volunteer",
    lastActive: org.verified ? "Synced from backend" : "Needs verification",
  };
}

export function volunteersToTeams(volunteers: Unit[]): Team[] {
  return (["FIELD", "MEDIC", "LOGISTICS"] as UnitType[])
    .map((type) => {
      const group = volunteers.filter((u) => u.type === type);
      return {
        id: `TEAM-${type}`,
        name: `${UNIT_TYPE_LABEL[type]} Pool`,
        type,
        members: group.length,
        vehicles: 0,
        station: "Bayanihub volunteer network",
        contact: group.map((u) => u.contact).find(Boolean) || "Bayanihub",
        leader: group[0]?.teamLeader || UNIT_TYPE_LABEL[type],
        status: group.some((u) => u.status === "Available") ? "Ready" : "Standby",
        equipment: group.slice(0, 4).map((u) => u.name),
        coverage: "Assigned from verified Bayanihub organizations",
      } as Team;
    })
    .filter((team) => team.members > 0);
}

export function mapCityToBarangay(
  city: { psgcCode: string; name: string; province: string | null; region: string | null; coordinates: [number, number] },
  incidentCount: number,
): BarangayDemographics {
  const riskLevel: "Low" | "Medium" | "High" =
    incidentCount >= 3 ? "High" : incidentCount >= 1 ? "Medium" : "Low";
  return {
    name: city.name,
    riskLevel,
    coordinates: city.coordinates,
    province: city.province ?? undefined,
    region: city.region ?? undefined,
  };
}


