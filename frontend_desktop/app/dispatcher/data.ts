// ─── Types ────────────────────────────────────────────────────────────────────
export type NavPage = "dashboard" | "resource-map" | "rescue-monitoring" | "incidents" | "resources" | "profile";
export type UnitStatus = "Available" | "On Route" | "On Scene" | "Offline";
export type UnitType = "FIRE" | "AMB" | "POL";
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

// ─── Mock Units ───────────────────────────────────────────────────────────────
export const MOCK_UNITS: Unit[] = [
  { id: "FIRE-01", type: "FIRE", name: "Fire Unit Alpha-1", station: "Sampaloc Fire Station", status: "Available", lat: 14.6130, lng: 120.9912, personnel: 6, distance: "1.1 km", eta: "3 mins", teamLeader: "Capt. Jose Reyes", contact: "+63 912 001 0001", plateNumber: "BFP-1001", lastActive: "08:12 AM" },
  { id: "FIRE-07", type: "FIRE", name: "Fire Unit Bravo-7", station: "QC Fire District", status: "Available", lat: 14.6051, lng: 121.0021, personnel: 7, distance: "900 m", eta: "2 mins", teamLeader: "Capt. Miguel Santos", contact: "+63 912 001 0007", plateNumber: "BFP-1007", lastActive: "08:05 AM" },
  { id: "FIRE-03", type: "FIRE", name: "Fire Unit Charlie-3", station: "Sta. Mesa Station", status: "On Scene", lat: 14.5997, lng: 120.9985, personnel: 5, distance: "2.3 km", eta: "On scene", teamLeader: "Lt. Ramon Cruz", contact: "+63 912 001 0003", plateNumber: "BFP-1003", lastActive: "07:58 AM" },
  { id: "FIRE-05", type: "FIRE", name: "Fire Unit Delta-5", station: "Manila Central Station", status: "On Route", lat: 14.5920, lng: 120.9800, personnel: 6, distance: "3.1 km", eta: "8 mins", teamLeader: "Lt. Pedro Dela Cruz", contact: "+63 912 001 0005", plateNumber: "BFP-1005", lastActive: "08:21 AM" },
  { id: "AMB-03", type: "AMB", name: "Ambulance Bravo-3", station: "UERM Hospital", status: "Available", lat: 14.6083, lng: 121.0104, personnel: 3, distance: "1.2 km", eta: "5 mins", teamLeader: "Paramedic Grace Robles", contact: "+63 912 002 0003", plateNumber: "MMDA-A03", lastActive: "08:15 AM" },
  { id: "AMB-01", type: "AMB", name: "Ambulance Alpha-1", station: "San Lazaro Hospital", status: "On Route", lat: 14.6020, lng: 120.9870, personnel: 3, distance: "1.8 km", eta: "7 mins", teamLeader: "Nurse Ana Dela Cruz", contact: "+63 912 002 0001", plateNumber: "MMDA-A01", lastActive: "08:19 AM" },
  { id: "AMB-05", type: "AMB", name: "Ambulance Charlie-5", station: "PGH", status: "On Scene", lat: 14.5878, lng: 120.9856, personnel: 4, distance: "3.0 km", eta: "On scene", teamLeader: "Dr. Maria Santos", contact: "+63 912 002 0005", plateNumber: "MMDA-A05", lastActive: "07:50 AM" },
  { id: "AMB-07", type: "AMB", name: "Ambulance Delta-7", station: "Ospital ng Maynila", status: "Available", lat: 14.5960, lng: 120.9770, personnel: 3, distance: "2.2 km", eta: "6 mins", teamLeader: "Paramedic Carlo Bautista", contact: "+63 912 002 0007", plateNumber: "MMDA-A07", lastActive: "08:00 AM" },
  { id: "POL-01", type: "POL", name: "Police Unit Alpha-1", station: "Brgy. 102 Station", status: "Available", lat: 14.6170, lng: 120.9830, personnel: 4, distance: "1.5 km", eta: "4 mins", teamLeader: "SPO1 Roberto Ramos", contact: "+63 912 003 0001", plateNumber: "PNP-P001", lastActive: "08:08 AM" },
  { id: "POL-04", type: "POL", name: "Police Unit Bravo-4", station: "Sta. Mesa Station", status: "On Route", lat: 14.6040, lng: 121.0060, personnel: 4, distance: "800 m", eta: "2 mins", teamLeader: "SPO2 Carlos Lim", contact: "+63 912 003 0004", plateNumber: "PNP-P004", lastActive: "08:22 AM" },
  { id: "POL-07", type: "POL", name: "Police Unit Charlie-7", station: "Quiapo Station", status: "Offline", lat: 14.5970, lng: 120.9810, personnel: 3, distance: "—", eta: "—", teamLeader: "SPO1 Eduardo Garcia", contact: "+63 912 003 0007", plateNumber: "PNP-P007", lastActive: "06:30 AM" },
  { id: "POL-09", type: "POL", name: "Police Unit Delta-9", station: "Tondo Station", status: "Available", lat: 14.6250, lng: 120.9690, personnel: 5, distance: "2.8 km", eta: "7 mins", teamLeader: "PO3 Leo Manalo", contact: "+63 912 003 0009", plateNumber: "PNP-P009", lastActive: "08:18 AM" },
];

