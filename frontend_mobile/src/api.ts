import type {
  AuthSession,
  CapacityCenter,
  CheckInRecord,
  DashboardOverview,
  DisasterEvent,
  IncidentReport,
  InventoryItem,
} from "./types";

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

export async function forgotPassword(payload: {
  contact?: string;
  method?: "EMAIL" | "SMS";
  email?: string;
  phone?: string;
}) {
  return request<any>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signup(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
  governmentIdKey?: string;
  governmentIdFileName?: string;
  gender?: string;
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
}) {
  return request<{
    access_token: string;
    user: AuthSession["user"];
  }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGovernmentIdUploadUrl(params: {
  applicantRole: string;
  applicantEmail: string;
  fileName: string;
}) {
  return request<{
    bucket: string;
    objectPath: string;
    signedUrl: string;
    token: string;
    path: string;
  }>("/auth/uploads/government-id", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getIncidentPhotoUploadUrl(token: string, fileName: string) {
  return request<{
    bucket: string;
    objectPath: string;
    signedUrl: string;
    token: string;
    path: string;
  }>("/auth/uploads/incident-photo", {
    method: "POST",
    body: JSON.stringify({ fileName }),
  }, token);
}

export async function getProfilePhotoUploadUrl(token: string, fileName: string) {
  return request<{
    bucket: string;
    objectPath: string;
    signedUrl: string;
    token: string;
    path: string;
  }>("/auth/uploads/profile-photo", {
    method: "POST",
    body: JSON.stringify({ fileName }),
  }, token);
}

export async function updateProfile(
  token: string,
  updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePhotoKey?: string;
    gender?: string;
    address?: string;
    barangay?: string;
    municipality?: string;
    province?: string;
  },
) {
  return request<{ user: AuthSession["user"] }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  }, token);
}

export async function updateMedical(
  token: string,
  updates: { bloodType?: string; medicalConditions?: string },
) {
  return request<any>("/citizen/medical", {
    method: "PATCH",
    body: JSON.stringify(updates),
  }, token);
}

export async function getDashboard(scope: "site-manager", token: string) {
  return request<DashboardOverview>("/site-manager/dashboard", {}, token);
}

export async function getDisasterEvents(scope: "site-manager", token: string) {
  return request<DisasterEvent[]>("/site-manager/disaster-events", {}, token);
}

export async function getInventory(scope: "site-manager", token: string) {
  return request<InventoryItem[]>("/site-manager/inventory", {}, token);
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
    (r: any) => (r.evacueeId === qrCodeId || r.evacueeNumber === qrCodeId || r.qrCodeId === qrCodeId) && r.status === "checked-in"
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

export async function deleteFamilyMember(token: string, id: string) {
  return request<any>(`/citizen/family/member/${id}`, {
    method: "DELETE",
  }, token);
}

export async function updateFamilyMember(token: string, id: string, payload: {
  qrCodeId?: string;
  headFullName?: string;
  familyMemberName?: string;
  relationship?: string;
  age?: number;
  accessibilityNeeds?: string;
  familyMemberCount?: number;
}) {
  return request<any>(`/citizen/family/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
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

export interface CitizenProfile {
  id?: string;
  userId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  bloodType?: string;
  medicalConditions?: string;
  registrationType?: string;
  qrCodeId?: string;
  familyId?: string;
  phone?: string;
  profilePhotoKey?: string;
  createdAt?: string;
}

export async function getCitizenProfile(token: string): Promise<CitizenProfile> {
  return request<CitizenProfile>("/citizen/profile", {}, token);
}

export async function getFileViewUrl(
  token: string,
  bucket: string,
  objectPath: string,
  expiresIn = 3600,
): Promise<string> {
  const result = await request<{ signedUrl: string }>("/auth/uploads/view-url", {
    method: "POST",
    body: JSON.stringify({ bucket, objectPath, expiresIn }),
  }, token);
  return result.signedUrl;
}

// ─── Family Group API ─────────────────────────────────────────────────────────

export interface FamilyGroupMember {
  id: string;
  citizenQrCodeId: string;
  memberUserId?: string;
  memberFullName?: string;
  relationship?: string;
  addedAt: string;
}

export interface FamilyGroup {
  id: string;
  familyQrCodeId: string;
  headUserId: string;
  familyName?: string;
  members: FamilyGroupMember[];
  createdAt: string;
}

export async function getFamilyGroup(token: string): Promise<FamilyGroup | null> {
  try {
    return await request<FamilyGroup>("/citizen/family-group", {}, token);
  } catch {
    return null;
  }
}

export async function createFamilyGroup(token: string, familyName?: string): Promise<FamilyGroup> {
  return request<FamilyGroup>("/citizen/family-group", {
    method: "POST",
    body: JSON.stringify({ familyName }),
  }, token);
}

export async function addFamilyGroupMember(
  token: string,
  payload: { citizenQrCodeId: string; relationship?: string },
): Promise<FamilyGroupMember> {
  return request<FamilyGroupMember>("/citizen/family-group/members", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function removeFamilyGroupMember(token: string, qrCodeId: string): Promise<void> {
  await request<{ ok: boolean }>(`/citizen/family-group/members/${encodeURIComponent(qrCodeId)}`, {
    method: "DELETE",
  }, token);
}

export async function deleteFamilyGroup(token: string): Promise<void> {
  await request<{ ok: boolean }>("/citizen/family-group", { method: "DELETE" }, token);
}

/** Look up a citizen by their individual QR code — used when scanning to preview info before adding. */
export async function lookupCitizenByQr(
  token: string,
  qrCode: string,
): Promise<{ fullName?: string; qrCodeId?: string; userId?: string } | null> {
  try {
    return await request<{ fullName?: string; qrCodeId?: string; userId?: string }>(
      `/citizen/lookup-citizen?qrCode=${encodeURIComponent(qrCode)}`,
      {},
      token,
    );
  } catch {
    return null;
  }
}