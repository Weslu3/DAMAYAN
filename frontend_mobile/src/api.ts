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
  return request<DisasterEvent[]>(`${prefix}/disaster-events`, {}, token);
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
  },
) {
  return request<CheckInRecord>("/site-manager/check-ins/manual", {
    method: "POST",
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

export async function getProfile(token: string) {
  return request<{ user: AuthSession["user"] }>("/auth/me", {}, token);
}