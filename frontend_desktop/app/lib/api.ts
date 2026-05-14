import type {
  AppRole,
  AuthSession,
  CapacityCenter,
  CheckInRecord,
  DashboardOverview,
  DisasterEvent,
  IncidentReport,
  InventoryItem,
  Organization,
} from "./types";

export interface AdminDisasterEventWithTickets extends DisasterEvent {
  ticketCount?: number;
}

export interface AdminDisasterEventsPayload {
  disasterEvents: AdminDisasterEventWithTickets[];
  aggregate?: {
    totalDisasters?: number;
    activeDisasters?: number;
    totalTickets?: number;
  };
}

export interface AdminApprovalRecord {
  id: string;
  authUserId?: string;
  auth_user_id?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  rejectReason?: string | null;
  reject_reason?: string | null;
  createdAt?: string;
  created_at?: string;
}

export interface AdminSystemHealthRecord {
  name: string;
  status: "OPERATIONAL" | "DEGRADED" | "DOWN";
  latencyMs?: number;
  latency?: string;
  uptime?: string;
  note?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    const normalizedToken = token.replace(/^Bearer\s+/i, "").trim();
    headers.set("Authorization", `Bearer ${normalizedToken}`);
  }

  let response: Response;
  try {
    console.log(`[Api] Requesting ${path}`, { method: init.method || 'GET' });
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      `Cannot connect to backend API at ${API_BASE_URL}. Start backend services and try again.`,
      0,
    );
  }

  const text = await response.text();
  console.log(`[Api] Response for ${path}: status=${response.status}`);
  
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error(`[Api] Failed to parse JSON response from ${path}:`, text);
    payload = { message: text || "Invalid server response" };
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? (Array.isArray(payload.message) ? payload.message.join(", ") : String(payload.message))
        : `Request failed with status ${response.status}`;
    
    if (response.status >= 500) {
      console.error(`[Api] Error ${response.status}: ${message}`);
    } else {
      console.warn(`[Api] Warning ${response.status}: ${message}`);
    }
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
  requiredRole?: AppRole;
}) {
  return request<{
    access_token: string;
    expiresIn?: string;
    user: AuthSession["user"];
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signup(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role?: string;
  registrationType?: string;
  birthDate?: string;
  gender?: string;
  bloodType?: string;
  medicalConditions?: string;
  familyMembers?: any[];
}) {
  return request<{
    access_token: string;
    user: AuthSession["user"];
  }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(payload: {
  contact: string;
  method?: "email" | "sms";
}) {
  return request<{
    message: string;
    maskedContact: string;
    debugVerificationCode?: string;
  }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: {
  contact: string;
  code: string;
  newPassword: string;
}) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProfile(token: string) {
  return request<{ user: AuthSession["user"] }>("/auth/me", {}, token);
}

export async function updateProfile(
  token: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  },
) {
  return request<{ user: AuthSession["user"] }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, token);
}

export async function getDashboard(
  scope: "admin" | "site-manager",
  token: string,
) {
  const prefix = scope === "admin" ? "/admin" : "/site-manager";
  return request<DashboardOverview>(`${prefix}/dashboard`, {}, token);
}

export async function getInventory(
  scope: "admin" | "site-manager",
  token: string,
) {
  const prefix = scope === "admin" ? "/admin" : "/site-manager";
  return request<InventoryItem[]>(`${prefix}/inventory`, {}, token);
}

export async function getCapacity(token: string) {
  return request<CapacityCenter[]>("/site-manager/capacity", {}, token);
}

export async function getDisasterEvents(
  scope: "admin" | "site-manager",
  token: string,
) {
  const prefix = scope === "admin" ? "/admin" : "/site-manager";
  return request<DisasterEvent[] | AdminDisasterEventsPayload>(`${prefix}/disaster-events`, {}, token);
}

export async function updateAdminDisasterEvent(
  token: string,
  id: string,
  payload: Partial<{
    name: string;
    type: string;
    severityLevel: string;
    affectedAreas: string[];
    province: string;
    dateStarted: string;
    dateEnded: string;
    status: string;
    declaredBy: string;
    coverImageKey: string;
    notes: string;
  }>,
) {
  return request<DisasterEvent>(`/admin/disaster-events/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function getOrganizations(token: string) {
  return request<Organization[]>("/admin/organizations", {}, token);
}

export async function getRecentCheckIns(token: string, limit = 8) {
  return request<CheckInRecord[]>(`/site-manager/check-ins/recent?limit=${limit}`, {}, token);
}

export async function getIncidentReports(token: string) {
  return request<IncidentReport[]>("/site-manager/incident-reports", {}, token);
}

export async function getDispatcherIncidents(token: string) {
  return request<IncidentReport[]>("/dispatcher/incident-reports", {}, token);
}

export async function createManualCheckIn(
  token: string,
  payload: {
    evacueeNumber: string;
    firstName?: string;
    lastName?: string;
    zone?: string;
    location?: string;
    familySize?: number;
  },
) {
  return request<CheckInRecord>("/site-manager/check-ins/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function updateIncidentReport(
  token: string,
  id: string,
  payload: Partial<{
    disasterId: string;
    reportedBy: string;
    title: string;
    content: string;
    severity: string;
    location: string;
    status: string;
  }>,
) {
  // Use dispatcher prefix for dispatcher operations
  return request<IncidentReport>(`/dispatcher/incident-reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, token);
}

