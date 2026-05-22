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

export interface ApprovalDocument {
  label: string;
  bucket: string;
  objectPath: string;
  uploadedAt: string | null;
  verificationStatus: "uploaded" | "missing";
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
  documents?: ApprovalDocument[];
  /** @deprecated use documents[0].objectPath instead */
  governmentIdKey?: string | null;
  profile_photo_key?: string | null;
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

interface GovernmentIdUploadUrlPayload {
  bucket: string;
  objectPath: string;
  signedUrl: string;
  token: string;
  path: string;
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

type ApiRequestInit = RequestInit & {
  suppressErrorLog?: boolean;
};

async function request<T>(
  path: string,
  init: ApiRequestInit = {},
  token?: string,
): Promise<T> {
  const { suppressErrorLog = false, ...requestInit } = init;
  const headers = new Headers(requestInit.headers ?? {});

  if (!headers.has("Content-Type") && requestInit.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    const normalizedToken = token.replace(/^Bearer\s+/i, "").trim();
    headers.set("Authorization", `Bearer ${normalizedToken}`);
  }

  let response: Response;
  try {
    console.log(`[Api] Requesting ${path}`, { method: requestInit.method || 'GET' });
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
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
    
    if (response.status >= 500 && !suppressErrorLog) {
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
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  profilePhotoKey?: string;
  governmentIdKey?: string;
  governmentIdFileName?: string;
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

export async function createGovernmentIdUploadUrl(payload: {
  fileName: string;
  applicantRole: string;
  applicantEmail: string;
}) {
  return request<GovernmentIdUploadUrlPayload>("/auth/uploads/government-id", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadGovernmentIdForSignup(payload: {
  file: File;
  applicantRole: string;
  applicantEmail: string;
}) {
  const uploadUrl = await createGovernmentIdUploadUrl({
    fileName: payload.file.name,
    applicantRole: payload.applicantRole,
    applicantEmail: payload.applicantEmail,
  });

  const uploadResponse = await fetch(uploadUrl.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": payload.file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: payload.file,
  });

  if (!uploadResponse.ok) {
    throw new ApiError("Unable to upload Government ID file.", uploadResponse.status);
  }

  return {
    bucket: uploadUrl.bucket,
    objectPath: uploadUrl.objectPath,
  };
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
    password?: string;
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

export interface GeoAddressResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  provider: string;
}

export interface AfterActionAssessment {
  id: string;
  disasterId: string;
  infraStatus: string;
  estimatedCost: number;
  reliefNeeded: number;
  durationDays: number;
  shelterRating: number;
  successNotes: string;
  bottlenecks: string;
  submittedBy?: string | null;
  submittedAt?: string;
  updatedAt?: string;
}

export async function geocodeAddress(token: string, address: string): Promise<GeoAddressResult> {
  return request<GeoAddressResult>(
    `/site-manager/geo/geocode?address=${encodeURIComponent(address)}`,
    { suppressErrorLog: true },
    token,
  );
}

export async function reverseGeocodeNominatim(latitude: number, longitude: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as { display_name?: string; name?: string };
    return data.display_name ?? data.name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  } catch {
    clearTimeout(timeout);
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
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

export type RegionPhaseState = "BEFORE" | "DURING" | "AFTER";

export async function getRegionPersonaPhaseControls(token: string, regionId: string) {
  return request<Array<{
    id: string;
    regionId: string;
    personaRole: AppRole;
    phase: RegionPhaseState;
    visibleToAssignedUsers: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>>(`/admin/regions/${regionId}/persona-phase-controls`, {}, token);
}

export async function getRegions(token: string) {
  return request<Array<{ id: string; name: string; currentPhase: string }>>(`/admin/regions`, {}, token);
}

export async function createRegion(
  token: string,
  payload: {
    name: string;
    centerLat: number;
    centerLng: number;
    spanDegrees?: number;
    radiusKm?: number;
    currentPhase?: "beforecalamity" | "duringcalamity" | "aftercalamity";
  },
) {
  return request<{ id: string; name: string; currentPhase: string }>("/admin/regions", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function getRegionsGeo(token: string) {
  return request<Array<{ id: string; name: string; geojson: any }>>(`/admin/regions/geo`, {}, token);
}

export async function getRegionShelters(token: string, regionId: string) {
  return request<Array<{ id: string; name: string; lat: number; lng: number }>>(`/admin/regions/${regionId}/shelters`, {}, token);
}

export async function upsertRegionPersonaPhaseControl(
  token: string,
  regionId: string,
  payload: {
    personaRole: AppRole;
    phase: RegionPhaseState;
    visibleToAssignedUsers?: boolean;
  },
) {
  return request<{
    region: { id: string; name: string };
    control: {
      id: string;
      regionId: string;
      personaRole: AppRole;
      phase: RegionPhaseState;
      visibleToAssignedUsers: boolean;
      createdAt?: string | null;
      updatedAt?: string | null;
    };
    audience: Array<{ authUserId: string; name: string; role: AppRole; assignedRegionId: string | null }>;
  }>(`/admin/regions/${regionId}/persona-phase-controls`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function getRegionPersonaPhaseAudience(
  token: string,
  regionId: string,
  personaRole?: AppRole,
) {
  const suffix = personaRole ? `?personaRole=${encodeURIComponent(personaRole)}` : "";
  return request<Array<{ authUserId: string; name: string; role: AppRole; assignedRegionId: string | null }>>(
    `/admin/regions/${regionId}/persona-phase-controls/audience${suffix}`,
    {},
    token,
  );
}

export async function getRegionAssignments(token: string, regionId: string) {
  return request<Array<{
    id: string;
    regionId: string;
    authUserId: string;
    name: string;
    role: string;
    assignedAt?: string;
    assignedBy?: string | null;
    expiresAt?: string | null;
  }>>(`/admin/regions/${regionId}/assignments`, {}, token);
}

export async function createRegionAssignment(
  token: string,
  regionId: string,
  payload: { authUserId: string; role: string; expiresAt?: string | null },
) {
  return request<any>(`/admin/regions/${regionId}/assignments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export async function deleteRegionAssignment(token: string, regionId: string, assignmentId: string) {
  return request<any>(`/admin/regions/${regionId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  }, token);
}

export async function getAvailableRegionUsers(token: string, regionId: string, role?: string, search?: string) {
  const qsParts: string[] = [];
  if (role) qsParts.push(`role=${encodeURIComponent(role)}`);
  if (search) qsParts.push(`search=${encodeURIComponent(search)}`);
  const qs = qsParts.length ? `?${qsParts.join('&')}` : '';
  return request<Array<{ authUserId: string; name: string; role: string; assignedRegionId?: string }>>(`/admin/regions/${regionId}/available-users${qs}`, {}, token);
}

export async function getRecentCheckIns(token: string, limit = 8) {
  return request<CheckInRecord[]>(`/site-manager/check-ins/recent?limit=${limit}`, {}, token);
}

export async function getIncidentReports(token: string) {
  return request<IncidentReport[]>("/site-manager/incident-reports", {}, token);
}

export async function getLatestAfterActionAssessment(token: string, disasterId?: string) {
  const suffix = disasterId
    ? `?disasterId=${encodeURIComponent(disasterId)}`
    : "";
  return request<AfterActionAssessment | null>(
    `/site-manager/after-action-assessment/latest${suffix}`,
    {},
    token,
  );
}

export async function upsertAfterActionAssessment(
  token: string,
  payload: {
    disasterId: string;
    infraStatus: string;
    estimatedCost: number;
    reliefNeeded: number;
    durationDays: number;
    shelterRating: number;
    successNotes: string;
    bottlenecks: string;
    submittedBy?: string;
  },
) {
  return request<AfterActionAssessment>("/site-manager/after-action-assessment", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function getDispatcherIncidents(token: string) {
  return request<IncidentReport[]>("/dispatcher/incident-reports", {}, token);
}

export async function getDispatcherVolunteers(token: string, search?: string) {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return request<Organization[]>(`/dispatcher/volunteers${qs}`, {}, token);
}

export async function getDispatcherDispatchOrders(token: string) {
  return request<Array<{
    id: string;
    reportId: string;
    operationId: string;
    assignedTo: string;
    priority: string;
    instructions?: string;
    status: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }>>("/dispatcher/dispatch-orders", {}, token);
}

export async function createDispatcherDispatchOrder(
  token: string,
  payload: {
    reportId: string;
    operationId: string;
    assignedTo: string;
    priority?: string;
    instructions?: string;
    status?: string;
    disasterId?: string;
  },
) {
  return request<{ id: string }>("/dispatcher/dispatch-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
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

export async function checkOutById(token: string, id: string) {
  return request<CheckInRecord>(`/site-manager/check-ins/${id}/checkout`, {
    method: "PATCH",
  }, token);
}

export async function getCheckInByQrCode(token: string, qrCodeId: string): Promise<CheckInRecord | null> {
  const all = await request<CheckInRecord[]>("/site-manager/check-ins", {}, token);
  return all.find(
    (r) => (r.qrCode === qrCodeId || r.evacueeId === qrCodeId || r.evacueeNumber === qrCodeId) && r.status === "checked-in"
  ) ?? null;
}

export async function getCitizenByQrCode(token: string, qrCodeId: string) {
  const results = await request<Array<{
    id: string;
    userId?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    registrationType?: string;
    qrCodeId?: string;
    familySize?: number;
    createdAt: string;
  }>>(`/site-manager/citizens?search=${encodeURIComponent(qrCodeId)}`, {}, token);
  return results.find((c) => c.qrCodeId === qrCodeId) ?? null;
}

export interface SiteManagerCitizenRecord {
  id: string;
  userId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  registrationType?: string;
  qrCodeId?: string;
  familySize?: number;
  createdAt?: string;
}

export async function getSiteManagerCitizens(token: string, search?: string) {
  const qs = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  return request<SiteManagerCitizenRecord[]>(`/site-manager/citizens${qs}`, {}, token);
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
    name?: string;
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

export async function getAdminIncidentReports(
  token: string,
  disasterId?: string,
) {
  const qs = disasterId
    ? `?disasterId=${encodeURIComponent(disasterId)}`
    : "";
  return request<Array<{ id: string; disasterId?: string; status?: string }>>(
    `/admin/incident-reports${qs}`,
    {},
    token,
  );
}

export async function createAdminReliefOperation(
  token: string,
  payload: {
    disasterId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    leadAgencyId?: string;
    leadOfficerId: string;
    status?: string;
  },
) {
  return request<{ id: string }>("/admin/relief-operations", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function createAdminDispatchOrder(
  token: string,
  payload: {
    reportId: string;
    operationId: string;
    assignedTo: string;
    priority?: string;
    instructions?: string;
    status?: string;
  },
) {
  return request<{ id: string }>("/admin/dispatch-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function createAdminObjectViewUrl(
  token: string,
  payload: {
    bucket: string;
    objectPath: string;
    expiresIn?: number;
  },
) {
  return request<{ signedUrl: string }>("/admin/uploads/view-url", {
    method: "POST",
    body: JSON.stringify(payload),
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
