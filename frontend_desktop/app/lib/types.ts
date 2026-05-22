export enum AppRole {
  ADMIN = "admin",
  DISPATCHER = "dispatcher",
  LINE_MANAGER = "line_manager",
  CITIZEN = "citizen",
}

export interface AuthUser {
  id: string;
  authUserId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  accountStatus?: "pending" | "active" | "rejected";
  gender?: string | null;
  address?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
}

export interface AuthSession {
  accessToken: string;
  expiresIn?: string;
  user: AuthUser;
}

export interface DashboardOverview {
  scope: "admin" | "site-manager";
  generatedAt: string;
  inventory: {
    totalItems: number;
    lowStockItems: number;
    totalCategories: number;
    itemCount: number;
  };
  capacity: {
    totalCenters: number;
    totalCapacity: number;
    totalOccupancy: number;
    availableSlots: number;
    fullCenters: number;
    highUtilizationCenters: number;
  };
  checkIns: {
    totalCheckedIn: number;
    totalCheckedOut: number;
    total: number;
    byZone: Record<string, number>;
    byLocation: Record<string, number>;
  };
  organizations: {
    totalOrganizations: number;
    verifiedOrganizations: number;
    organizationTypes: number;
  };
  disasterEvents: {
    totalEvents: number;
    activeEvents: number;
    severeEvents: number;
  };
  dispatchOrders: Record<string, number>;
  reliefOperations: Record<string, number>;
  incidentReports: {
    totalReports: number;
    pendingReports: number;
    highSeverityReports: number;
  };
  distributions: Record<string, number>;
  registrations: Record<string, number>;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  source?: string;
}

export interface CapacityCenter {
  id: string;
  name: string;
  address: string;
  municipality: string;
  barangay: string;
  capacity: number;
  currentOccupancy: number;
  availableSlots: number;
  utilizationRate: number;
  status: string;
}

export interface DisasterEvent {
  id: string;
  name: string;
  type: string;
  severityLevel: string;
  affectedAreas: string[];
  province: string;
  dateStarted: string;
  dateEnded?: string;
  status: string;
  notes?: string;
}

export interface CheckInRecord {
  id: string;
  evacueeId: string;
  evacueeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  zone: string;
  location: string;
  status: string;
  checkInTime?: string;
  qrCode?: string;
}

export interface IncidentReport {
  id: string;
  disasterId: string;
  reportedBy: string;
  title: string;
  content: string;
  severity: string;
  location: string;
  status: string;
  attachmentKeys: string[];
  createdAt: string;
}

export interface DispatchOrder {
  id: string;
  disasterId?: string;
  reportId: string;
  operationId: string;
  assignedTo: string;
  priority: string;
  instructions?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DispatcherProfile {
  id: string;
  authUserId: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  badge: string;
  rank: string;
  cluster: string;
  station: string;
  initials: string;
  joinedDate: string;
  totalDispatches: number;
  resolvedToday: number;
}

export interface DispatcherVolunteerUnit {
  id: string;
  type: "FIRE" | "AMB" | "POL";
  name: string;
  station: string;
  status: "Available" | "On Route" | "On Scene" | "Offline";
  lat: number;
  lng: number;
  personnel: number;
  distance: string;
  eta: string;
  teamLeader: string;
  contact: string;
  plateNumber: string;
  lastActive: string;
}

export interface DispatcherVolunteerTeam {
  id: string;
  type: "FIRE" | "AMB" | "POL";
  name: string;
  station: string;
  status: "Ready" | "Deployed" | "Standby" | "Offline";
  leader: string;
  contact: string;
  members: number;
  vehicles: number;
  coverage: string;
  equipment: string[];
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  verified: boolean;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  createdAt?: string;
}

export interface DispatcherOverview {
  generatedAt: string;
  incidentReports: IncidentReport[];
  dispatchOrders: DispatchOrder[];
  organizations: Organization[];
  disasterEvents: DisasterEvent[];
  volunteerUnits: DispatcherVolunteerUnit[];
  volunteerTeams?: DispatcherVolunteerTeam[];
  reliefOperations: Array<{
    id: string;
    disasterId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    leadAgencyId?: string;
    leadOfficerId: string;
    status: string;
    createdAt: string;
  }>;
}
