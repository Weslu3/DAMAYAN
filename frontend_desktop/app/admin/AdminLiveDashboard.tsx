"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  hasRole,
  loadSession,
  saveSession,
} from "../lib/session";
import {
  ApiError,
  getDashboard,
  getDisasterEvents,
  getInventory,
  getOrganizations,
  getProfile,
} from "../lib/api";
import { AppRole } from "../lib/types";
import type {
  AuthSession,
  DashboardOverview,
  DisasterEvent,
  InventoryItem,
  Organization,
} from "../lib/types";

function cardStyle(accent: string): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid rgba(20, 33, 61, 0.08)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
    borderTop: `4px solid ${accent}`,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function AdminLiveDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();

    if (!hasRole(stored, AppRole.ADMIN)) {
      clearSession();
      router.replace("/login");
      return;
    }

    setSession(stored);

    async function hydrate(activeSession: AuthSession) {
      try {
        const [profile, dashboard, eventList, inventoryItems, orgs] = await Promise.all([
          getProfile(activeSession.accessToken),
          getDashboard("admin", activeSession.accessToken),
          getDisasterEvents("admin", activeSession.accessToken),
          getInventory("admin", activeSession.accessToken),
          getOrganizations(activeSession.accessToken),
        ]);

        const nextSession = {
          ...activeSession,
          user: profile.user,
        };

        saveSession(nextSession);
        setSession(nextSession);
        setOverview(dashboard);
        setDisasters(Array.isArray(eventList) ? eventList : eventList.disasterEvents);
        setInventory(inventoryItems);
        setOrganizations(orgs);
        setError(null);
      } catch (caughtError) {
        if (caughtError instanceof ApiError && caughtError.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }

        const nextMessage =
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load the admin dashboard.";
        setError(nextMessage);
      } finally {
        setLoading(false);
      }
    }

    void hydrate(stored);
  }, [router]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f8fb" }}>
        <p style={{ color: "#334155", fontSize: 18 }}>Loading admin control plane...</p>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const topInventory = inventory.slice(0, 4);
  const liveChecks = [
    {
      name: "Gateway + Auth",
      detail: error ? error : "Session token verified and profile loaded.",
      status: error ? "Needs attention" : "Operational",
      accent: error ? "#dc2626" : "#16a34a",
    },
    {
      name: "Operations Dashboard",
      detail: overview
        ? `Generated ${new Date(overview.generatedAt).toLocaleTimeString("en-PH")}`
        : "Dashboard feed unavailable.",
      status: overview ? "Operational" : "Offline",
      accent: overview ? "#2563eb" : "#dc2626",
    },
    {
      name: "Disaster Feed",
      detail: `${disasters.length} events synchronized from operations service.`,
      status: disasters.length ? "Operational" : "Waiting for data",
      accent: disasters.length ? "#f97316" : "#64748b",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        color: "#0f172a",
        padding: "32px 24px 48px",
      }}
    >
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 24,
            borderRadius: 28,
            background: "linear-gradient(135deg, #1d4ed8 0%, #0f172a 85%)",
            color: "#ffffff",
            boxShadow: "0 24px 60px rgba(29, 78, 216, 0.25)",
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <p style={{ margin: 0, letterSpacing: 1.2, textTransform: "uppercase", color: "#bfdbfe", fontSize: 12 }}>
              Admin Operations
            </p>
            <h1 style={{ margin: "10px 0 12px", fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1.05 }}>
              Live system oversight for Damayan command.
            </h1>
            <p style={{ margin: 0, color: "#dbeafe", fontSize: 16, lineHeight: 1.6 }}>
              Signed in as {session.user.name || session.user.email}. This dashboard loads from the NestJS gateway and operations/auth microservices.
            </p>
          </div>
          <div style={{ display: "grid", gap: 12, justifyItems: "end" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#bfdbfe", textTransform: "uppercase", letterSpacing: 1.1 }}>Role</div>
              <strong style={{ fontSize: 18 }}>{session.user.role}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
                background: "#ffffff",
                color: "#1e293b",
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ ...cardStyle("#dc2626"), color: "#991b1b" }}>
            <strong>Backend request failed.</strong>
            <p style={{ margin: "8px 0 0" }}>{error}</p>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <div style={cardStyle("#2563eb")}>
            <div style={{ fontSize: 14, color: "#475569" }}>Active disasters</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{overview ? overview.disasterEvents.activeEvents : "N/A"}</div>
            <div style={{ color: "#64748b", marginTop: 8 }}>{overview ? `${overview.disasterEvents.severeEvents} marked high severity` : "No backend data"}</div>
          </div>
          <div style={cardStyle("#f97316")}>
            <div style={{ fontSize: 14, color: "#475569" }}>Pending incident reports</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{overview ? overview.incidentReports.pendingReports : "N/A"}</div>
            <div style={{ color: "#64748b", marginTop: 8 }}>{overview ? `${overview.incidentReports.totalReports} total reports tracked` : "No backend data"}</div>
          </div>
          <div style={cardStyle("#16a34a")}>
            <div style={{ fontSize: 14, color: "#475569" }}>Relief inventory units</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{overview ? overview.inventory.totalItems : "N/A"}</div>
            <div style={{ color: "#64748b", marginTop: 8 }}>{overview ? `${overview.inventory.lowStockItems} low-stock items detected` : "No backend data"}</div>
          </div>
          <div style={cardStyle("#7c3aed")}>
            <div style={{ fontSize: 14, color: "#475569" }}>Available shelter slots</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{overview ? overview.capacity.availableSlots : "N/A"}</div>
            <div style={{ color: "#64748b", marginTop: 8 }}>{overview ? `${overview.capacity.fullCenters} centers already full` : "No backend data"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)" }}>
          <section style={cardStyle("#1d4ed8")}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24 }}>Disaster monitoring</h2>
                <p style={{ margin: "8px 0 0", color: "#64748b" }}>Live records pulled from the admin disaster-events endpoint.</p>
              </div>
              <div style={{ color: "#64748b", fontSize: 14 }}>{disasters.length} synced records</div>
            </div>
            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {disasters.length ? (
                disasters.slice(0, 5).map((event) => (
                  <article
                    key={event.id}
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      borderRadius: 18,
                      background: "#f8fafc",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 17 }}>{event.name}</strong>
                      <span style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: event.status === "active" ? "#fee2e2" : "#e0f2fe",
                        color: event.status === "active" ? "#b91c1c" : "#0369a1",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}>{event.status}</span>
                    </div>
                    <div style={{ color: "#475569", lineHeight: 1.6 }}>
                      {event.type} in {event.province}. Severity {event.severityLevel}. Affected areas: {event.affectedAreas.join(", ") || "No areas listed"}.
                    </div>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Started {formatDate(event.dateStarted)}</div>
                  </article>
                ))
              ) : (
                <p style={{ margin: 0, color: "#64748b" }}>No disaster events are currently available from the backend.</p>
              )}
            </div>
          </section>

          <aside style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle("#0f172a")}>
              <h2 style={{ margin: 0, fontSize: 22 }}>System reachability</h2>
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {liveChecks.map((check) => (
                  <div key={check.name} style={{ padding: 14, borderRadius: 16, background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{check.name}</strong>
                      <span style={{ color: check.accent, fontWeight: 700 }}>{check.status}</span>
                    </div>
                    <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5 }}>{check.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={cardStyle("#16a34a")}>
              <h2 style={{ margin: 0, fontSize: 22 }}>Partner organizations</h2>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                {overview
                  ? `${overview.organizations.verifiedOrganizations} verified of ${overview.organizations.totalOrganizations} total organizations.`
                  : "No backend data"}
              </p>
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {organizations.slice(0, 4).map((organization) => (
                  <div key={organization.id} style={{ padding: 14, borderRadius: 16, background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{organization.name}</strong>
                      <span style={{ color: organization.verified ? "#15803d" : "#92400e", fontWeight: 700 }}>
                        {organization.verified ? "Verified" : "Pending"}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, color: "#64748b" }}>{organization.type}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section style={cardStyle("#f97316")}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>Inventory watchlist</h2>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>Top items pulled from the live inventory endpoint.</p>
            </div>
            <div style={{ color: "#64748b", fontSize: 14 }}>{inventory.length} total inventory rows</div>
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 20 }}>
            {topInventory.length ? (
              topInventory.map((item) => (
                <article key={item.id} style={{ padding: 16, borderRadius: 18, background: "#fff7ed", border: "1px solid rgba(249, 115, 22, 0.18)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{item.name}</strong>
                    <span style={{ color: item.status === "low" ? "#b45309" : "#15803d", fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}>
                      {item.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, color: "#475569" }}>{item.category}</div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{item.quantity.toLocaleString()}</div>
                  <div style={{ color: "#64748b" }}>{item.unit}</div>
                </article>
              ))
            ) : (
              <p style={{ margin: 0, color: "#64748b" }}>No inventory records are available yet.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}