export async function createIncidentReport(
  token: string,
  payload: {
    disasterId: string;
    reportedBy: string;
    title: string;
    content: string;
    severity: string;
    location: string;
  },
) {
  return request<IncidentReport>("/site-manager/incident-reports", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function adjustInventoryItem(
  token: string,
  itemId: string,
  adjustment: number,
) {
  return request<InventoryItem>(`/site-manager/inventory/${itemId}/adjust`, {
    method: "PATCH",
    body: JSON.stringify({ adjustment }),
  }, token);
}

export async function receiveInventory(
  token: string,
  payload: {
    itemIds: string[];
    quantities: number[];
    arrivalTerminal?: string;
    waybillNumber?: string;
    condition: string;
  },
) {
  return request<any>("/site-manager/inventory/receive", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function closeOperations(token: string) {
  return request<any>("/site-manager/operations/close", {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export async function generateSiteReport(token: string) {
  return request<any>("/site-manager/reports/summary", {
    method: "POST",
    body: JSON.stringify({}),
  }, token);
}

export async function createInventoryBatch(
  token: string,
  payload: {
    name: string;
    items: Array<{ itemId: string; quantity: number }>;
  },
) {
  return request<any>("/site-manager/inventory/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function getCitizens(token: string) {
  return request<{
    id: string;
    userId?: string;
    user_id?: string;
    fullName?: string;
    full_name?: string;
    registrationType?: string;
    registration_type?: string;
    qrCodeId?: string;
    qr_code_id?: string;
    createdAt?: string | Date;
    created_at?: string | Date;
    barangay?: string;
    municipality?: string;
  }[]>("/admin/citizens", {}, token);
}

export async function getFamilies(token: string) {
  return request<{
    id: string;
    qrCodeId?: string;
    qr_code_id?: string;
    headFullName?: string;
    head_full_name?: string;
    members?: { id: string; name: string }[];
    family_member_count?: number;
    createdAt?: string | Date;
    created_at?: string | Date;
    barangay?: string;
    municipality?: string;
  }[]>("/admin/families", {}, token);
}

export async function getPendingApprovals(token: string) {
  return request<AdminApprovalRecord[]>("/admin/approvals", {}, token);
}

export async function approvePendingUser(token: string, id: string) {
  return request<AdminApprovalRecord>(`/admin/approvals/${id}/approve`, {
    method: "PATCH",
  }, token);
}

export async function rejectPendingUser(token: string, id: string, rejectReason: string) {
  return request<AdminApprovalRecord>(`/admin/approvals/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ rejectReason }),
  }, token);
}

export async function getSystemHealth(token: string) {
  return request<AdminSystemHealthRecord[]>("/admin/system-health", {}, token);
}

export async function broadcastAdminWarning(
  token: string,
  payload: {
    type: string;
    severity: string;
    areas: string[];
    message: string;
    useSMS: boolean;
    usePush: boolean;
  },
) {
  return request<{
    type: string;
    severity: string;
    areas: string[];
    attempted: number;
    delivered: number;
    failed: number;
    channels: { sms: boolean; push: boolean };
  }>("/admin/warnings/broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function getCitizenProfile(token: string) {
  return request<any>("/citizen/profile", {
    method: "GET",
  }, token);
}

export async function registerCitizen(token: string, payload: {
  fullName: string;
  birthDate: string;
  gender: string;
  bloodType: string;
  medicalConditions: string;
  registrationType: "Individual" | "Household";
  qrCodeId: string;
}) {
  return request<any>("/citizen/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function addFamilyMember(token: string, payload: {
  qrCodeId: string;
  headFullName: string;
  familyMemberName: string;
  relationship: string;
  age: number;
  accessibilityNeeds: string;
  familyMemberCount: number;
}) {
  return request<any>("/citizen/family", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function addAnimal(token: string, payload: {
  name: string;
  species: string;
  needsCage: boolean;
  qrCodeId?: string;
}) {
  return request<any>("/citizen/animal", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function clearFamilyMembers(token: string, qrCodeId: string) {
  return request<any>(`/citizen/family/${qrCodeId}`, {
    method: "DELETE",
  }, token);
}

export async function clearAnimals(token: string) {
  return request<any>("/citizen/animal", {
    method: "DELETE",
  }, token);
}

export async function getFamilyMembers(token: string) {
  return request<any[]>("/citizen/family", {
    method: "GET",
  }, token);
}

export async function getAnimals(token: string) {
  return request<any[]>("/citizen/animals", {
    method: "GET",
  }, token);
}

export async function submitIncidentReport(token: string, payload: {
  title: string;
  content: string;
  severity: string;
  location: string;
  attachmentKeys?: string[];
  disasterId?: string;
}) {
  return request<any>("/citizen/incident-report", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}