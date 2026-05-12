"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearSession, hasRole, loadSession } from "../../lib/session";
import { getDashboard, getInventory, getRecentCheckIns } from "../../lib/api";
import type {
  AuthSession,
  CheckInRecord,
  DashboardOverview,
  InventoryItem,
} from "../../lib/types";
import { AppRole } from "../../lib/types";

// ─── Fallback data ───────────────────────────────────────────────────────────

const FALLBACK_INVENTORY: InventoryItem[] = [
  { id: "1", name: "Potable Water", category: "Water", quantity: 15000, unit: "Liters", status: "available" },
  { id: "2", name: "Medical Kits", category: "Medical", quantity: 450, unit: "Units", status: "available" },
  { id: "3", name: "Blankets & Shelter", category: "Shelter", quantity: 800, unit: "Kits", status: "low_stock" },
  { id: "4", name: "Dry Rations", category: "Food", quantity: 2500, unit: "Boxes", status: "available" },
];

const FALLBACK_CHECKINS: CheckInRecord[] = [
  { id: "1", evacueeId: "e1", evacueeNumber: "EV-001", firstName: "Convoy", lastName: "Gamma", fullName: "Fleet Arrival: Convoy Gamma", zone: "North", location: "Northern Staging Point", status: "checked_in", checkInTime: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: "2", evacueeId: "e2", evacueeNumber: "EV-002", firstName: "Comms", lastName: "Sector4", fullName: "Comms Established: Sector 4", zone: "Sector 4", location: "Temporary Command Post", status: "checked_in", checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "3", evacueeId: "e3", evacueeNumber: "EV-003", firstName: "Warning", lastName: "Coastal", fullName: "Warning Issued: Coastal Inundation", zone: "Cluster B", location: "Low-lying Areas", status: "checked_out", checkInTime: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inventoryTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("low") || s.includes("critical") || s.includes("depleted")) return "warning";
  return "secure";
}

function formatCheckInTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
  if (diffH < 1) return `${Math.floor((now.getTime() - d.getTime()) / 60_000)}m ago – TODAY`;
  if (diffH < 24) return `${diffH}h ago – TODAY`;
  return `YESTERDAY – ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function avatarInitials(session: AuthSession | null): string {
  if (!session) return "SM";
  const f = session.user.firstName?.[0] ?? "";
  const l = session.user.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "SM";
}
import SiteManagerDashboard from "../components/SiteManagerDashboard";

export default function BeforeCalamityPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>(FALLBACK_INVENTORY);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(FALLBACK_CHECKINS);

  useEffect(() => {
    const stored = loadSession();
    if (!hasRole(stored, AppRole.LINE_MANAGER)) {
      router.replace("/site-manager/login");
      return;
    }
    setSession(stored);

    async function hydrate() {
      if (!stored) return;
      const token = stored.accessToken;
      const [ovResult, invResult, ciResult] = await Promise.allSettled([
        getDashboard("site-manager", token),
        getInventory("site-manager", token),
        getRecentCheckIns(token, 8),
      ]);
      if (ovResult.status === "fulfilled") setOverview(ovResult.value);
      if (invResult.status === "fulfilled" && invResult.value.length > 0) setInventory(invResult.value);
      if (ciResult.status === "fulfilled" && ciResult.value.length > 0) setCheckIns(ciResult.value);
    }

    hydrate();
  }, [router]);

  const readinessPct = overview
    ? Math.min(
        100,
        Math.round(
          ((overview.capacity.totalCapacity - overview.capacity.totalOccupancy) /
            Math.max(1, overview.capacity.totalCapacity)) *
            100,
        ),
      )
    : 88;

  function handleSignOut() {
    clearSession();
    router.replace("/site-manager/login");
  }

  return (
    <div className="preparedness-page">
      <aside className="preparedness-sidebar">
        <div className="preparedness-sidebar-inner">
          <div>
            <div className="preparedness-brand">
              <div className="preparedness-brand-mark">D</div>
              <div>
                <div className="preparedness-brand-name">Damayan Portal</div>
                <p className="preparedness-brand-subtitle">Site Manager</p>
              </div>
            </div>

            <nav className="preparedness-nav">
              <button className="is-active" type="button">
                <span className="nav-icon">D</span>
                <span>Dashboard</span>
              </button>
              <button type="button">
                <span className="nav-icon">A</span>
                <span>Assessment</span>
              </button>
              <button type="button">
                <span className="nav-icon">P</span>
                <span>Distribution</span>
              </button>
              <button type="button">
                <span className="nav-icon">R</span>
                <span>Recovery</span>
              </button>
              <button type="button">
                <span className="nav-icon">I</span>
                <span>Impact Reports</span>
              </button>
              <button type="button">
                <span className="nav-icon">S</span>
                <span>Settings</span>
              </button>
            </nav>
          </div>

          <div className="preparedness-sidebar-footer">
            <button className="primary-utility-button" type="button">
              Log Rapid Report
            </button>
            <button type="button">Support</button>
            <button className="sidebar-signout-link" type="button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="preparedness-main">
        <header className="preparedness-topbar">
          <div className="topbar-left">
            <span className="topbar-title">Evacuation Management</span>
            <div className="topbar-search">
              <span className="topbar-search-icon">S</span>
              <input
                type="text"
                placeholder="Search evacuees or shelters..."
              />
            </div>
          </div>

          <div className="topbar-center">
            <button className="is-active" type="button">
              Phases
            </button>
            <button type="button">Resources</button>
            <button type="button">Team</button>
          </div>

          <div className="topbar-right">
            <span className="topbar-divider" />
            <div className="topbar-avatar">{avatarInitials(session)}</div>
          </div>
        </header>

        <div className="preparedness-content">
          <section className="hero-section">
            <div className="hero-section-copy">
              <div className="hero-badges">
                <span className="phase-badge">Phase 1</span>
                <span className="phase-label">Active Preparedness Mode</span>
              </div>
              <h1>Regional Preparedness Dashboard</h1>
              <p>
                Site Manager: <strong>{session?.user.name ?? "Central Visayas Cluster"}</strong>. Monitoring
                regional logistics and readiness ahead of forecasted weather
                event.
              </p>

              <div className="phase-transition-card">
                <div>
                  <strong>Next Phase</strong>
                  <p>
                    When operations shift from preparedness to live response,
                    continue to the during calamity dashboard.
                  </p>
                </div>
                <Link className="phase-transition-link" href="/site-manager/duringcalamity">
                  Open Active Response
                </Link>
              </div>
            </div>

            <div className="hero-metrics">
              <div className="hero-metric-card">
                <span className="metric-value">72h</span>
                <span className="metric-label">Window</span>
              </div>
              <div className="hero-metric-card is-highlight">
                <span className="metric-value">{readinessPct}%</span>
                <span className="metric-label">Readiness</span>
              </div>
            </div>
          </section>

          <section className="prep-actions-card">
            <div className="prep-actions-header">
              <div>
                <h2>Before Calamity Checklist</h2>
                <p>
                  Core readiness actions aligned to your swimlane before the
                  response phase begins.
                </p>
              </div>
            </div>

            <div className="prep-actions-grid">
              <article className="prep-action-item">
                <div className="prep-action-badge">1</div>
                <div className="prep-action-copy">
                  <h3>Verify Inventory & Capacity</h3>
                  <p>
                    Confirm relief stock levels, shelter space, responder
                    readiness, and staging coverage across the region.
                  </p>
                  <span className="prep-action-status is-ready">
                    {overview
                      ? `${overview.inventory.totalItems} items tracked — ${overview.inventory.lowStockItems} low stock`
                      : "Inventory verified"}
                  </span>
                </div>
              </article>

              <article className="prep-action-item">
                <div className="prep-action-badge">2</div>
                <div className="prep-action-copy">
                  <h3>Enable / Prepare Check-In Scanner</h3>
                  <p>
                    Test QR scanning, validate fallback manual ID entry, and
                    confirm check-in devices are ready for evacuee intake.
                  </p>

                  <div className="scanner-prep-panel">
                    <div className="scanner-prep-status">
                      <span className="scanner-prep-dot" />
                      <span>Scanner Ready</span>
                    </div>
                    <div className="scanner-prep-tags">
                      <span>2 tablets paired</span>
                      <span>Offline mode synced</span>
                      <span>Manual log enabled</span>
                    </div>
                    <Link
                      className="scanner-prep-link"
                      href="/site-manager/duringcalamity"
                    >
                      Open Check-In Flow
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="preparedness-grid">
            <div className="map-card">
              <div className="map-overlay">
                <h3>Live Fleet & Command</h3>
                <div className="map-alert-list">
                  <div className="map-alert-item">
                    <span className="map-alert-dot is-primary" />
                    <span>Mobile Command Alpha</span>
                    <strong>Active</strong>
                  </div>
                  <div className="map-alert-item">
                    <span className="map-alert-dot is-warning" />
                    <span>Alert Zone: Sector 4</span>
                    <strong>Critical</strong>
                  </div>
                  <div className="map-alert-item">
                    <span className="map-alert-dot is-muted" />
                    <span>Supply Depot C</span>
                    <strong>Standby</strong>
                  </div>
                </div>
              </div>

              <div className="map-actions">
                <button type="button">+</button>
                <button type="button">-</button>
                <button type="button">◎</button>
              </div>

              <div className="map-surface">
                <div className="map-grid" />
                <div className="map-zone zone-one" />
                <div className="map-zone zone-two" />
                <div className="map-route" />
              </div>
            </div>

            <div className="side-metrics">
              <div className="deployment-card">
                <h3>Capacity Overview</h3>
                <div className="deployment-list">
                  <div>
                    <div className="deployment-row">
                      <span>Total Occupancy</span>
                      <strong>
                        {overview
                          ? `${overview.capacity.totalOccupancy.toLocaleString()} / ${overview.capacity.totalCapacity.toLocaleString()}`
                          : "24 / 30"}
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: overview
                            ? `${Math.round((overview.capacity.totalOccupancy / Math.max(1, overview.capacity.totalCapacity)) * 100)}%`
                            : "80%",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="deployment-row">
                      <span>Available Slots</span>
                      <strong>
                        {overview ? overview.capacity.availableSlots.toLocaleString() : "—"}
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: overview
                            ? `${Math.round((overview.capacity.availableSlots / Math.max(1, overview.capacity.totalCapacity)) * 100)}%`
                            : "100%",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="deployment-row">
                      <span>High Utilization Centers</span>
                      <strong>
                        {overview
                          ? `${overview.capacity.highUtilizationCenters} / ${overview.capacity.totalCenters}`
                          : "—"}
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: overview
                            ? `${Math.round((overview.capacity.highUtilizationCenters / Math.max(1, overview.capacity.totalCenters)) * 100)}%`
                            : "72%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {overview && overview.inventory.lowStockItems > 0 ? (
                <div className="priority-card">
                  <span className="priority-icon">!</span>
                  <span className="priority-tag">Priority High</span>
                  <h4>Low Stock Alert</h4>
                  <p>
                    {overview.inventory.lowStockItems} item
                    {overview.inventory.lowStockItems > 1 ? "s are" : " is"} below
                    minimum stock threshold. Immediate reallocation suggested.
                  </p>
                  <button type="button">Initiate Reallocation</button>
                </div>
              ) : (
                <div className="priority-card">
                  <span className="priority-icon">!</span>
                  <span className="priority-tag">Priority High</span>
                  <h4>Resource Shortfall: Sector 4</h4>
                  <p>
                    Medical kits in Sector 4 are currently at 45% capacity.
                    Immediate reallocation suggested from Central Depot.
                  </p>
                  <button type="button">Initiate Reallocation</button>
                </div>
              )}
            </div>

            <div className="inventory-card">
              <div className="inventory-card-header">
                <div>
                  <h2>Essential Supply Checklist</h2>
                  <p>Real-time inventory levels across regional staging areas.</p>
                </div>
                <button type="button">Export Inventory Data</button>
              </div>

              <div className="inventory-grid">
                {inventory.map((item) => {
                  const tone = inventoryTone(item.status);
                  return (
                    <article
                      key={item.id}
                      className={`inventory-item inventory-${tone}`}
                    >
                      <div className="inventory-item-top">
                        <div className={`inventory-icon inventory-icon-${tone}`}>
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4>{item.name}</h4>
                          <p>{item.quantity.toLocaleString()} {item.unit}</p>
                        </div>
                      </div>
                      <div className="inventory-item-bottom">
                        <span className="inventory-percent">{item.category}</span>
                        <span className={`inventory-status inventory-status-${tone}`}>
                          {tone === "warning" ? "Low Stock" : "Secure"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="timeline-card">
            <h3>Recent Staging Activities</h3>
            <div className="timeline-list">
              {checkIns.map((ci, index) => (
                <article className="timeline-item" key={ci.id}>
                  <div className="timeline-rail">
                    <span
                      className={`timeline-dot timeline-dot-${
                        ci.status === "checked_out" ? "warning" : "primary"
                      }`}
                    />
                    {index < checkIns.length - 1 ? (
                      <span className="timeline-line" />
                    ) : null}
                  </div>
                  <div className="timeline-copy">
                    <span className="timeline-time">{formatCheckInTime(ci.checkInTime)}</span>
                    <h4>{ci.fullName}</h4>
                    <p>
                      {ci.status === "checked_out" ? "Checked out from" : "Checked in at"}{" "}
                      {ci.location}{ci.zone ? `, Zone ${ci.zone}` : ""}.
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
  return <SiteManagerDashboard phase="before" />;
}
