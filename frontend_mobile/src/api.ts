import type {
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

export interface AdminWarningBroadcastPayload {
  type: string;
  severity: string;
  areas: string[];
  message: string;
  useSMS: boolean;
  usePush: boolean;
}

export interface AdminWarningBroadcastResult {
  type: string;
  severity: string;
  areas: string[];
  attempted: number;
  delivered: number;
  failed: number;
  channels: {
    sms: boolean;
    push: boolean;
  };
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers ?? {});

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: string }).message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
  requiredRole?: string;
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
}) {
  return request<{
    access_token: string;
    user: AuthSession["user"];
  }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDashboard(scope: "admin" | "site-manager", token: string) {
  const prefix = scope === "admin" ? "/admin" : "/site-manager";
  return request<DashboardOverview>(`${prefix}/dashboard`, {}, token);
}

export async function getDisasterEvents(scope: "admin" | "site-manager", token: string) {
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

export async function getInventory(scope: "admin" | "site-manager", token: string) {
  const prefix = scope === "admin" ? "/admin" : "/site-manager";
  return request<InventoryItem[]>(`${prefix}/inventory`, {}, token);
}

export async function getCapacity(token: string) {
  return request<CapacityCenter[]>("/site-manager/capacity", {}, token);
}

export async function getRecentCheckIns(token: string, limit = 6) {
  return request<CheckInRecord[]>(`/site-manager/check-ins/recent?limit=${limit}`, {}, token);
}

export async function getIncidentReports(token: string) {
  return request<IncidentReport[]>("/site-manager/incident-reports", {}, token);
}

export async function createManualCheckIn(
  token: string,
  payload: {
    evacueeNumber: string;
    firstName?: string;
    lastName?: string;
    zone?: string;
    location?: string;
    centerId?: string;
    familySize?: number;
  },
) {
  return request<CheckInRecord>("/site-manager/check-ins/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function scanCheckIn(
  token: string,
  payload: {
    qrCode: string;
  },
) {
  return request<CheckInRecord>("/site-manager/check-ins/scan", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function checkOutById(token: string, id: string) {
  return request<CheckInRecord>(`/site-manager/check-ins/${id}/checkout`, {
    method: "PATCH",
  }, token);
}

export async function getCheckInByQrCode(
  token: string,
  qrCodeId: string,
): Promise<CheckInRecord | null> {
  const all = await request<CheckInRecord[]>("/site-manager/check-ins", {}, token);
  const match = all.find(
    (r) => (r.evacueeId === qrCodeId || r.evacueeNumber === qrCodeId || r.qrCode === qrCodeId) && r.status === "checked-in"
  );
  return match ?? null;
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

export async function getProfile(token: string) {
  return request<{ user: AuthSession["user"] }>("/auth/me", {}, token);
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
  payload: AdminWarningBroadcastPayload,
) {
  return request<AdminWarningBroadcastResult>("/admin/warnings/broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE to your existing frontend_mobile/src/api.ts
// They use the existing `request` helper and API_BASE_URL already in that file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a single citizen's full profile by their qr_code_id.
 * Uses the existing /site-manager/citizens?search= endpoint.
 * Returns the first match (qr_code_id values are unique in register_citizens).
 */
export async function getCitizenByQrCode(
  token: string,
  qrCodeId: string,
) {
  const results = await request<Array<{
    id: string;
    userId: string;
    fullName?: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate?: string;
    gender?: string;
    registrationType?: string;
    qrCodeId?: string;
    familyId?: string;
    bloodType?: string;
    medicalConditions?: string;
    createdAt: string;
  }>>(`/site-manager/citizens?search=${encodeURIComponent(qrCodeId)}`, {}, token);

  // search is broad — narrow down to exact qr_code_id match
  return results.find((c) => c.qrCodeId === qrCodeId) ?? null;
}

/**
 * Register a new citizen with a pre-generated QR code ID.
 * qrCodeId should be generated by generateQrCodeId() from qr-utils.ts.
 */
// ─── In-app notifications ──────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export async function getNotifications(token: string): Promise<AppNotification[]> {
  return request<AppNotification[]>("/notifications", {}, token);
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const result = await request<{ count: number }>("/notifications/unread-count", {}, token);
  return result.count;
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }, token);
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await request<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" }, token);
}

export async function registerCitizenWithQR(
  token: string,
  payload: {
    userId: string;         // auth.users UUID — must already exist
    fullName: string;
    qrCodeId: string;       // from generateQrCodeId()
    registrationType: "Individual" | "Family";
    birthDate?: string;     // YYYY-MM-DD
    gender?: string;
    bloodType?: string;
    medicalConditions?: string;
    familyId?: string;
  },
) {
  return request<{ qrCodeId: string }>("/site-manager/citizens", {
    method: "POST",
    body: JSON.stringify({
      userId:            payload.userId,
      fullName:          payload.fullName,
      qrCodeId:          payload.qrCodeId,
      registrationType:  payload.registrationType,
      birthDate:         payload.birthDate     ?? null,
      gender:            payload.gender        ?? null,
      bloodType:         payload.bloodType     ?? null,
      medicalConditions: payload.medicalConditions ?? null,
      familyId:          payload.familyId      ?? null,
    }),
  }, token);
}