// ─── Mock Incidents ───────────────────────────────────────────────────────────
export const MOCK_INCIDENTS: Incident[] = [
  {
    id: "INC-0145", type: "Structure Fire", category: "FIRE",
    reporter: "Brgy. Watch Team", reporterPhone: "+63 917 111 0001",
    address: "1113 Aurora Blvd, cor. Gilmore Ave", barangay: "Brgy. Dona Imelda", city: "Quezon City", location: "Aurora Blvd",
    lat: 14.6072, lng: 121.0038, timeReported: "9:41 AM", dateReported: "2026-04-14",
    priority: "HIGH", status: "New", situationType: "Critical", assignedUnits: [],
    description: "3-storey residential building on fire. Ground floor fully engulfed. Neighbors report hearing explosions. 2 persons possibly trapped on 2nd floor.",
    notes: "", timeActive: 1,
  },
  {
    id: "INC-0146", type: "Structure Fire", category: "FIRE",
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
    id: "INC-0148", type: "Medical Emergency", category: "AMB",
    reporter: "Maria Santos", reporterPhone: "+63 917 111 0004",
    address: "872 Lacson Avenue, Sampaloc", barangay: "Brgy. 522", city: "Sampaloc, Manila", location: "Lacson Avenue",
    lat: 14.6053, lng: 120.9901, timeReported: "9:44 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "Dispatched", situationType: "Under Control", assignedUnits: ["AMB-03"],
    description: "Elderly male, 72 y/o, fell from stairs. Suspected femur fracture. Conscious but in severe pain.",
    notes: "Patient is diabetic. Family waiting downstairs.", timeActive: 3,
    dispatchedAt: "9:45 AM",
  },
  {
    id: "INC-0149", type: "Road Accident", category: "POL",
    reporter: "Bystander", reporterPhone: "+63 917 111 0005",
    address: "Cayco St. near Jhocson College", barangay: "Brgy. 412", city: "Sampaloc, Manila", location: "Cayco St.",
    lat: 14.6015, lng: 121.0018, timeReported: "9:35 AM", dateReported: "2026-04-14",
    priority: "MEDIUM", status: "In Progress", situationType: "Escalating", assignedUnits: ["AMB-03", "POL-04"],
    description: "2-vehicle collision. Motorcycle vs. SUV. Motorcyclist unresponsive. SUV driver injured. Traffic severely disrupted.",
    notes: "Road closure needed. Fuel leak from SUV.", timeActive: 10,
    dispatchedAt: "9:37 AM",
  },
  {
    id: "INC-0150", type: "Road Accident", category: "POL",
    reporter: "Juan dela Cruz", reporterPhone: "+63 917 111 0006",
    address: "Aurora Blvd. near Katipunan LRT", barangay: "Brgy. Loyola Heights", city: "Quezon City", location: "Aurora Blvd.",
    lat: 14.5985, lng: 121.0082, timeReported: "9:28 AM", dateReported: "2026-04-14",
    priority: "LOW", status: "In Progress", situationType: "Under Control", assignedUnits: ["AMB-01", "AMB-05", "POL-01"],
    description: "Multi-vehicle collision involving a bus and 2 cars. 4 injured, none critical. Scene managed by initial responders.",
    notes: "LRT unaffected. MMDA on site.", timeActive: 13,
    dispatchedAt: "9:30 AM",
  },
  {
    id: "INC-0151", type: "Medical Emergency", category: "AMB",
    reporter: "Barangay Health Center", reporterPhone: "+63 917 111 0007",
    address: "Brgy. San Felipe, San Felipe Neri", barangay: "Brgy. San Felipe Neri", city: "Mandaluyong", location: "Brgy. San Felipe",
    lat: 14.6150, lng: 121.0070, timeReported: "9:21 AM", dateReported: "2026-04-14",
    priority: "LOW", status: "In Progress", situationType: "Critical", assignedUnits: ["AMB-07"],
    description: "Suspected cardiac arrest, 58 y/o male. CPR administered by barangay health worker. AED on site.",
    notes: "Patient has history of heart disease.", timeActive: 20,
    dispatchedAt: "9:23 AM",
  },
  {
    id: "INC-0138", type: "Structure Fire", category: "FIRE",
    reporter: "Tondo Fire Station", reporterPhone: "+63 912 000 0001",
    address: "Flores St., Tondo", barangay: "Brgy. 105", city: "Tondo, Manila", location: "Flores St.",
    lat: 14.6187, lng: 120.9660, timeReported: "7:15 AM", dateReported: "2026-04-14",
    priority: "HIGH", status: "Resolved", situationType: "Under Control", assignedUnits: ["FIRE-01", "FIRE-03", "POL-09"],
    description: "Residential structure fire. Fully contained. 12 families displaced.",
    notes: "Coordinated with BFP QC for additional tankers.", timeActive: 65,
    dispatchedAt: "7:18 AM", resolvedAt: "8:23 AM",
  },
  {
    id: "INC-0139", type: "Medical Emergency", category: "AMB",
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
  { id: "TEAM-FIRE-A", name: "Fire Response Team Alpha", type: "FIRE", members: 18, vehicles: 3, station: "Sampaloc Fire Station, Manila", contact: "+63 2 711 0001", leader: "Chief Insp. Roberto Valdez", status: "Ready", equipment: ["Fire Truck", "Ladder Truck", "Rescue Van", "Hydraulic Tools", "Breathing Apparatus"], coverage: "Districts 1–4, Sampaloc" },
  { id: "TEAM-FIRE-B", name: "Fire Response Team Bravo", type: "FIRE", members: 14, vehicles: 2, station: "QC Fire District HQ", contact: "+63 2 711 0002", leader: "FO3 Arnel Marcelo", status: "Deployed", equipment: ["Fire Truck", "Rescue Van", "Thermal Camera", "Rope Rescue Kit"], coverage: "Quezon City North" },
  { id: "TEAM-AMB-A", name: "Emergency Medical Team Alpha", type: "AMB", members: 12, vehicles: 4, station: "UERM Hospital, Aurora Blvd.", contact: "+63 2 715 9000", leader: "Dr. Patricia Reyes", status: "Ready", equipment: ["Ambulance ×4", "AED Units", "Trauma Kits", "Oxygen Tanks"], coverage: "Quezon City & New Manila" },
  { id: "TEAM-AMB-B", name: "Emergency Medical Team Bravo", type: "AMB", members: 9, vehicles: 3, station: "Philippine General Hospital", contact: "+63 2 554 8400", leader: "Dr. Carlos Bautista", status: "Deployed", equipment: ["Ambulance ×3", "Advanced Cardiac Life Support"], coverage: "Manila South & Ermita" },
  { id: "TEAM-POL-A", name: "Police Response Unit Alpha", type: "POL", members: 20, vehicles: 5, station: "Manila Police District Station 3", contact: "+63 2 521 8000", leader: "PINSP Mark De Leon", status: "Ready", equipment: ["Patrol Cars ×3", "Motorcycles ×2", "Riot Gear", "Body Cameras"], coverage: "Sampaloc, Santa Cruz" },
  { id: "TEAM-POL-B", name: "Police Response Unit Bravo", type: "POL", members: 16, vehicles: 4, station: "QC Police District Station 7", contact: "+63 2 928 0000", leader: "PINSP Lisa Pangilinan", status: "Standby", equipment: ["Patrol Cars ×2", "K9 Unit", "Motorcycles ×2", "Drone ×1"], coverage: "Quezon City East" },
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
  return { FIRE: "#c2440a", AMB: "#1565c0", POL: "#5e35b1" }[t];
}

export function priorityColor(p: IncidentPriority) {
  return { CRITICAL: "#c62828", HIGH: "#c2440a", MEDIUM: "#c77700", LOW: "#2e7d32" }[p];
}

export const UNIT_TYPE_ICON: Record<UnitType, string> = { FIRE: "🔥", AMB: "🚑", POL: "🚔" };
export const CATEGORY_ICON: Record<string, string> = { FIRE: "🔥", AMB: "🚑", POL: "🚔", Other: "⚠️" };
