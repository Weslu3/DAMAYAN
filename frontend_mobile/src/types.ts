export enum AppRole {
  ADMIN = "admin",
  DISPATCHER = "dispatcher",
  LINE_MANAGER = "line_manager",
  CITIZEN = "citizen",
}

export interface AuthUser {
  id: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
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

export interface Organization {
  id: string;
  name: string;
  type: string;
  verified: boolean;
  contactEmail?: string;
  contactPhone?: string;
}

export type PortalRole = "admin" | "dispatcher" | "site_manager" | "citizen";

export type AppRoute =
  | "role-selector"
  | "admin-login"
  | "admin-dashboard"
  | "dispatcher-login"
  | "dispatcher-before"
  | "dispatcher-during"
  | "site-manager-login"
  | "site-manager-signup"
  | "site-manager-before"
  | "site-manager-during"
  | "site-manager-dashboard"
  | "citizen-login"
  | "citizen-signup"
  | "citizen-dashboard"
  | "citizen-before"
  | "citizen-before-self"
  | "citizen-before-household"
  | "citizen-before-household-members"
  | "citizen-during"
  | "citizen-after";
