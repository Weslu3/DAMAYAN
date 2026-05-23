"use client";
import "./dispatcher.css";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  NavPage,
  Incident,
  Unit,
  Team,
  IncidentPriority,
  IncidentStatus,
  SituationType,
  UnitType,
  UnitStatus,
  BarangayDemographics,
  MOCK_DISPATCHER,
  mapCityToBarangay,
  priorityClass,
  statusClass,
  situationClass,
  situationColor,
  unitStatusColor,
  unitTypeColor,
  priorityColor,
  UNIT_TYPE_LABEL,
  UNIT_TYPE_ICON,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  shortenId,
} from "./data";
import LiveMap, { MapMode } from "./LiveMap";
import {
  geocodeDispatcherAddress,
  getDispatcherOverview,
  getDispatcherProfile,
  getDispatcherIncidents,
  getDispatcherVolunteers,
  getDispatcherCityData,
  sendDispatcherBroadcast,
  updateIncidentReport,
  createVolunteerDispatch,
} from "../lib/api";
import { loadSession } from "../lib/session";
import type {
  DispatchOrder,
  DispatcherProfile as BackendDispatcherProfile,
  DispatcherVolunteerTeam,
  DispatcherVolunteerUnit,
  IncidentReport,
  Organization,
} from "../lib/types";
import { Icon, IconName } from "./components/ui/Icon";

function volunteerIconName(type: UnitType): IconName {
  if (type === "MEDIC") return "medic";
  if (type === "FIELD") return "field";
  if (type === "LOGISTICS") return "logistics";
  return "users";
}

// ══════════════════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`dp-badge ${cls}`}>{label}</span>;
}

function Modal({
  title,
  onClose,
  width = 560,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const portalEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!portalEl.current) {
      portalEl.current = document.createElement("div");
    }
    const el = portalEl.current;
    document.body.appendChild(el);
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  if (!mounted || !portalEl.current) return null;

  return createPortal(
    <div
      className="dp-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dp-modal" style={{ maxWidth: width }}>
        <div className="dp-modal-header">
          <span className="dp-modal-title">{title}</span>
          <button className="dp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dp-modal-body">{children}</div>
      </div>
    </div>,
    portalEl.current,
  );
}

function CountUp({ end, duration = 1000 }: { end: number | string; duration?: number }) {
  const [count, setCount] = useState(0);
  const numEnd = typeof end === 'string' ? parseInt(end.replace(/,/g, ''), 10) : end;
  
  useEffect(() => {
    if (isNaN(numEnd)) return;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * numEnd));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(numEnd);
      }
    };
    window.requestAnimationFrame(step);
  }, [numEnd, duration]);
  
  if (isNaN(numEnd)) return <>{end}</>;
  return <>{count.toLocaleString()}</>;
}

function Toast({ msg, type = "success", duration = 3000 }: { msg: string; type?: "success" | "error" | "warning"; duration?: number }) {
  const [show, setShow] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => setShow(false), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);
  
  if (!show) return null;
  
  const iconMap = {
    success: "✓",
    error: "✕",
    warning: ""
  };
  
  const classNames = `dp-toast dp-toast-${type}${isExiting ? " dp-toast-exiting" : ""}`;
  
  return (
    <div className={classNames}>
      <span className="dp-toast-icon">{iconMap[type]}</span>
      <span className="dp-toast-message">{msg}</span>
    </div>
  );
}

function QueueFilterDropdown<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={wrapRef} className={`dp-queue-dropdown ${className ?? ""}`}>
      <button
        type="button"
        className="dp-queue-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected.label}</span>
        <span className={`dp-queue-dropdown-caret${open ? " open" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="dp-queue-dropdown-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dp-queue-dropdown-item${opt.value === value ? " active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () =>
      setT(
        new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// Helper: add minutes to a time string like "9:41 AM" → "9:43 AM"
function addMins(timeStr: string, mins: number): string {
  try {
    const [time, period] = timeStr.split(" ");
    const [h, m] = time.split(":").map(Number);
    let totalMins = (h % 12) * 60 + m + (period === "PM" ? 720 : 0) + mins;
    const newH = Math.floor(totalMins / 60) % 12 || 12;
    const newM = totalMins % 60;
    const newP = Math.floor(totalMins / 60) % 24 >= 12 ? "PM" : "AM";
    return `${newH}:${String(newM).padStart(2, "0")} ${newP}`;
  } catch {
    return timeStr;
  }
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | "warning">("success");
  
  const show = (m: string, t: "success" | "error" | "warning" = "success") => {
    setMsg(m);
    setType(t);
    setTimeout(() => setMsg(null), 3200);
  };
  
  return { msg, type, show };
}

function formatDateForInput(dateLike: string) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapOrganizationToUnitType(type?: string): UnitType {
  const t = String(type ?? "").toLowerCase();
  if (/(medical|medic|hospital|health|clinic|ambulance)/.test(t)) return "MEDIC";
  if (/(logistic|transport|supply|relief)/.test(t)) return "LOGISTICS";
  return "FIELD";
}

function mapOrganizationToUnit(org: Organization): Unit {
  const unitType = mapOrganizationToUnitType(org.type);
  return {
    id: org.id,
    type: unitType,
    name: org.name,
    station: org.contactEmail || "Volunteer Organization",
    status: org.verified ? "Available" : "Offline",
    lat: 14.6042,
    lng: 120.9822,
    personnel: 0,
    distance: "-",
    eta: "-",
    teamLeader: "N/A",
    contact: org.contactPhone || org.contactEmail || "N/A",
    plateNumber: "N/A",
    lastActive: "Synced",
  };
}

// Helper: map units to teams
function volunteersToTeams(units: Unit[]): Team[] {
  return units.map((u, i) => ({
    id: `t-${u.id}`,
    type: u.type,
    name: u.name,
    station: u.station,
    status:
      u.status === "Available"
        ? "Ready"
        : u.status === "Offline"
          ? "Offline"
          : "Deployed",
    leader: u.teamLeader,
    contact: u.contact,
    members: u.personnel,
    vehicles: 1,
    coverage: "Cluster 3",
    equipment:
      u.type === "MEDIC"
        ? ["First Aid", "Stretcher"]
        : u.type === "FIELD"
          ? ["Radio", "Flashlight"]
          : ["Supplies", "Radio"],
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({
  onLogin,
  onRegister,
}: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [idFile, setIdFile] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <div className="dp-page dp-login-page">
      <div className="dp-login-card">
        {/* Brand */}
        <div className="dp-login-brand">
          <div>
            <div className="dp-login-logo">
              <div className="dp-login-logo-mark">
                <img src="/damayan_logo.svg" alt="Damayan Logo" style={{ width: '100%', height: '100%' }} />
              </div>
              <div>
                <span className="dp-login-logo-name">Damayan</span>
                <p className="dp-login-logo-role">Dispatcher Portal</p>
              </div>
            </div>
            <h1>
              Coordinate.
              <br />
              Dispatch.
              <br />
              Protect.
            </h1>
            <p>
              Real-time dispatch management for police, ambulance, and fire
              response across Metro Cluster 3.
            </p>
          </div>
          <div className="dp-login-brand-badges">
            {[{ l: "Police" }, { l: "Medical" }, { l: "Fire" }].map((b) => (
              <div key={b.l} className="dp-login-brand-badge">
                <span>{b.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="dp-login-panel">
          {forgot ? (
            <div>
              <div className="dp-login-intro">
                <h2>Reset Password</h2>
                <p>
                  Enter your registered email or phone. We'll send a reset link
                  via Email/SMS.
                </p>
              </div>
              {resetSent ? (
                <div
                  className="dp-alert dp-alert-green"
                  style={{ marginTop: "1.5rem", textAlign: "center" }}
                >
                  <strong>Reset link sent!</strong>
                  <br />
                  Check your email or SMS inbox.
                  <br />
                  <button
                    className="dp-btn dp-btn-green"
                    style={{ marginTop: "1rem" }}
                    onClick={() => {
                      setForgot(false);
                      setResetSent(false);
                    }}
                  >
                    ← Back to Login
                  </button>
                </div>
              ) : (
                <div className="dp-form" style={{ marginTop: "1.5rem" }}>
                  <div className="dp-field">
                    <label>Email or Phone</label>
                    <input
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="your@email.com or +63..."
                    />
                  </div>
                  <button
                    className="dp-btn-primary"
                    onClick={() => setResetSent(true)}
                  >
                    Send Reset Link via Email/SMS
                  </button>
                  <button
                    className="dp-btn dp-btn-ghost"
                    style={{ width: "100%" }}
                    onClick={() => setForgot(false)}
                  >
                    ← Back to Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="dp-login-tabs">
                <button
                  className={`dp-login-tab ${mode === "login" ? "active" : ""}`}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  className={`dp-login-tab ${mode === "register" ? "active" : ""}`}
                  onClick={() => setMode("register")}
                >
                  Register
                </button>
              </div>
              {mode === "login" ? (
                <>
                  <div className="dp-login-intro">
                    <h2>Welcome back</h2>
                    <p>Sign in to the Damayan Dispatcher Portal.</p>
                  </div>
                  {err && (
                    <div className="dp-error-msg">
                      Invalid credentials. Please check your username and
                      password.
                    </div>
                  )}
                  <div className="dp-form" style={{ marginTop: "1.2rem" }}>
                    <div className="dp-field">
                      <label>Username</label>
                      <input
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="dispatcher_username"
                      />
                    </div>
                    <div className="dp-field">
                      <div className="dp-field-row">
                        <label>Password</label>
                        <button onClick={() => setForgot(true)}>
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <button
                      className="dp-btn-primary"
                      onClick={() => {
                        if (user && pass) {
                          setErr(false);
                          onLogin();
                        } else setErr(true);
                      }}
                    >
                      Sign In →
                    </button>
                  </div>
                  <p className="dp-login-switch">
                    Don't have an account?{" "}
                    <a onClick={() => setMode("register")}>Register here</a>
                  </p>
                </>
              ) : (
                <>
                  <div className="dp-login-intro">
                    <h2>Create Account</h2>
                    <p>
                      Register with your credentials and a valid Government ID
                      for admin verification.
                    </p>
                  </div>
                  <div className="dp-form" style={{ marginTop: "1.2rem" }}>
                    <div className="dp-field">
                      <label>Username</label>
                      <input
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="Choose a username"
                      />
                    </div>
                    <div className="dp-field">
                      <label>Password</label>
                      <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="dp-field">
                      <label>Upload Valid Government ID *</label>
                      <div
                        className={`dp-id-upload ${idFile ? "uploaded" : ""}`}
                        onClick={() => setIdFile("gov_id.jpg")}
                      >
                        {idFile ? (
                          <>
                            <div
                              className="label"
                              style={{
                                color: "var(--d-green)",
                                fontWeight: 700,
                              }}
                            >
                              {idFile} — uploaded
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="label">
                              Click to upload Government ID
                            </div>
                            <div className="hint">
                              UMID, SSS, Passport, Driver's License
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      className="dp-btn-primary"
                      disabled={!user || !pass || !idFile}
                      onClick={onRegister}
                    >
                      Register & Submit for Verification
                    </button>
                  </div>
                  <div className="dp-login-note">
                     After submission, wait for admin approval before
                    accessing the portal.
                  </div>
                  <p className="dp-login-switch">
                    Already have an account?{" "}
                    <a onClick={() => setMode("login")}>Sign in here</a>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AWAITING VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════
function AwaitingPage({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="dp-page dp-verify-page">
      <div className="dp-verify-card">
        <div
          className="dp-verify-icon"
          style={{
            background: "var(--d-primary)",
            color: "white",
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: "1.2rem",
            fontWeight: 800,
          }}
        >
          T
        </div>
        <h2>Waiting for Verification</h2>
        <p>
          Your account and government ID have been submitted. An administrator
          will verify your documents. You'll be notified via email/SMS once
          approved.
        </p>
        <div className="dp-verify-steps">
          <div className="dp-verify-step">
            Account created with username & password
          </div>
          <div className="dp-verify-step">
            Government ID uploaded successfully
          </div>
          <div className="dp-verify-step pending">
            Awaiting admin verification
          </div>
        </div>
        <button className="dp-btn-primary" onClick={onProceed}>
          Continue (Demo: Skip Verification)
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ══════════════════════════════════════════════════════════════════════════════
function DashboardPage({ incidents, units, onDispatch, onMarkInvalid, status }: {
  incidents: Incident[];
  units: Unit[];
  onDispatch: (inc: Incident) => void;
  onMarkInvalid: (inc: Incident, reason: string) => void;
  status: "active" | "inactive";
}) {
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const newInc    = incidents.filter(i => i.status === "New" || i.status === "Waiting");
  const activeInc = incidents.filter(i => i.status === "In Progress" || i.status === "Dispatched");
  const resolved  = incidents.filter(i => i.status === "Resolved");
  const critical  = incidents.filter(i => (i.priority === "CRITICAL" || i.priority === "HIGH") && i.status !== "Resolved" && i.status !== "Invalid");
  const avail     = units.filter(u => u.status === "Available").length;
  const deployed  = units.filter(u => u.status !== "Available" && u.status !== "Offline").length;
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePriority, setQueuePriority] = useState<"ALL" | IncidentPriority>("ALL");
  const [queueStatus, setQueueStatus] = useState<"ALL" | IncidentStatus>("ALL");
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);

  const stats: Array<{
    label: string;
    value: number;
    color: string;
    bgColor: string;
    icon: IconName;
    desc: string;
  }> = [
    { label: "New Incidents",    value: newInc.length,    color: "var(--d-red)",     bgColor: "rgba(198, 40, 40, 0.10)", icon: "ticket",   desc: "Awaiting review" },
    { label: "Active Response",  value: activeInc.length, color: "var(--d-primary)", bgColor: "rgba(46, 125, 50, 0.10)", icon: "activity", desc: "Dispatch ongoing" },
    { label: "Resolved Today",   value: resolved.length,  color: "var(--d-green)",   bgColor: "rgba(46, 125, 50, 0.10)", icon: "check",    desc: "Closed incidents" },
    { label: "Critical / High",  value: critical.length,  color: "#c77700",          bgColor: "rgba(199, 119, 0, 0.12)",  icon: "warning",  desc: "Needs attention" },
    { label: "Units Available",  value: avail,            color: "var(--d-blue)",    bgColor: "rgba(21, 101, 192, 0.10)", icon: "users",    desc: `${deployed} deployed` },
    { label: "Total Units",      value: units.length,     color: "var(--d-text)",    bgColor: "rgba(45, 49, 45, 0.08)",   icon: "map",      desc: "Registered responders" },
  ];

  const ACTIVITY = [
    { time: "09:45 AM", type: "DISPATCH",  color: "var(--d-blue)",    msg: "AMB-03 dispatched to INC-0148 — Lacson Avenue" },
    { time: "09:37 AM", type: "DISPATCH",  color: "var(--d-blue)",    msg: "AMB-03 & POL-04 dispatched to INC-0149 — Cayco St." },
    { time: "09:30 AM", type: "DISPATCH",  color: "var(--d-blue)",    msg: "3 units dispatched to INC-0150 — Aurora Blvd." },
    { time: "08:23 AM", type: "RESOLVED",  color: "var(--d-green)",   msg: "INC-0138 resolved — Structure fire, Flores St." },
    { time: "07:58 AM", type: "ON SCENE",  color: "var(--d-primary)", msg: "FIRE-03 on scene at Sta. Mesa incident" },
    { time: "07:43 AM", type: "DISPATCH",  color: "var(--d-blue)",    msg: "AMB-01 dispatched to INC-0139 — Dagupan St." },
  ];

  // Queue = New + Waiting + Dispatched (but NOT In Progress/Resolved/Invalid)
  const queueInc = incidents.filter(i => ["New","Waiting","Dispatched"].includes(i.status));
  const pendingQueue = queueInc;
  const filteredPendingQueue = pendingQueue.filter((inc) => {
    const haystack = `${inc.id} ${inc.type} ${inc.location} ${inc.address} ${inc.barangay} ${inc.city}`.toLowerCase();
    const matchesSearch = !queueSearch.trim() || haystack.includes(queueSearch.trim().toLowerCase());
    const matchesPriority = queuePriority === "ALL" || inc.priority === queuePriority;
    const matchesStatus = queueStatus === "ALL" || inc.status === queueStatus;
    const matchesDistrict = !districtFilter || [inc.location, inc.address, inc.barangay, inc.city].some((part) =>
      part?.toLowerCase().includes(districtFilter.toLowerCase()),
    );
    return matchesSearch && matchesPriority && matchesStatus && matchesDistrict;
  });
  const criticalAlerts = critical;
  const responderGroups = (["FIELD", "MEDIC", "LOGISTICS"] as UnitType[]).map((type) => {
    const groupUnits = units.filter((unit) => unit.type === type);
    const available = groupUnits.filter((unit) => unit.status === "Available").length;
    const total = groupUnits.length;
    return {
      label: UNIT_TYPE_LABEL[type],
      available,
      total,
      pct: total ? Math.round((available / total) * 100) : 0,
      color: unitTypeColor(type),
    };
  });

  return (
    <div className="dp-dashboard dp-fade-in">
      <div className="dp-dash-greeting">
        <div className="dp-dash-greeting-date">{today}</div>
        <h1>Command Overview</h1>
        <p>Metro Cluster 3 - Sampaloc Command Center</p>
      </div>

      <div className="dp-stats-row dp-stats-row-4col">
        {stats.map((s) => (
          <div key={s.label} className="dp-stat">
            <div className="dp-stat-icon-wrap" style={{ color: s.color, backgroundColor: s.bgColor }}>
              <Icon name={s.icon} size={18} />
            </div>
            <div className="dp-stat-label">{s.label}</div>
            <div className="dp-stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="dp-stat-sub">{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="dp-card dp-card-spacious">
        <div className="dp-card-header">
          <div>
            <div className="dp-card-title">Pending Incident Queue</div>
            <div className="dp-card-sub">Incoming reports awaiting review and dispatch</div>
          </div>
          <span className="dp-badge dp-badge-red">{pendingQueue.length} incoming</span>
        </div>

        <div className="dp-queue-filters">
          <QueueFilterDropdown<string | "ALL">
            value={districtFilter || "ALL"}
            onChange={(v) => setDistrictFilter(v === "ALL" ? null : v)}
            options={[
              { value: "ALL", label: "My Jurisdiction (All)" },
              { value: "Sampaloc, Manila", label: "Sampaloc, Manila" },
              { value: "Quezon City", label: "Quezon City" },
              { value: "Mandaluyong", label: "Mandaluyong" },
            ]}
            className="dp-district-filter"
          />
          <input
            className="dp-queue-filter-input"
            placeholder="Search ID, type, or location..."
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
          />
          <QueueFilterDropdown<"ALL" | IncidentPriority>
            value={queuePriority}
            onChange={(value) => setQueuePriority(value as IncidentPriority | "ALL")}
            options={[
              { value: "ALL", label: "All Priorities" },
              { value: "CRITICAL", label: "Critical" },
              { value: "HIGH", label: "High" },
              { value: "MEDIUM", label: "Medium" },
              { value: "LOW", label: "Low" },
            ]}
          />
          <QueueFilterDropdown<"ALL" | IncidentStatus>
            value={queueStatus}
            onChange={(value) => setQueueStatus(value as IncidentStatus | "ALL")}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "New", label: "New" },
              { value: "Waiting", label: "Waiting" },
              { value: "Dispatched", label: "Dispatched" },
            ]}
          />
          <button
            className="dp-btn dp-btn-sm dp-btn-ghost"
            onClick={() => {
              setQueueSearch("");
              setQueuePriority("ALL");
              setQueueStatus("ALL");
            }}
          >
            Reset
          </button>
        </div>

        <div className="dp-queue-row dp-queue-row-head">
          <span>ID</span>
          <span>Type</span>
          <span>Location</span>
          <span>Reported</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {filteredPendingQueue.length === 0 ? (
          <div className="dp-empty">
            <div className="dp-empty-title">No incidents match current filters</div>
          </div>
        ) : (
          filteredPendingQueue.map((inc) => (
            <QueueRow
              key={shortenId(inc.id)}
              inc={inc}
              units={units}
              onDispatch={onDispatch}
              onMarkInvalid={onMarkInvalid}
              status={status}
            />
          ))
        )}
      </div>

      <div className="dp-dash-grid dp-dash-grid-6040">
        <div className="dp-card dp-card-spacious">
          <div className="dp-card-header">
            <div>
              <div className="dp-card-title">Critical & High Priority Active Incidents</div>
              <div className="dp-card-sub">Immediate operational focus</div>
            </div>
          </div>

          {criticalAlerts.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-title">No critical active incidents</div>
            </div>
          ) : (
            <div className="dp-priority-list">
              {criticalAlerts.map((inc) => (
                <div key={shortenId(inc.id)} className="dp-priority-item">
                  <div>
                    <div className="dp-priority-item-title">{inc.id} - {inc.type}</div>
                    <div className="dp-priority-item-sub">{inc.location}</div>
                  </div>
                  <Badge label={inc.priority} cls={inc.priority === "CRITICAL" ? "dp-badge-red" : "dp-badge-amber"} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dp-card dp-card-spacious">
          <div className="dp-card-header">
            <div>
              <div className="dp-card-title">Available Responders Breakdown</div>
              <div className="dp-card-sub">Who can be deployed next</div>
            </div>
          </div>

          <div className="dp-responder-breakdown">
            {responderGroups.map((group) => (
              <div key={group.label} className="dp-responder-row">
                <div className="dp-responder-topline">
                  <span>{group.label}</span>
                  <span>{group.available}/{group.total}</span>
                </div>
                <div className="dp-progress-track">
                  <div className="dp-progress-fill" style={{ width: `${group.pct}%`, background: group.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TEAM STATUS & ROLES (SHOW USER ROLES ON DASHBOARD) ═══ */}
      <div className="dp-card dp-card-spacious">
        <div className="dp-card-header">
          <div>
            <div className="dp-card-title">Team Status & User Roles</div>
            <div className="dp-card-sub">Real-time duty status of Site Managers and coordinators</div>
          </div>
        </div>

        <div className="dp-team-roles-list">
          {/* Mock Site Manager data showing On-Duty/Off-Duty status */}
          {[
            { name: "Maria Santos", role: "Site Manager - Relief Center A", duty: "On Duty", color: "var(--d-green)" },
            { name: "Juan Reyes", role: "Site Manager - Relief Center B", duty: "On Duty", color: "var(--d-green)" },
            { name: "Ana Cruz", role: "Site Manager - Inventory Hub", duty: "Off Duty", color: "var(--d-text-sub)" },
            { name: "Pedro Gonzales", role: "Line Manager - Operations", duty: "On Duty", color: "var(--d-green)" },
          ].map((person, idx) => (
            <div key={idx} className="dp-team-role-item">
              <div className="dp-team-role-avatar" style={{ background: person.color + "15" }}>
                <span style={{ color: person.color, fontWeight: 800 }}>
                  {person.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div className="dp-team-role-info">
                <div className="dp-team-role-name">{person.name}</div>
                <div className="dp-team-role-role">{person.role}</div>
              </div>
              <div className="dp-team-role-status" style={{ color: person.color }}>
                <span className="dp-team-role-dot" style={{ background: person.color }} />
                {person.duty}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time notification listener for duty status changes */}
      <DutyStatusNotificationListener />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// DUTY STATUS NOTIFICATION LISTENER
// ════════════════════════════════════════════════════════════════════════════════
function DutyStatusNotificationListener() {
  const toast = useToast();
  const [lastNotification, setLastNotification] = useState<{ name: string; status: string; time: number } | null>(null);

  useEffect(() => {
    // Simulate receiving notifications when Site Managers toggle duty status
    // In production, this would be a WebSocket or real-time event listener
    const mockNotificationInterval = setInterval(() => {
      const notifications = [
        { name: "Maria Santos (Site Manager - Relief Center A)", status: "toggled Off-Duty", statusType: "off-duty" },
        { name: "Juan Reyes (Site Manager - Relief Center B)", status: "is now On-Duty", statusType: "on-duty" },
      ];

      // Randomly trigger a notification every 15 seconds (for demo)
      if (Math.random() > 0.7) {
        const notification = notifications[Math.floor(Math.random() * notifications.length)];
        toast.show(` NOTIFICATION: ${notification.name} ${notification.status}`);
        setLastNotification({
          name: notification.name,
          status: notification.statusType,
          time: Date.now(),
        });
      }
    }, 15000);

    return () => clearInterval(mockNotificationInterval);
  }, [toast.show]);

  return null; // This component only handles side effects
}
// Queue row — dispatch navigates to Resource Map dispatch mode; invalid removes from queue
function QueueRow({
  inc,
  units,
  onDispatch,
  onMarkInvalid,
  status,
}: {
  inc: Incident;
  units: Unit[];
  onDispatch: (inc: Incident) => void;
  onMarkInvalid: (inc: Incident, reason: string) => void;
  status: "active" | "inactive";
}) {
  const [ticketModal, setTicketModal] = useState(false);
  const [invalidModal, setInvalidModal] = useState(false);
  const [reason, setReason] = useState("");
  const toast = useToast();

  const handleConfirmInvalid = () => {
    if (status !== "active") return;
    if (!reason.trim()) return;
    onMarkInvalid(inc, reason);
    setInvalidModal(false);
    setReason("");
  };

  return (
    <>
      <div
        className="dp-queue-row"
        style={{ cursor: "pointer" }}
        onClick={() => setTicketModal(true)}
      >
        <span className="dp-queue-id">{shortenId(inc.id)}</span>
        <span className="dp-queue-type">{inc.type}</span>
        <span className="dp-queue-loc">{inc.location}</span>
        <span className="dp-queue-time">{inc.timeReported}</span>
        <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
        <Badge label={inc.status} cls={statusClass(inc.status)} />
        <div className="dp-queue-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="dp-btn dp-btn-sm dp-btn-green"
            disabled={status === "inactive"}
            style={
              status === "inactive"
                ? { opacity: 0.5, cursor: "not-allowed" }
                : undefined
            }
            onClick={() => status === "active" && onDispatch(inc)}
          >
            Dispatch
          </button>
          <button
            className="dp-btn dp-btn-sm dp-btn-ghost"
            disabled={status === "inactive"}
            style={
              status === "inactive"
                ? { opacity: 0.5, cursor: "not-allowed" }
                : undefined
            }
            onClick={() => status === "active" && setInvalidModal(true)}
          >
            Invalid
          </button>
        </div>
      </div>

      {ticketModal && (
        <TicketModal
          inc={inc}
          units={units}
          onClose={() => setTicketModal(false)}
        />
      )}

      {invalidModal && (
        <Modal
          title={`Mark ${shortenId(inc.id)} as Invalid`}
          onClose={() => {
            setInvalidModal(false);
            setReason("");
          }}
          width={460}
        >
          <p
            style={{
              color: "var(--d-text-muted)",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            <strong style={{ color: "var(--d-text)" }}>{inc.type}</strong>{" "}
            reported at {inc.address} — {inc.timeReported}
          </p>
          <label className="dp-label">Reason for marking invalid *</label>
          <textarea
            className="dp-textarea"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate report, false alarm, caller unreachable..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setInvalidModal(false);
                setReason("");
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-red"
              disabled={!reason.trim()}
              onClick={handleConfirmInvalid}
            >
              Confirm Invalid
            </button>
          </div>
        </Modal>
      )}
      {toast.msg && <Toast msg={toast.msg} />}
    </>
  );
}

function TicketModal({
  inc,
  units,
  onClose,
}: {
  inc: Incident;
  units: Unit[];
  onClose: () => void;
}) {
  const assigned = inc.assignedUnits
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean) as Unit[];
  const pc = priorityColor(inc.priority);
  const sc = situationColor(inc.situationType);

  return (
    <Modal title="Incident Ticket" onClose={onClose} width={680}>
      {/* Header block */}
      <div className="dp-ticket-header-block">
        <div>
          <div className="dp-ticket-id">{shortenId(inc.id)}</div>
          <div className="dp-ticket-type-title">
            {inc.type} - {CATEGORY_LABEL[inc.category] ?? "Volunteer"}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              marginTop: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
            <Badge label={inc.status} cls={statusClass(inc.status)} />
            <Badge
              label={inc.situationType}
              cls={situationClass(inc.situationType)}
            />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--d-text-sub)",
              marginBottom: "0.2rem",
            }}
          >
            Reported
          </div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
            {inc.timeReported}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--d-text-sub)" }}>
            {inc.dateReported}
          </div>
          {inc.timeActive && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--d-amber)",
                marginTop: "0.2rem",
                fontWeight: 700,
              }}
            >
              {inc.timeActive} min active
            </div>
          )}
        </div>
      </div>

      <div className="dp-ticket-modal-grid">
        <div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--d-text-sub)",
              marginBottom: "0.6rem",
            }}
          >
            Location & Reporter
          </div>
          {[
            ["Address", inc.address],
            ["Barangay", inc.barangay],
            ["City", inc.city],
            ["Reporter", inc.reporter],
            ["Phone", inc.reporterPhone],
          ].map(([l, v]) => (
            <div
              key={l}
              style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}
            >
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--d-text-sub)",
                  minWidth: 70,
                  paddingTop: 1,
                }}
              >
                {l}
              </span>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--d-text)",
                  fontWeight: 500,
                }}
              >
                {v}
              </span>
            </div>
          ))}
          {inc.dispatchedAt && (
            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}
            >
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--d-text-sub)",
                  minWidth: 70,
                  paddingTop: 1,
                }}
              >
                Dispatched
              </span>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--d-text)",
                  fontWeight: 700,
                }}
              >
                {inc.dispatchedAt}
              </span>
            </div>
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--d-text-sub)",
              marginBottom: "0.6rem",
            }}
          >
            Assigned Volunteers ({assigned.length})
          </div>
          {assigned.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--d-text-sub)" }}>
              No volunteers assigned.
            </p>
          ) : (
            assigned.map((u) => (
              <div
                key={u.id}
                style={{
                  background: "var(--d-surface-low)",
                  borderRadius: 8,
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.5rem",
                  border: "1px solid var(--d-border)",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  {u.name}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}
                >
                  Station: {u.station}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}
                >
                  Leader: {u.teamLeader} · {u.contact}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--d-text-sub)",
            marginBottom: "0.5rem",
          }}
        >
          Incident Description
        </div>
        <div className="dp-ticket-desc">{inc.description}</div>
        {inc.notes && (
          <>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--d-text-sub)",
                marginBottom: "0.5rem",
                marginTop: "0.75rem",
              }}
            >
              Field Notes
            </div>
            <div className="dp-ticket-desc" style={{ whiteSpace: "pre-line" }}>
              {inc.notes}
            </div>
          </>
        )}
      </div>
      <div className="dp-modal-footer">
        <button className="dp-btn dp-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESOURCE MAP PAGE
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// RESOURCE MAP PAGE  (Live Monitoring + Dispatch Select only — NO rescue tab,
//                     NO incident queue table. Map fills full height.)
// ══════════════════════════════════════════════════════════════════════════════
function ResourceMapPage({
  incidents,
  units,
  onUpdate,
  dispatchTarget,
  onClearDispatchTarget,
  status,
  cityData = [],
}: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
  dispatchTarget: Incident | null;
  onClearDispatchTarget: () => void;
  status: "active" | "inactive";
  cityData?: Array<{ psgcCode: string; name: string; province: string | null; region: string | null; coordinates: [number, number] }>;
}) {
  // If a dispatchTarget arrives from dashboard, start in dispatch mode
  const [mapMode, setMapMode] = useState<MapMode>(
    dispatchTarget ? "dispatch" : "monitoring",
  );
  const [filterType, setFilterType] = useState("All");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [showVulnerabilityHeatmap, setShowVulnerabilityHeatmap] = useState(false);
  const [showPopulationDensity, setShowPopulationDensity] = useState(false);
  const barangayData = cityData.map((city) => {
    const count = incidents.filter(
      (i) => i.location?.toLowerCase().includes(city.name.toLowerCase()) ||
             (city.province && i.location?.toLowerCase().includes(city.province.toLowerCase()))
    ).length;
    return mapCityToBarangay(city, count);
  });
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayDemographics | null>(null);
  const [selInc, setSelInc] = useState<Incident | null>(dispatchTarget);
  const [assigned, setAssigned] = useState<string[]>(
    dispatchTarget?.assignedUnits ?? [],
  );
  const [invalidModal, setInvalidModal] = useState<Incident | null>(null);
  const [reason, setReason] = useState("");
  const toast = useToast();

  const isInactive = status === "inactive";

  // When a new dispatchTarget comes in from Shell, switch to dispatch mode
  useEffect(() => {
    if (dispatchTarget) {
      setSelInc(dispatchTarget);
      setAssigned(dispatchTarget.assignedUnits ?? []);
      setMapMode("dispatch");
    }
  }, [dispatchTarget?.id]);

  useEffect(() => {
    (window as any).__dpAssign = (uid: string) => {
      setAssigned((p) => {
        if (p.includes(uid)) {
          toast.show(`${uid} deselected`);
          return p.filter((id) => id !== uid);
        }
        toast.show(`${uid} selected for assignment`);
        return [...p, uid];
      });
    };
    (window as any).__dpMsg = (uid: string) =>
      toast.show(`Message sent to ${uid}`);
    return () => {
      delete (window as any).__dpAssign;
      delete (window as any).__dpMsg;
    };
  }, [selInc]);

  const confirmDispatch = () => {
    if (isInactive) return;
    const patch: Partial<Incident> = {
      status: "Dispatched",
      assignedUnits: assigned,
      dispatchedAt: new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
    };

    const session = loadSession();
    if (session?.accessToken && selInc) {
      const apiPatch: Record<string, any> = { status: "actioned" };
      if (assigned.length > 0) {
        apiPatch.content = `Dispatched: ${assigned.join(", ")} to ${selInc.type}s`;
      }
      void updateIncidentReport(session.accessToken, selInc.id, apiPatch)
        .then(() => { onUpdate(selInc.id, patch); })
        .catch((err) => {
          console.error("Failed to persist dispatch:", err);
          toast.show(err?.message || "Failed to sync dispatch to server.");
          onUpdate(selInc.id, patch);
        });
    } else if (selInc) {
      onUpdate(selInc.id, patch);
    }

    setMapMode("monitoring");
    setSelInc(null);
    setAssigned([]);
    onClearDispatchTarget();
    toast.show("Dispatch confirmed — incident moved to Rescue Monitoring");
  };

  const confirmInvalid = () => {
    if (!invalidModal || !reason.trim()) return;
    onUpdate(invalidModal.id, { status: "Invalid", invalidReason: reason });
    toast.show(`${shortenId(invalidModal.id)} marked invalid`);
    setInvalidModal(null);
    setReason("");
  };

  const assignedUnits = assigned
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean) as Unit[];

  const filteredMapUnits = units.filter((u) => {
    if (filterType !== "All" && u.type !== filterType) return false;
    if (showAvailableOnly && u.status !== "Available") return false;
    return true;
  });

  const filteredMapIncidents = incidents.filter((i) => {
    if (districtFilter && i.city !== districtFilter && i.barangay !== districtFilter) {
      return false;
    }
    return true;
  });

  const mapStats = {
    incidents: filteredMapIncidents.filter((i) =>
      ["New", "Waiting", "Dispatched", "In Progress"].includes(i.status),
    ).length,
    available: filteredMapUnits.filter((u) => u.status === "Available").length,
    deployed: filteredMapUnits.filter((u) =>
      ["On Route", "On Scene"].includes(u.status),
    ).length,
  };
  const riskStats = {
    total: barangayData.length,
    highRisk: barangayData.filter((b) => b.riskLevel === "High").length,
    mediumRisk: barangayData.filter((b) => b.riskLevel === "Medium").length,
  };

  const LEGEND_MON: [string, string][] = [
    ["Incident", "#c2440a"],
    ["Available", "#2e7d32"],
    ["On Route", "#1565c0"],
    ["On Scene", "#c62828"],
    ["Offline", "#9e9e9e"],
  ];
  const LEGEND_DIS: [string, string][] = [
    ["Field Volunteer", "#2E7D32"],
    ["Medic Volunteer", "#1976D2"],
    ["Logistics Volunteer", "#FFB300"],
  ];

  return (
    <div className="dp-map-page dp-fade-in">
      {/* Controls */}
      <div className="dp-map-controls">
        <div className="dp-map-mode-tabs">
          {(["monitoring", "dispatch", "risk-profile"] as const).map((m) => (
            <button
              key={m}
              className={`dp-map-tab ${mapMode === m ? "active" : ""}`}
              onClick={() => {
                if (m !== "dispatch") {
                  setSelInc(null);
                  setAssigned([]);
                  onClearDispatchTarget();
                }
                setMapMode(m);
              }}
            >
              {m === "monitoring"
                ? "Live Monitoring"
                : m === "dispatch"
                  ? "Dispatch Select"
                  : "Risk Profile"}
            </button>
          ))}
        </div>
        <div className="dp-map-legend">
          {(mapMode === "dispatch" ? LEGEND_DIS : LEGEND_MON).map(([l, c]) => (
            <div key={l} className="dp-legend-item">
              <span className="dp-legend-dot" style={{ background: c }} />
              {l}
            </div>
          ))}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <select
            className="dp-input"
            style={{
              width: "auto",
              padding: "0.4rem 0.7rem",
              fontSize: "0.8rem",
            }}
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
            }}
          >
            <option value="All">All Volunteers</option>
            <option value="FIELD">Field Volunteer</option>
            <option value="MEDIC">Medic Volunteer</option>
            <option value="LOGISTICS">Logistics Volunteer</option>
          </select>
          <select
            className="dp-input"
            style={{
              width: "auto",
              padding: "0.4rem 0.7rem",
              fontSize: "0.8rem",
            }}
            value={districtFilter ?? "ALL"}
            onChange={(e) => setDistrictFilter(e.target.value === "ALL" ? null : e.target.value)}
          >
            <option value="ALL">All districts</option>
            {barangayData.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}{b.province ? ` (${b.province})` : ""}
              </option>
            ))}
          </select>
          <label className="dp-map-toggle">
            <input
              type="checkbox"
              checked={showVulnerabilityHeatmap}
              onChange={(e) => setShowVulnerabilityHeatmap(e.target.checked)}
            />
            Vulnerability
          </label>
          <label className="dp-map-toggle">
            <input
              type="checkbox"
              checked={showPopulationDensity}
              onChange={(e) => setShowPopulationDensity(e.target.checked)}
            />
            Density
          </label>
          <label className="dp-map-toggle">
            <input
              type="checkbox"
              checked={showAvailableOnly}
              onChange={(e) => setShowAvailableOnly(e.target.checked)}
            />
            Available only
          </label>
          {mapMode === "dispatch" && selInc && assigned.length > 0 && (
            <button
              className="dp-btn dp-btn-green dp-btn-sm"
              disabled={isInactive}
              style={
                isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
              }
              onClick={confirmDispatch}
            >
              ✓ Confirm Dispatch
            </button>
          )}
          {mapMode !== "monitoring" && (
            <button
              className="dp-btn dp-btn-ghost dp-btn-sm"
              onClick={() => {
                setMapMode("monitoring");
                setSelInc(null);
                setAssigned([]);
                onClearDispatchTarget();
              }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      <div className="dp-map-kpis">
        <div className="dp-map-kpi">
          <span className="dp-map-kpi-label">Active Incidents</span>
          <span className="dp-map-kpi-value">{mapStats.incidents}</span>
        </div>
        <div className="dp-map-kpi">
          <span className="dp-map-kpi-label">Available Bayanihub Volunteers</span>
          <span className="dp-map-kpi-value">{mapStats.available}</span>
        </div>
        <div className="dp-map-kpi">
          <span className="dp-map-kpi-label">Deployed Volunteers</span>
          <span className="dp-map-kpi-value">{mapStats.deployed}</span>
        </div>
        {mapMode === "risk-profile" && (
          <>
            <div className="dp-map-kpi">
              <span className="dp-map-kpi-label">Cities Profiled</span>
              <span className="dp-map-kpi-value">{riskStats.total}</span>
            </div>
            <div className="dp-map-kpi">
              <span className="dp-map-kpi-label">High Risk Zones</span>
              <span className="dp-map-kpi-value">{riskStats.highRisk}</span>
            </div>
            <div className="dp-map-kpi">
              <span className="dp-map-kpi-label">Medium Risk Zones</span>
              <span className="dp-map-kpi-value">{riskStats.mediumRisk}</span>
            </div>
          </>
        )}
      </div>

      <div className="dp-map-body">
        {mapMode === "risk-profile" && (
          <div className="dp-dispatch-panel">
            <div className="dp-dispatch-panel-header">
              <div className="dp-dispatch-panel-title">Geographic Risk Profile</div>
              <div className="dp-dispatch-panel-id">
                {selectedBarangay?.name ?? "Select a barangay"}
              </div>
              <div className="dp-dispatch-panel-addr">
                Cluster 3 demographic and vulnerability layers
              </div>
            </div>
            {selectedBarangay ? (
              <div className="dp-dispatch-units">
                <div className="dp-risk-profile-grid">
                  <div className="dp-risk-profile-stat">
                    <span>City / Area</span>
                    <strong>{selectedBarangay.name}</strong>
                  </div>
                  {selectedBarangay.province && (
                    <div className="dp-risk-profile-stat">
                      <span>Province</span>
                      <strong>{selectedBarangay.province}</strong>
                    </div>
                  )}
                  {selectedBarangay.region && (
                    <div className="dp-risk-profile-stat">
                      <span>Region</span>
                      <strong>{selectedBarangay.region}</strong>
                    </div>
                  )}
                  <div className="dp-risk-profile-stat">
                    <span>Active Incidents</span>
                    <strong>
                      {incidents.filter(
                        (i) => !["Resolved", "Invalid"].includes(i.status) &&
                          i.location?.toLowerCase().includes(selectedBarangay.name.toLowerCase())
                      ).length}
                    </strong>
                  </div>
                </div>
                <div className={`dp-risk-profile-level ${selectedBarangay.riskLevel.toLowerCase()}`}>
                  {selectedBarangay.riskLevel} risk
                </div>
                <div className="dp-risk-profile-list">
                  {barangayData.map((b) => (
                    <button
                      key={b.name}
                      className={`dp-risk-zone-row ${selectedBarangay.name === b.name ? "active" : ""}`}
                      onClick={() => setSelectedBarangay(b)}
                    >
                      <span>{b.name}</span>
                      <strong>{b.riskLevel}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="dp-dispatch-panel-empty">
                {barangayData.length === 0
                  ? "Loading city data..."
                  : "Click a city marker on the map to inspect its risk profile."}
              </div>
            )}
          </div>
        )}
        {/* Dispatch side panel */}
        {/* Dispatch side panel */}
        {mapMode === "dispatch" && (
          <div className="dp-dispatch-panel">
            {!selInc ? (
              <div className="dp-dispatch-panel-empty">
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--d-text-sub)",
                    marginBottom: "1rem",
                    marginTop: "0.75rem",
                    padding: "0 0.75rem",
                  }}
                >
                  Select Incident for Volunteer Dispatch
                </div>
                <div
                  className="dp-dispatch-units"
                  style={{ flex: 1, overflowY: "auto", padding: "0 0.4rem" }}
                >
                  {incidents
                    .filter((i) => ["New", "Waiting"].includes(i.status))
                    .map((i) => (
                      <div
                        key={i.id}
                        className="dp-unit-card"
                        style={{
                          cursor: "pointer",
                          borderLeft: `4px solid ${priorityColor(i.priority)}`,
                          padding: "0.8rem",
                        }}
                        onClick={() => setSelInc(i)}
                      >
                        <div
                          className="dp-unit-card-name"
                          style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}
                        >
                          {i.type}
                        </div>
                        <div
                          className="dp-unit-card-info"
                          style={{ fontSize: "0.75rem", lineHeight: 1.5 }}
                        >
                          ID:{" "}
                          <strong style={{ fontFamily: "monospace" }}>
                            {shortenId(i.id)}
                          </strong>
                          <br />
                          Loc: {i.location}
                          <br />
                          Time: {i.timeReported}
                        </div>
                      </div>
                    ))}
                  {incidents.filter((i) =>
                    ["New", "Waiting"].includes(i.status),
                  ).length === 0 && (
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--d-text-sub)",
                          textAlign: "center",
                          marginTop: "2rem",
                        }}
                      >
                        No pending incidents.
                      </p>
                    )}
                </div>
              </div>
            ) : (
              <>
                <div className="dp-dispatch-panel-header">
                  <div className="dp-dispatch-panel-title">
                    Dispatching volunteers to
                  </div>
                  <div className="dp-dispatch-panel-id">
                    {shortenId(selInc.id)} — {selInc.type}
                  </div>
                  <div className="dp-dispatch-panel-addr">
                    {" "}
                    {selInc.address}
                  </div>
                  <button
                    className="dp-btn dp-btn-ghost dp-btn-xs"
                    style={{ marginTop: "0.5rem" }}
                    onClick={() => {
                      setSelInc(null);
                      setAssigned([]);
                    }}
                  >
                    Change Incident
                  </button>
                </div>
                <div className="dp-dispatch-units">
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--d-text-sub)",
                      marginBottom: "0.6rem",
                    }}
                  >
                    Available Bayanihub Volunteers
                  </div>
                  {filteredMapUnits
                    .filter((u) => u.status === "Available")
                    .map((u) => {
                      const isAss = assigned.includes(u.id);
                      const c = unitTypeColor(u.type);
                      return (
                        <div
                          key={u.id}
                          className={`dp-unit-card ${isAss ? "assigned" : ""}`}
                        >
                          <div className="dp-unit-card-name">
                            <span style={{ fontSize: "1rem" }}>
                              {UNIT_TYPE_ICON[u.type]}
                            </span>
                            {u.name}
                          </div>
                          <div className="dp-unit-card-info">
                            Network: <strong>Bayanihub</strong>
                            <br />
                            Station: {u.station}
                            <br />
                            Distance: <strong>{u.distance}</strong> · ETA:{" "}
                            <strong>{u.eta}</strong>
                            <br />
                            Volunteers: <strong>{u.personnel}</strong> - {" "}
                            {u.teamLeader}
                          </div>
                          <div className="dp-unit-card-actions">
                            <button
                              className="dp-btn dp-btn-ghost dp-btn-sm"
                              style={{ flex: 1 }}
                              disabled={isInactive}
                              onClick={() =>
                                !isInactive &&
                                toast.show(`Message sent to ${u.name}`)
                              }
                            >
                              Message
                            </button>
                            <button
                              className="dp-btn dp-btn-sm"
                              disabled={isInactive}
                              style={{
                                flex: 1,
                                background: isInactive
                                  ? "#ccc"
                                  : isAss
                                    ? "var(--d-green)"
                                    : c,
                                color: "#fff",
                                border: "none",
                                cursor: isInactive ? "not-allowed" : "pointer",
                              }}
                              onClick={() =>
                                !isInactive && (window as any).__dpAssign(u.id)
                              }
                            >
                              {isAss ? "✓ Assigned" : "Assign"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {assignedUnits.length > 0 && (
                  <div className="dp-dispatch-assigned">
                    <div className="dp-dispatch-assigned-title">
                      Assigned Volunteers ({assignedUnits.length})
                    </div>
                    <table className="dp-table" style={{ fontSize: "0.78rem" }}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Type</th>
                          <th>ETA</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedUnits.map((u) => (
                          <tr key={u.id}>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontWeight: 700,
                              }}
                            >
                              {u.id}
                            </td>
                            <td>{UNIT_TYPE_LABEL[u.type]}</td>
                            <td>{u.eta}</td>
                            <td
                              style={{
                                color: "var(--d-blue)",
                                fontWeight: 700,
                              }}
                            >
                              On Route
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      className="dp-btn dp-btn-orange"
                      disabled={isInactive}
                      style={{
                        width: "100%",
                        marginTop: "0.6rem",
                        justifyContent: "center",
                        opacity: isInactive ? 0.5 : 1,
                        cursor: isInactive ? "not-allowed" : "pointer",
                      }}
                      onClick={confirmDispatch}
                    >
                      Confirm Dispatch →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Map fills full height — no table below */}
        <div className="dp-map-container" style={{ flex: 1 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LiveMap
              mode={mapMode}
              incidents={filteredMapIncidents}
              units={filteredMapUnits}
              filterType={filterType}
              selectedIncident={selInc}
              assignedUnits={assigned}
              onUnitAssign={(uid) => (window as any).__dpAssign(uid)}
              onIncidentClick={(i) => setSelInc(i)}
              districtFilter={districtFilter}
              showVulnerabilityHeatmap={showVulnerabilityHeatmap || mapMode === "risk-profile"}
              showPopulationDensity={showPopulationDensity}
              onBarangayClick={setSelectedBarangay}
              barangayData={barangayData}
              height="100%"
            />
          </div>
        </div>
      </div>

      {/* Invalid modal */}
      {invalidModal && (
        <Modal
          title={`Mark ${shortenId(invalidModal.id)} as Invalid`}
          onClose={() => {
            setInvalidModal(null);
            setReason("");
          }}
          width={460}
        >
          <div
            style={{
              background: "var(--d-surface-low)",
              borderRadius: 8,
              padding: "0.75rem",
              marginBottom: "1rem",
              fontSize: "0.85rem",
              color: "var(--d-text-muted)",
            }}
          >
            <strong style={{ color: "var(--d-text)" }}>
              {invalidModal.type}
            </strong>{" "}
            at {invalidModal.address} — {invalidModal.timeReported}
          </div>
          <label className="dp-label">Reason *</label>
          <textarea
            className="dp-textarea"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate report, false alarm..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setInvalidModal(null);
                setReason("");
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-red"
              disabled={!reason.trim()}
              onClick={confirmInvalid}
            >
              Confirm Invalid
            </button>
          </div>
        </Modal>
      )}
      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESCUE MONITORING PAGE  (new nav page)
// Layout: left = incidents-in-progress list, right = map + ticket detail panel
// Map uses rescue mode; clicking incident zooms map + shows detail below
// ══════════════════════════════════════════════════════════════════════════════
function RescueMonitoringPage({
  incidents,
  units,
  onUpdate,
  status,
}: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
  status: "active" | "inactive";
}) {
  const [selInc, setSelInc] = useState<Incident | null>(null);
  const [suppressAutoSelect, setSuppressAutoSelect] = useState(false);
  const [backupModal, setBackupModal] = useState<Incident | null>(null);
  const [escalateModal, setEscalateModal] = useState<Incident | null>(null);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [mapKey, setMapKey] = useState(0);
  const [afterCalamityInc, setAfterCalamityInc] = useState<Incident | null>(
    null,
  );
  const [afterStep, setAfterStep] = useState<"confirm" | "verify" | "close">(
    "confirm",
  );
  const [safetyChecked, setSafetyChecked] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (window as any).__dpBackup = (id: string) => {
      onUpdate(id, { situationType: "Escalating" });
      toast.show(`Backup requested for ${id}`);
    };
    (window as any).__dpEscalate = (id: string) => {
      onUpdate(id, { situationType: "Critical" });
      toast.show(`${id} escalated`);
    };
    return () => {
      delete (window as any).__dpBackup;
      delete (window as any).__dpEscalate;
    };
  }, []);

  // Only show Dispatched + In Progress
  const activeInc = incidents.filter((i) =>
    ["Dispatched", "In Progress"].includes(i.status),
  );

  const handleSelect = (inc: Incident) => {
    setSelInc(inc);
  };

  const handleResolve = (inc: Incident) => {
    // Open after-calamity confirmation flow (After Calamity swimlane starts here)
    setAfterCalamityInc(inc);
    setAfterStep("confirm");
    setSafetyChecked(false);
  };

  const finaliseResolution = (inc: Incident) => {
    onUpdate(inc.id, {
      status: "Resolved",
      resolvedAt: new Date().toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    setAfterCalamityInc(null);
    setSelInc(null);
    setMapKey((k) => k + 1);
    toast.show(`${shortenId(inc.id)} marked as Resolved / Closed`);
  };

  const resolvedCount = incidents.filter((i) => i.status === "Resolved").length;
  const situationCounts = (
    ["Escalating", "Critical"] as SituationType[]
  ).map((s) => ({
    label: s,
    color: situationColor(s),
    count: activeInc.filter((i) => i.situationType === s).length,
  }));

  return (
    <div className="dp-incidents-page dp-rescue-monitoring-page dp-fade-in">
      <div className="dp-rescue-stats-grid">
        <div className="dp-rescue-kpi-card active">
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-icon">
              <Icon name="activity" size={18} />
            </span>
            <span className="dp-rescue-kpi-label">Active Response</span>
          </div>
          <div className="dp-rescue-kpi-value">{activeInc.length}</div>
          <div className="dp-rescue-kpi-sub">
            In progress and dispatched incidents
          </div>
        </div>
        <div className="dp-rescue-kpi-card resolved">
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-icon">
              <Icon name="check" size={18} />
            </span>
            <span className="dp-rescue-kpi-label">Closed Cases</span>
          </div>
          <div className="dp-rescue-kpi-value">{resolvedCount}</div>
          <div className="dp-rescue-kpi-sub">
            Resolved and documented
          </div>
        </div>
        {situationCounts.map((s) => (
          <div key={s.label} className="dp-rescue-kpi-card situation">
            <div className="dp-rescue-kpi-top">
              <span
                className="dp-rescue-kpi-dot"
                style={{
                  background: s.color,
                }}
              />
              <span className="dp-rescue-kpi-label">Situation {s.label}</span>
            </div>
            <div className="dp-rescue-kpi-value" style={{ color: s.color }}>
              {s.count}
            </div>
            <div className="dp-rescue-kpi-sub">
              {s.label === "Under Control"
                ? "Stable field conditions"
                : s.label === "Escalating"
                  ? "Needs close monitoring"
                  : "Immediate intervention"}
            </div>
          </div>
        ))}
      </div>

      <div className="dp-rescue-content-grid">
        <div className="dp-incidents-map">
          <div className="dp-map-header">
            <span className="dp-map-header-title">Rescue Monitoring</span>
          </div>
          <div style={{ flex: "1", minHeight: 0 }}>
            <LiveMap
              mode="rescue"
              incidents={incidents}
              units={units}
              selectedIncident={selInc}
              onIncidentClick={handleSelect}
              height="100%"
            />
          </div>
        </div>

        <div className="dp-incidents-list">
          <div className="dp-incidents-tab-row">
            <span
              style={{
                padding: "0.6rem 1rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--d-text-muted)",
              }}
            >
              Incidents in Progress
            </span>
          </div>

          <div className="dp-incidents-scroll">
            {activeInc.length === 0 ? (
              <div className="dp-empty">
                <div className="dp-empty-title">No active rescues</div>
                <div className="dp-empty-sub">
                  All incidents are resolved or pending
                </div>
              </div>
            ) : (
              activeInc.map((inc) => {
                const dotColor = situationColor(inc.situationType);
                const assignedNames = inc.assignedUnits
                  .map((uid) => units.find((u) => u.id === uid)?.name || uid)
                  .slice(0, 2);
                return (
                  <div
                    key={shortenId(inc.id)}
                    className={`dp-incident-list-item dp-rescue-incident-card ${selInc?.id === inc.id ? "active" : ""}`}
                    onClick={() => handleSelect(inc)}
                  >
                    <span className="dp-rescue-card-accent" style={{ background: dotColor }} />
                    <div className="dp-incident-list-body">
                      <div className="dp-rescue-card-top">
                        <div>
                          <div className="dp-incident-list-id">
                            {shortenId(inc.id)}
                          </div>
                          <div className="dp-incident-list-type">{inc.type}</div>
                        </div>
                        <div className="dp-rescue-card-time">
                          <strong>{inc.timeActive}</strong>
                          <span>min active</span>
                        </div>
                      </div>
                      <div className="dp-incident-list-loc dp-rescue-card-location">
                        {inc.location}, {inc.city}
                      </div>
                      <div className="dp-incident-list-meta dp-rescue-card-meta">
                        <Badge
                          label={inc.priority}
                          cls={priorityClass(inc.priority)}
                        />
                        <Badge
                          label={inc.situationType}
                          cls={situationClass(inc.situationType)}
                        />
                      </div>
                      {assignedNames.length > 0 && (
                        <div className="dp-rescue-card-units">
                          {assignedNames.join(", ")}
                          {inc.assignedUnits.length > assignedNames.length ? " +" : ""}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--d-text-sub)",
                          marginTop: "0.2rem",
                        }}
                      >
                        Active: {inc.timeActive} min · {inc.assignedUnits.length}{" "}
                        unit{inc.assignedUnits.length !== 1 ? "s" : ""} assigned
                      </div>
                    </div>
                    <span className="dp-incident-list-arrow">›</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Backup modal */}
      {backupModal && (
        <Modal
          title={`Request Backup — ${shortenId(backupModal.id)}`}
          onClose={() => {
            setBackupModal(null);
            setSelectedVolunteers([]);
          }}
          width={520}
        >
          <div
            className="dp-alert dp-alert-amber"
            style={{ marginBottom: "1rem" }}
          >
            {backupModal.type} · {backupModal.address} — Situation:{" "}
            {backupModal.situationType}
          </div>
          <label className="dp-label">Available Volunteers for Deployment</label>
          <div style={{ marginBottom: "1rem" }}>
            {(() => {
              const availableUnits = units.filter((u) => u.status === "Available" && !backupModal.assignedUnits.includes(u.id));
              if (availableUnits.length === 0) {
                return (
                  <div
                    style={{
                      padding: "1rem",
                      background: "var(--d-surface-low)",
                      borderRadius: "0.6rem",
                      textAlign: "center",
                      color: "var(--d-text-sub)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No available volunteers at this time. All units are deployed.
                  </div>
                );
              }
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "0.6rem",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {availableUnits.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() => {
                        setSelectedVolunteers((prev) =>
                          prev.includes(unit.id)
                            ? prev.filter((id) => id !== unit.id)
                            : [...prev, unit.id]
                        );
                      }}
                      style={{
                        padding: "0.85rem",
                        background: selectedVolunteers.includes(unit.id)
                          ? "var(--d-primary-light)"
                          : "var(--d-surface)",
                        border: selectedVolunteers.includes(unit.id)
                          ? "2px solid var(--d-primary)"
                          : "1px solid var(--d-border)",
                        borderRadius: "0.6rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVolunteers.includes(unit.id)}
                          onChange={() => {}}
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            {unit.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)" }}>
                            {unit.station}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#2e7d32",
                            background: "rgba(46, 125, 50, 0.1)",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "12px",
                          }}
                        >
                          {unit.status}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                          color: "var(--d-text-muted)",
                        }}
                      >
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>Personnel:</span> {unit.personnel}
                        </div>
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>Distance:</span> {unit.distance}
                        </div>
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>ETA:</span> {unit.eta}
                        </div>
                      </div>
                      <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--d-text-muted)" }}>
                        <strong>Leader:</strong> {unit.teamLeader} · <strong>Contact:</strong> {unit.contact}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setBackupModal(null);
                setSelectedVolunteers([]);
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-orange"
              disabled={selectedVolunteers.length === 0}
              onClick={() => {
                const selectedUnitNames = selectedVolunteers
                  .map((id) => units.find((u) => u.id === id)?.name)
                  .filter(Boolean)
                  .join(", ");
                onUpdate(backupModal.id, { 
                  situationType: "Escalating",
                  assignedUnits: [...new Set([...backupModal.assignedUnits, ...selectedVolunteers])]
                });
                toast.show(`Backup requested: ${selectedUnitNames}`);
                setBackupModal(null);
                setSelectedVolunteers([]);
              }}
            >
              Deploy Selected Volunteers ({selectedVolunteers.length})
            </button>
          </div>
        </Modal>
      )}

      {/* Escalate modal */}
      {escalateModal && (
        <Modal
          title={`High-Level Intervention — ${shortenId(escalateModal.id)}`}
          onClose={() => setEscalateModal(null)}
          width={460}
        >
          <div
            className="dp-alert dp-alert-red"
            style={{ marginBottom: "1rem" }}
          >
            You are escalating <strong>{shortenId(escalateModal.id)}</strong> to
            High-Level Intervention. This will flag the incident as Critical and
            notify senior command.
          </div>
          <div
            style={{
              background: "var(--d-surface-low)",
              borderRadius: 8,
              padding: "0.7rem",
              fontSize: "0.85rem",
              color: "var(--d-text-muted)",
            }}
          >
            {escalateModal.type} · {escalateModal.address}
            <br />
            Assigned: {escalateModal.assignedUnits.length} units
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
              marginTop: "1rem",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setEscalateModal(null)}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-red"
              onClick={() => {
                onUpdate(escalateModal.id, { situationType: "Critical" });
                toast.show(`${shortenId(escalateModal.id)} escalated`);
                setEscalateModal(null);
              }}
            >
              Confirm Escalation
            </button>
          </div>
        </Modal>
      )}

      {/* Incident Detail Modal */}
      {selInc && (
        <Modal
          title={`${shortenId(selInc.id)} — ${selInc.type}`}
          onClose={() => setSelInc(null)}
          width={820}
        >
          <div style={{ maxHeight: "75vh", overflowY: "auto" }}>
            <CompactIncidentDetails
              inc={selInc}
              units={units}
              onBackup={() => setBackupModal(selInc)}
              onEscalate={() => setEscalateModal(selInc)}
              onResolve={() => handleResolve(selInc)}
              onClose={() => setSelInc(null)}
              status={status}
            />
          </div>
        </Modal>
      )}

      {/* ── After Calamity Modal (Receive Confirmation → Verify Safety → Mark Resolved) ── */}
      {afterCalamityInc && (
        <Modal
          title={`After Calamity — ${shortenId(afterCalamityInc.id)}`}
          onClose={() => setAfterCalamityInc(null)}
          width={500}
        >
          {/* Step indicator */}
          <div
            style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem" }}
          >
            {(["confirm", "verify", "close"] as const).map((s, i) => {
              const labels = [
                "Receive Confirmation",
                "Verify Victim Safety",
                "Mark Resolved/Closed",
              ];
              const idx = ["confirm", "verify", "close"].indexOf(afterStep);
              const done = idx > i;
              const active = afterStep === s;
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.6rem",
                      borderRadius: "999px",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      textAlign: "center",
                      background: done
                        ? "var(--d-green)"
                        : active
                          ? "var(--d-primary)"
                          : "var(--d-surface-low)",
                      color: done || active ? "#fff" : "var(--d-text-sub)",
                      border:
                        done || active ? "none" : "1px solid var(--d-border)",
                    }}
                  >
                    {i + 1}. {labels[i]}
                  </div>
                  {i < 2 && (
                    <span
                      style={{ color: "var(--d-text-sub)", fontSize: "0.6rem" }}
                    >
                      ›
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Receive Rescue Complete Confirmation */}
          {afterStep === "confirm" && (
            <div>
              <div
                className="dp-alert dp-alert-green"
                style={{ marginBottom: "1.25rem" }}
              >
                <strong>Rescue Complete — Awaiting Confirmation</strong>
                <br />
                Field unit has signalled rescue operations are complete for{" "}
                {shortenId(afterCalamityInc.id)}.
              </div>
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "var(--d-surface-low)",
                  borderRadius: "0.75rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "0.4rem" }}>
                  {shortenId(afterCalamityInc.id)} — {afterCalamityInc.type}
                </div>
                <div
                  style={{
                    color: "var(--d-text-sub)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {afterCalamityInc.address}
                </div>
                <div>
                  Units:{" "}
                  <strong>
                    {afterCalamityInc.assignedUnits.join(", ") || "N/A"}
                  </strong>
                </div>
                <div
                  style={{ marginTop: "0.4rem", color: "var(--d-text-sub)" }}
                >
                  Confirmation received at:{" "}
                  <strong style={{ color: "var(--d-text)" }}>
                    {new Date().toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="dp-btn dp-btn-primary"
                  onClick={() => setAfterStep("verify")}
                >
                  ✓ Confirm Receipt → Verify Safety
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Verify Victim Safety */}
          {afterStep === "verify" && (
            <div>
              <div
                className="dp-alert dp-alert-blue"
                style={{ marginBottom: "1.25rem" }}
              >
                Confirm that all rescued persons are safe and handed off to
                appropriate care.
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginBottom: "1.25rem",
                }}
              >
                {[
                  { label: "All persons accounted for", done: true },
                  { label: "Transferred to medical care / family", done: true },
                  { label: "Identity documented", done: true },
                  { label: "Families notified", done: safetyChecked },
                ].map((chk, i) => (
                  <div
                    key={i}
                    onClick={() => i === 3 && setSafetyChecked((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.7rem 0.9rem",
                      background: chk.done
                        ? "var(--d-green-bg)"
                        : "var(--d-surface-low)",
                      borderRadius: "0.65rem",
                      cursor: i === 3 ? "pointer" : "default",
                      border:
                        i === 3
                          ? "1px dashed var(--d-border)"
                          : "1px solid transparent",
                    }}
                  >
                    <span
                      style={{
                        color: chk.done
                          ? "var(--d-green)"
                          : "var(--d-text-sub)",
                        fontWeight: 800,
                      }}
                    >
                      {chk.done ? "✓" : "○"}
                    </span>
                    <span style={{ fontSize: "0.82rem" }}>{chk.label}</span>
                    {i === 3 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.7rem",
                          color: "var(--d-text-sub)",
                        }}
                      >
                        (tap to confirm)
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="dp-btn dp-btn-ghost"
                  onClick={() => setAfterStep("confirm")}
                >
                  ← Back
                </button>
                <button
                  className="dp-btn dp-btn-green"
                  disabled={!safetyChecked}
                  onClick={() => setAfterStep("close")}
                >
                  ✓ All Victims Safe → Close Ticket
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Mark as Resolved / Closed */}
          {afterStep === "close" && (
            <div>
              <div
                className="dp-alert dp-alert-green"
                style={{ marginBottom: "1.25rem" }}
              >
                <strong>Victim safety verified.</strong> Ready to mark{" "}
                {shortenId(afterCalamityInc.id)} as Resolved / Closed.
              </div>
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "var(--d-surface-low)",
                  borderRadius: "0.75rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>
                  Incident Summary
                </div>
                <div
                  style={{ color: "var(--d-text-sub)", marginBottom: "0.2rem" }}
                >
                  {shortenId(afterCalamityInc.id)} · {afterCalamityInc.type}
                </div>
                <div
                  style={{ color: "var(--d-text-sub)", marginBottom: "0.2rem" }}
                >
                  {afterCalamityInc.address}
                </div>
                <div style={{ color: "var(--d-text-sub)" }}>
                  Units: {afterCalamityInc.assignedUnits.join(", ") || "N/A"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="dp-btn dp-btn-ghost"
                  onClick={() => setAfterStep("verify")}
                >
                  ← Back
                </button>
                <button
                  className="dp-btn dp-btn-green"
                  onClick={() => finaliseResolution(afterCalamityInc)}
                >
                  ✓ Mark as Resolved / Closed
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// Compact incident details — optimized for modal display
function CompactIncidentDetails({
  inc,
  units,
  onBackup,
  onEscalate,
  onResolve,
  onClose,
  status,
}: {
  inc: Incident;
  units: Unit[];
  onBackup: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onClose: () => void;
  status: "active" | "inactive";
}) {
  const isInactive = status === "inactive";
  const assigned = inc.assignedUnits
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean) as Unit[];
  const sc = situationColor(inc.situationType);

  // Victims
  const victimData = [
    { name: "Victim 1", condition: "Critical", color: "#c62828", status: "Trapped" },
    { name: "Victim 2", condition: "Injured", color: "#c77700", status: "Awaiting rescue" },
    { name: "Victim 3", condition: "Safe", color: "#2e7d32", status: "Evacuated" },
  ].slice(0, inc.category === "MEDIC" ? 2 : 3);

  // Hospitals
  const hospitals = [
    { name: "UERM Medical Center", dist: "1.2 km", eta: "4 mins", cap: "Available", capColor: "#2e7d32" },
    { name: "UST Hospital", dist: "2.1 km", eta: "7 mins", cap: "Available", capColor: "#2e7d32" },
  ];

  return (
    <div style={{ background: "var(--d-bg)", borderRadius: "0.75rem" }}>
      {/* Action Buttons — Top Priority */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.8rem",
          padding: "1rem",
          background: "var(--d-surface-low)",
          borderRadius: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        {inc.situationType !== "Critical" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
            <button
              className="dp-btn dp-btn-sm dp-btn-outline-amber"
              disabled={isInactive}
              style={{ fontSize: "0.85rem", fontWeight: 600, opacity: isInactive ? 0.5 : 1, padding: "0.6rem 0.8rem", textAlign: "center", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={onBackup}
            >
              Request Backup
            </button>
            <div style={{ fontSize: "0.65rem", color: "var(--d-text-sub)", textAlign: "center" }}>
              Deploy additional units
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
          <button
            className="dp-btn dp-btn-sm dp-btn-outline-red"
            disabled={isInactive}
            style={{ fontSize: "0.85rem", fontWeight: 600, opacity: isInactive ? 0.5 : 1, padding: "0.6rem 0.8rem", textAlign: "center", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={onEscalate}
          >
            Escalate Priority
          </button>
          <div style={{ fontSize: "0.65rem", color: "var(--d-text-sub)", textAlign: "center" }}>
            Alert command center
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
          <button
            className="dp-btn dp-btn-sm dp-btn-outline-green"
            disabled={isInactive}
            style={{ fontSize: "0.85rem", fontWeight: 600, opacity: isInactive ? 0.5 : 1, padding: "0.6rem 0.8rem", textAlign: "center", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={onResolve}
          >
            Close Incident
          </button>
          <div style={{ fontSize: "0.65rem", color: "var(--d-text-sub)", textAlign: "center" }}>
            Mark as resolved
          </div>
        </div>
      </div>

      {/* Quick Status Indicators */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.6rem",
          marginBottom: "1rem",
        }}
      >
        {[
          { label: "Situation", val: inc.situationType, color: sc },
          { label: "Active", val: `${inc.timeActive} min`, color: "var(--d-text)" },
          { label: "Volunteers", val: assigned.length.toString(), color: "var(--d-text)" },
          { label: "Victims", val: victimData.length.toString(), color: "#c62828" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "0.75rem",
              background: "var(--d-surface)",
              borderRadius: "0.6rem",
              textAlign: "center",
              border: "1px solid var(--d-border)",
            }}
          >
            <div style={{ fontSize: "0.65rem", color: "var(--d-text-sub)", marginBottom: "0.3rem" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Location & Critical Details */}
      <div
        style={{
          padding: "0.85rem",
          background: "var(--d-surface)",
          borderRadius: "0.6rem",
          marginBottom: "1rem",
          border: "1px solid var(--d-border)",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)", marginBottom: "0.4rem", fontWeight: 700 }}>
          LOCATION & DETAILS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {[
            ["Incident", inc.type],
            ["Address", inc.address + ", " + inc.city],
            ["Time Reported", `${inc.dateReported} ${inc.timeReported}`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
              <span style={{ minWidth: 70, color: "var(--d-text-sub)", flexShrink: 0, fontWeight: 700 }}>
                {l}
              </span>
              <span style={{ color: "var(--d-text)", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Victims Status */}
      {victimData.length > 0 && (
        <div
          style={{
            padding: "0.85rem",
            background: "var(--d-surface)",
            borderRadius: "0.6rem",
            marginBottom: "1rem",
            border: "1px solid var(--d-border)",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)", marginBottom: "0.5rem", fontWeight: 700 }}>
            VICTIM STATUS ({victimData.length})
          </div>
          {victimData.map((v, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: v.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--d-text)" }}>{v.name}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--d-text-sub)", marginLeft: "0.5rem" }}>
                  {v.condition} · {v.status}
                </span>
              </div>
              {hospitals[0] && (
                <div style={{ fontSize: "0.7rem", color: "var(--d-text-sub)", textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{hospitals[0].name}</div>
                  <div>{hospitals[0].dist} · {hospitals[0].eta}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assigned Teams */}
      {assigned.length > 0 && (
        <div
          style={{
            padding: "0.85rem",
            background: "var(--d-surface)",
            borderRadius: "0.6rem",
            marginBottom: "1rem",
            border: "1px solid var(--d-border)",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)", marginBottom: "0.5rem", fontWeight: 700 }}>
            ASSIGNED VOLUNTEERS ({assigned.length})
          </div>
          {assigned.map((u) => {
            const uc = unitTypeColor(u.type);
            return (
              <div
                key={u.id}
                style={{
                  padding: "0.6rem",
                  background: "var(--d-surface-low)",
                  borderLeft: `3px solid ${uc}`,
                  borderRadius: 6,
                  marginBottom: "0.5rem",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "0.2rem" }}>
                  {UNIT_TYPE_ICON[u.type]} {u.name}
                </div>
                <div style={{ color: "var(--d-text-sub)", fontSize: "0.75rem" }}>
                  Leader: {u.teamLeader} · {u.personnel} personnel · {u.station}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Description */}
      {inc.description && (
        <div
          style={{
            padding: "0.85rem",
            background: "var(--d-surface)",
            borderRadius: "0.6rem",
            marginBottom: "1rem",
            border: "1px solid var(--d-border)",
            fontSize: "0.8rem",
            color: "var(--d-text)",
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)", marginBottom: "0.4rem", fontWeight: 700 }}>
            DESCRIPTION
          </div>
          {inc.description}
        </div>
      )}
    </div>
  );
}

// Rescue detail panel — comprehensive real-time rescue monitoring view
function RescueDetailPanel({
  inc,
  units,
  onBackup,
  onEscalate,
  onResolve,
  onClose,
  status,
  dispatcherName = "Dispatcher",
}: {
  inc: Incident;
  units: Unit[];
  onBackup: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onClose: () => void;
  status: "active" | "inactive";
  dispatcherName?: string;
}) {
  const isInactive = status === "inactive";
  const assigned = inc.assignedUnits
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean) as Unit[];
  const sc = situationColor(inc.situationType);

  // ── Mock real-time data derived from incident ──────────────────────────────
  const now = new Date();
  const dispatchTime = inc.dispatchedAt || "09:23 AM";

  // Victims derived from description keywords
  const victimData = [
    {
      name: "Victim 1",
      condition: "Critical",
      color: "#c62828",
      status: "Trapped",
    },
    {
      name: "Victim 2",
      condition: "Injured",
      color: "#c77700",
      status: "Awaiting rescue",
    },
    {
      name: "Victim 3",
      condition: "Safe",
      color: "#2e7d32",
      status: "Evacuated",
    },
  ].slice(0, inc.category === "MEDIC" ? 2 : 3);

  // Timeline entries
  const timeline = [
    {
      time: inc.timeReported,
      msg: `Incident reported — ${inc.type}`,
      actor: inc.reporter,
      color: "#c62828",
      icon: "!",
    },
    {
      time: dispatchTime,
      msg: `Dispatch confirmed. ${assigned.length} volunteer(s) deployed.`,
      actor: "Dispatcher DS",
      color: "#c2440a",
      icon: "",
    },
    ...(assigned.length > 0
      ? [
        {
          time: addMins(dispatchTime, 2),
          msg: `${assigned[0]?.name} en route to scene.`,
          actor: assigned[0]?.teamLeader || "",
          color: "#1565c0",
          icon: "→",
        },
      ]
      : []),
    ...(inc.timeActive > 5
      ? [
        {
          time: addMins(dispatchTime, 5),
          msg: "First responders arrived on scene.",
          actor: assigned[0]?.name || "Unit",
          color: "#2e7d32",
          icon: "✓",
        },
      ]
      : []),
    ...(inc.timeActive > 10
      ? [
        {
          time: addMins(dispatchTime, 8),
          msg: `Situation assessed: ${inc.situationType}. Rescue operations ongoing.`,
          actor: "Field Lead",
          color: situationColor(inc.situationType),
          icon: "●",
        },
      ]
      : []),
    ...(inc.notes
      ? [
        {
          time: addMins(dispatchTime, inc.timeActive - 1),
          msg: inc.notes,
          actor: "Field Officer",
          color: "#6a1b9a",
          icon: "",
        },
      ]
      : []),
  ];

  // Comms feed
  const comms = [
    {
      type: "radio",
      time: addMins(dispatchTime, 1),
      from: assigned[0]?.teamLeader || "Unit Lead",
      msg: `En route to ${inc.location}. ETA ${assigned[0]?.eta || "5 mins"}.`,
    },
    {
      type: "update",
      time: addMins(dispatchTime, 3),
      from: "Dispatch Center",
      msg: `${shortenId(inc.id)} acknowledged. All volunteers proceed to ${inc.address}.`,
    },
    ...(inc.timeActive > 8
      ? [
        {
          type: "radio",
          time: addMins(dispatchTime, 6),
          from: assigned[0]?.teamLeader || "Unit Lead",
          msg: "On scene. Assessing situation. Requesting more details.",
        },
      ]
      : []),
    ...(inc.situationType === "Critical"
      ? [
          {
            type: "alert",
            time: addMins(dispatchTime, 8),
            from: "System Alert",
            msg: `Situation escalated to CRITICAL at ${inc.location}. All nearby volunteers on standby.`,
          },
        ]
      : []),
    ...(inc.timeActive > 12
      ? [
        {
          type: "update",
          time: addMins(dispatchTime, 10),
          from: "Field Lead",
          msg: `Scene secured. ${victimData.filter((v) => v.condition !== "Safe").length} victim(s) still require assistance.`,
        },
      ]
      : []),
  ];

  // Nearby hospitals
  const hospitals = [
    {
      name: "UERM Medical Center",
      dist: "1.2 km",
      eta: "4 mins",
      cap: "Available",
      capColor: "#2e7d32",
    },
    {
      name: "UST Hospital",
      dist: "2.1 km",
      eta: "7 mins",
      cap: "Available",
      capColor: "#2e7d32",
    },
    {
      name: "Chinese General Hosp.",
      dist: "2.8 km",
      eta: "9 mins",
      cap: "Near Capacity",
      capColor: "#c77700",
    },
    {
      name: "Ospital ng Sampaloc",
      dist: "0.8 km",
      eta: "3 mins",
      cap: "Available",
      capColor: "#2e7d32",
    },
  ];

  // Resources on scene
  const resources = [
    ...assigned
      .filter((u) => u.type === "FIELD")
      .map((u) => ({
        icon: "",
        name: u.name,
        status: "On Scene",
        detail: `${u.personnel} firefighters · Hydraulic tools, breathing apparatus`,
        color: "#2E7D32",
      })),
    ...assigned
      .filter((u) => u.type === "MEDIC")
      .map((u) => ({
        icon: "",
        name: u.name,
        status: "On Scene",
        detail: `${u.personnel} paramedics · AED, trauma kit, oxygen`,
        color: "#1976D2",
      })),
    ...assigned
      .filter((u) => u.type === "LOGISTICS")
      .map((u) => ({
        icon: "",
        name: u.name,
        status: "On Scene",
        detail: `${u.personnel} crew · Logistics & relief support`,
        color: "#FFB300",
      })),
  ];

  // Risk & Environment
  const risks = [
    {
      icon: "",
      label: "Weather",
      val: "Partly cloudy, 28°C · Wind 12 km/h NW · Visibility Good",
    },
    ...(inc.category === "FIELD"
      ? [
        {
          icon: "",
          label: "Fire Spread Risk",
          val: "Moderate — Wind pushing northeast. Adjacent structures at risk if not contained within 15 mins.",
        },
        {
          icon: "",
          label: "Structural Stability",
          val: "Unknown — 3-storey building. Upper floors may be compromised. Entry only with full PPE.",
        },
      ]
      : []),
    ...(inc.category === "Other"
      ? [
        {
          icon: "",
          label: "Flood Risk",
          val: "Rising water levels on main road. Evacuation routes may be blocked soon.",
        },
      ]
      : []),
    {
      icon: "",
      label: "Hazards",
      val: "Possible live electrical wires. Gas line proximity not confirmed. Keep 10m clearance.",
    },
    {
      icon: "",
      label: "Crowd / Access",
      val: "Bystanders present. Road access partially blocked. Police establishing perimeter.",
    },
  ];

  return (
    <div className="dp-fade-in" style={{ background: "var(--d-bg)" }}>
      {/* ── Sticky action header ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--d-surface)",
          borderBottom: "1px solid var(--d-border)",
          padding: "0.75rem 1.2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "1rem",
              fontWeight: 900,
              color: "var(--d-primary)",
            }}
          >
            {shortenId(inc.id)}
          </span>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 800,
              color: "var(--d-text)",
            }}
          >
            {inc.type}
          </span>
          <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
          <Badge label={inc.status} cls={statusClass(inc.status)} />
          <Badge
            label={inc.situationType}
            cls={situationClass(inc.situationType)}
          />
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {inc.situationType !== "Critical" && (
            <button
              className="dp-btn dp-btn-sm dp-btn-outline-amber"
              disabled={isInactive}
              style={
                isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
              }
              onClick={onBackup}
            >
              + Request Backup
            </button>
          )}
          <button
            className="dp-btn dp-btn-sm dp-btn-outline-red"
            disabled={isInactive}
            style={
              isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
            }
            onClick={onEscalate}
          >
            High-Level Intervention
          </button>
          <button
            className="dp-btn dp-btn-sm dp-btn-outline-green"
            disabled={isInactive}
            style={
              isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
            }
            onClick={onResolve}
          >
            Mark Resolved
          </button>
          <button className="dp-btn dp-btn-sm dp-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* ── Situation status bar ── */}
      <div
        style={{
          padding: "0.8rem 1.2rem",
          background: `${sc}0d`,
          borderBottom: `1px solid ${sc}25`,
        }}
      >
        <div className="dp-rescue-stat-row">
          {[
            { label: "Situation", val: inc.situationType, color: sc, sub: "" },
            {
              label: "Time Active",
              val: `${inc.timeActive} min`,
              color: "var(--d-text)",
              sub: `Reported ${inc.timeReported}`,
            },
            {
              label: "Volunteers On Scene",
              val: `${assigned.length}`,
              color: "var(--d-text)",
              sub: assigned.map((u) => u.type).join(", ") || "None",
            },
            {
              label: "Victims",
              val: `${victimData.length}`,
              color: "var(--d-red)",
              sub: `${victimData.filter((v) => v.condition === "Critical").length} critical`,
            },
            {
              label: "Dispatched At",
              val: dispatchTime,
              color: "var(--d-text)",
              sub: `By ${dispatcherName}`,
            },
          ].map((s) => (
            <div key={s.label} className="dp-rescue-stat-box">
              <div className="dp-rescue-stat-box-label">{s.label}</div>
              <div
                className="dp-rescue-stat-box-val"
                style={{ color: s.color }}
              >
                {s.val}
              </div>
              {s.sub && <div className="dp-rescue-stat-box-sub">{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column detail grid ── */}
      <div className="dp-rescue-detail-wrap">
        {/* LEFT COLUMN */}
        <div className="dp-rescue-detail-col">
          {/* 1. Location & Ticket Info */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Location & Ticket Info</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              {[
                ["Ticket ID", inc.id],
                ["Type", inc.type],
                ["Address", inc.address],
                ["Barangay", inc.barangay],
                ["City", inc.city],
                ["Reporter", `${inc.reporter} · ${inc.reporterPhone}`],
                ["Date", `${inc.dateReported} ${inc.timeReported}`],
              ].map(([l, v]) => (
                <div
                  key={l}
                  style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}
                >
                  <span
                    style={{
                      minWidth: 72,
                      color: "var(--d-text-sub)",
                      flexShrink: 0,
                    }}
                  >
                    {l}
                  </span>
                  <span
                    style={{
                      color: "var(--d-text)",
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
            {inc.description && (
              <div
                style={{
                  marginTop: "0.6rem",
                  padding: "0.6rem 0.75rem",
                  background: "var(--d-surface)",
                  border: "1px solid var(--d-border)",
                  borderRadius: 7,
                  fontSize: "0.8rem",
                  color: "var(--d-text)",
                  lineHeight: 1.55,
                }}
              >
                {inc.description}
              </div>
            )}
          </div>

          {/* 2. Status of Victims */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">
              Status of Victims ({victimData.length})
            </div>
            {victimData.map((v, i) => (
              <div key={i} className="dp-victim-card">
                <span
                  className="dp-victim-status-dot"
                  style={{ background: v.color }}
                />
                <span className="dp-victim-name">{v.name}</span>
                <span className="dp-victim-cond" style={{ color: v.color }}>
                  {v.condition}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--d-text-sub)",
                    marginLeft: "0.3rem",
                  }}
                >
                  · {v.status}
                </span>
              </div>
            ))}
            <div
              style={{
                marginTop: "0.4rem",
                padding: "0.5rem 0.65rem",
                background: "var(--d-surface-low)",
                borderRadius: 7,
                fontSize: "0.75rem",
                color: "var(--d-text-muted)",
              }}
            >
              Nearest available hospital:{" "}
              <strong style={{ color: "var(--d-text)" }}>
                {hospitals[0].name}
              </strong>{" "}
              — {hospitals[0].dist} · ETA {hospitals[0].eta}
            </div>
          </div>

          {/* 3. Team Updates */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Team Updates</div>
            {assigned.length === 0 ? (
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--d-text-sub)",
                  padding: "0.5rem 0",
                }}
              >
                No volunteers currently assigned.
              </div>
            ) : (
              assigned.map((u) => {
                const uc = unitTypeColor(u.type);
                return (
                  <div
                    key={u.id}
                    style={{
                      background: "var(--d-surface)",
                      border: `1px solid var(--d-border)`,
                      borderLeft: `3px solid ${uc}`,
                      borderRadius: 8,
                      padding: "0.65rem 0.8rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span>{UNIT_TYPE_ICON[u.type]}</span>
                        {u.name}
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          color: "#1565c0",
                          background: "rgba(21,101,192,0.1)",
                          padding: "0.15rem 0.5rem",
                          borderRadius: 20,
                        }}
                      >
                        On Scene
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--d-text-muted)",
                        lineHeight: 1.5,
                      }}
                    >
                      Leader:{" "}
                      <strong style={{ color: "var(--d-text)" }}>
                        {u.teamLeader}
                      </strong>{" "}
                      · {u.contact}
                      <br />
                      Station: {u.station} · Crew: {u.personnel} · ETA was{" "}
                      {u.eta}
                    </div>
                    <div
                      style={{
                        marginTop: "0.3rem",
                        fontSize: "0.72rem",
                        color: "var(--d-primary)",
                        fontWeight: 700,
                      }}
                    >
                      Activity: Rescue operations in progress
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 7. Risk & Environment */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Risk & Environment</div>
            {risks.map((r, i) => (
              <div key={i} className="dp-risk-item">
                <span className="dp-risk-icon">{r.icon}</span>
                <div>
                  <div className="dp-risk-label">{r.label}</div>
                  <div className="dp-risk-val">{r.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="dp-rescue-detail-col">
          {/* 4. Communication Feed */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Communication Feed</div>
            {comms.map((c, i) => (
              <div key={i} className={`dp-comms-item ${c.type}`}>
                <div className="dp-comms-meta">
                  <span style={{ fontWeight: 700 }}>{c.from}</span>
                  <span>·</span>
                  <span>{c.time}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      textTransform: "uppercase",
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {c.type}
                  </span>
                </div>
                <div className="dp-comms-text">{c.msg}</div>
              </div>
            ))}
          </div>

          {/* 5. Resources & Equipment */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">
              Resources & Equipment on Scene
            </div>
            {resources.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--d-text-sub)" }}>
                No resources deployed yet.
              </div>
            ) : (
              resources.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.55rem",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid rgba(191,182,162,0.12)",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
                    {r.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          color: "var(--d-text)",
                        }}
                      >
                        {r.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: r.color,
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.73rem",
                        color: "var(--d-text-muted)",
                        marginTop: "0.1rem",
                      }}
                    >
                      {r.detail}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Nearby hospitals */}
            <div style={{ marginTop: "0.8rem" }}>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--d-text-sub)",
                  marginBottom: "0.4rem",
                }}
              >
                Nearest Hospitals
              </div>
              {hospitals.map((h, i) => (
                <div key={i} className="dp-hospital-row">
                  <span className="dp-hospital-name">{h.name}</span>
                  <span className="dp-hospital-dist">
                    {h.dist} · {h.eta}
                  </span>
                  <span
                    className="dp-hospital-cap"
                    style={{ color: h.capColor }}
                  >
                    {h.cap}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Timeline / Activity Log */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">
              Timeline / Activity Log
            </div>
            <div className="dp-timeline">
              {timeline.map((t, i) => (
                <div key={i} className="dp-timeline-item">
                  <div
                    className="dp-timeline-dot"
                    style={{ background: `${t.color}20`, color: t.color }}
                  >
                    {t.icon}
                  </div>
                  <div className="dp-timeline-body">
                    <div className="dp-timeline-time">{t.time}</div>
                    <div className="dp-timeline-msg">{t.msg}</div>
                    {t.actor && (
                      <div className="dp-timeline-actor">{t.actor}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Decision Controls */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Decision Controls</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
              }}
            >
              <button
                className="dp-btn dp-btn-outline-amber"
                style={{
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "0.15rem",
                  height: 60,
                  textAlign: "center",
                  opacity: isInactive ? 0.5 : 1,
                  cursor: isInactive ? "not-allowed" : "pointer",
                }}
                disabled={isInactive}
                onClick={onBackup}
              >
                <span style={{ fontSize: "1.1rem" }}>+</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                  Request Backup
                </span>
              </button>
              <button
                className="dp-btn dp-btn-outline-red"
                style={{
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "0.15rem",
                  height: 60,
                  textAlign: "center",
                  opacity: isInactive ? 0.5 : 1,
                  cursor: isInactive ? "not-allowed" : "pointer",
                }}
                disabled={isInactive}
                onClick={onEscalate}
              >
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                  High-Level Intervention
                </span>
              </button>
              <button
                className="dp-btn dp-btn-outline-blue"
                style={{
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "0.15rem",
                  height: 60,
                  textAlign: "center",
                  opacity: isInactive ? 0.5 : 1,
                  cursor: isInactive ? "not-allowed" : "pointer",
                }}
                disabled={isInactive}
                onClick={() => { }}
              >
                <span style={{ fontSize: "1.1rem" }}></span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                  Redirect Teams
                </span>
              </button>
              <button
                className="dp-btn dp-btn-outline-orange"
                style={{
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "0.15rem",
                  height: 60,
                  textAlign: "center",
                  opacity: isInactive ? 0.5 : 1,
                  cursor: isInactive ? "not-allowed" : "pointer",
                }}
                disabled={isInactive}
                onClick={() => { }}
              >
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                  Send Alert / Instruction
                </span>
              </button>
            </div>
            <button
              className="dp-btn dp-btn-outline-green"
              style={{
                width: "100%",
                justifyContent: "center",
                marginTop: "0.5rem",
                height: 44,
                opacity: isInactive ? 0.5 : 1,
                cursor: isInactive ? "not-allowed" : "pointer",
              }}
              disabled={isInactive}
              onClick={onResolve}
            >
              Mark Incident as Resolved
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INCIDENTS PAGE  (list only — no map; all incidents with filters + expanded ticket)
// ══════════════════════════════════════════════════════════════════════════════
function IncidentsPage({
  incidents,
  units,
  onUpdate,
  onDispatch,
  status,
}: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
  onDispatch: (inc: Incident) => void;
  status: "active" | "inactive";
}) {
  type IncidentQueueFilter = "All" | string; // "All" or specific incident type from database

  const VISIBLE_INCIDENT_LIMIT = 6;
  const [queueFilter, setQueueFilter] = useState<IncidentQueueFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | "All">("All");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "All">("All");
  const [searchText, setSearchText] = useState("");
  const [selInc, setSelInc] = useState<Incident | null>(null);
  const [suppressAutoSelect, setSuppressAutoSelect] = useState(false);
  const [backupModal, setBackupModal] = useState<Incident | null>(null);
  const [escalateModal, setEscalateModal] = useState<Incident | null>(null);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const toast = useToast();

  // Get unique incident types from the database
  const uniqueIncidentTypes = Array.from(new Set(incidents.map((i) => i.type))).sort();
  
  const incidentTypeOptions = [
    { value: "All", label: "All incidents" },
    ...uniqueIncidentTypes.map((type) => ({ value: type, label: type })),
  ];

  const clearIncidentFilters = () => {
    setSearchText("");
    setQueueFilter("All");
    setPriorityFilter("All");
    setStatusFilter("All");
  };

  const inProgress = incidents.filter((i) =>
    ["In Progress", "Dispatched"].includes(i.status),
  );
  const completed = incidents.filter((i) => i.status === "Resolved");
  const queued = incidents.filter((i) => ["New", "Waiting"].includes(i.status));

  const filtered = incidents.filter((i) => {
    // text search (id, type, location, city, reporter)
    if (searchText.trim()) {
      const s = searchText.trim().toLowerCase();
      if (!(`${i.id} ${i.type} ${i.location} ${i.city} ${i.reporter}`.toLowerCase().includes(s))) return false;
    }
    if (priorityFilter !== "All" && i.priority !== priorityFilter) return false;
    if (statusFilter !== "All" && i.status !== statusFilter) return false;
    // Filter by incident type from database
    if (queueFilter !== "All" && i.type !== queueFilter) return false;
    return true;
  });

  const severityRank: Record<IncidentPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const filteredSorted = [...filtered].sort((a, b) => {
    const sevDiff = severityRank[b.priority] - severityRank[a.priority];
    if (sevDiff !== 0) return sevDiff;
    return b.id.localeCompare(a.id);
  });
  const visibleIncidents = filteredSorted.slice(0, VISIBLE_INCIDENT_LIMIT);

  useEffect(() => {
    if (filteredSorted.length === 0) {
      if (selInc) setSelInc(null);
      return;
    }
    // If current selected incident is missing from the filtered list, pick the first.
    if (selInc && !filteredSorted.some((i) => i.id === selInc.id)) {
      setSelInc(filteredSorted[0]);
      return;
    }
    // Auto-select first incident only when not suppressed and user is not actively filtering by text.
    if (!selInc && !suppressAutoSelect && !searchText.trim()) {
      setSelInc(filteredSorted[0]);
    }
  }, [filteredSorted.length, selInc?.id, suppressAutoSelect, searchText]);

  // Reset suppression when user interacts with filters.
  useEffect(() => {
    if (suppressAutoSelect) setSuppressAutoSelect(false);
  }, [queueFilter, priorityFilter, statusFilter]);

  const incidentStats = [
    {
      label: "In Progress",
      value: inProgress.length,
      color: "var(--d-primary)",
      bgColor: "var(--d-primary-light)",
      icon: "activity" as IconName,
      desc: "Ongoing responses",
    },
    {
      label: "Completed",
      value: completed.length,
      color: "var(--d-blue)",
      bgColor: "var(--d-blue-bg)",
      icon: "check" as IconName,
      desc: "Resolved incidents",
    },
    {
      label: "Queued",
      value: queued.length,
      color: "var(--d-text-sub)",
      bgColor: "var(--d-surface-mid)",
      icon: "clock" as IconName,
      desc: "Awaiting triage",
    },
    {
      label: "Critical",
      value: filtered.filter((i) => i.priority === "CRITICAL").length,
      color: "var(--d-red)",
      bgColor: "var(--d-red-bg)",
      icon: "warning" as IconName,
      desc: "Needs immediate action",
    },
    {
      label: "High",
      value: filtered.filter((i) => i.priority === "HIGH").length,
      color: "var(--d-amber)",
      bgColor: "var(--d-amber-bg)",
      icon: "ticket" as IconName,
      desc: "Priority queue",
    },
    {
      label: "Moderate",
      value: filtered.filter((i) => i.priority === "MEDIUM").length,
      color: "var(--d-green)",
      bgColor: "var(--d-green-bg)",
      icon: "shield" as IconName,
      desc: "Standard priority",
    },
    {
      label: "Low",
      value: filtered.filter((i) => i.priority === "LOW").length,
      color: "var(--d-text-sub)",
      bgColor: "var(--d-surface-low)",
      icon: "arrow-down" as IconName,
      desc: "Lower priority",
    },
  ];

  return (
    <div className="dp-rescue-monitoring-page dp-incidents-tab-page dp-fade-in">
      <div className="dp-stats-row dp-stats-row-7col">
        {incidentStats.map((s) => (
          <div key={s.label} className="dp-stat">
            <div
              className="dp-stat-icon-wrap"
              style={{ color: s.color, backgroundColor: s.bgColor }}
            >
              <Icon name={s.icon} size={18} />
            </div>
            <div className="dp-stat-label">{s.label}</div>
            <div className="dp-stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="dp-stat-sub">{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="dp-rescue-content-grid dp-incidents-shared-content">
        {/* ── Incidents list (details open in modal) ── */}
        <div className="dp-incidents-list">
          <div className="dp-incidents-panel-head">
            <div className="dp-incidents-panel-title">Incident Queue</div>
            <div className="dp-incidents-panel-sub">
              Prioritized list for dispatcher triage
            </div>
          </div>
          <div className="dp-incidents-filters">
            <div className="dp-incidents-filter-row">
              <input
                className="dp-input dp-incidents-search"
                placeholder="Search incidents by id, type, location, or reporter"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <QueueFilterDropdown<IncidentQueueFilter>
                className="dp-incidents-filter-select"
                value={queueFilter}
                onChange={setQueueFilter}
                options={incidentTypeOptions}
              />
              <QueueFilterDropdown<IncidentPriority | "All">
                className="dp-incidents-filter-select"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  { value: "All", label: "All Priorities" },
                  { value: "CRITICAL", label: "Critical" },
                  { value: "HIGH", label: "High" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "LOW", label: "Low" },
                ]}
              />
              <QueueFilterDropdown<IncidentStatus | "All">
                className="dp-incidents-filter-select"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "All", label: "All Statuses" },
                  { value: "New", label: "New" },
                  { value: "Waiting", label: "Waiting" },
                  { value: "Dispatched", label: "Dispatched" },
                  { value: "In Progress", label: "In Progress" },
                ]}
              />
              <button
                type="button"
                className="dp-btn dp-btn-ghost dp-btn-sm"
                onClick={clearIncidentFilters}
              >
                Clear
              </button>
            </div>
            <div className="dp-incidents-filter-chips">
              {searchText && (
                <button
                  className="dp-filter-chip"
                  onClick={() => setSearchText("")}
                >
                  Search: {searchText}
                  <span>×</span>
                </button>
              )}
              {priorityFilter !== "All" && (
                <button
                  className="dp-filter-chip"
                  onClick={() => setPriorityFilter("All")}
                >
                  Priority: {priorityFilter}
                  <span>×</span>
                </button>
              )}
              {statusFilter !== "All" && (
                <button
                  className="dp-filter-chip"
                  onClick={() => setStatusFilter("All")}
                >
                  Status: {statusFilter}
                  <span>×</span>
                </button>
              )}
              {queueFilter !== "All" && (
                <button
                  className="dp-filter-chip"
                  onClick={() => setQueueFilter("All")}
                >
                  View: {queueFilter}
                  <span>×</span>
                </button>
              )}
            </div>
          </div>

          <div className="dp-incidents-visible-note">
            Showing {visibleIncidents.length} of {filteredSorted.length} matching incidents
          </div>

          <div className="dp-incidents-scroll">
            {filteredSorted.length === 0 ? (
              <div className="dp-empty">
                <div className="dp-empty-title">No results</div>
                <div className="dp-empty-sub">Try another queue filter</div>
              </div>
            ) : (
              visibleIncidents.map((inc) => {
                const dotColor =
                  inc.status === "Resolved"
                    ? "#2e7d32"
                    : inc.status === "Invalid"
                      ? "#9e9e9e"
                      : situationColor(inc.situationType);
                return (
                  <div
                    key={shortenId(inc.id)}
                    className={`dp-incident-list-item ${selInc?.id === inc.id ? "active" : ""}`}
                    style={{ borderLeft: `4px solid ${priorityColor(inc.priority)}` }}
                    onClick={() => setSelInc(inc)}
                  >
                    <span
                      className="dp-incident-list-dot"
                      style={{ background: dotColor }}
                    />
                    <div className="dp-incident-list-body">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>{inc.type}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--d-text-sub)" }}>{inc.dateReported} {inc.timeReported}</div>
                      </div>
                      <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <div style={{ fontSize: "0.9rem" }}>{shortenId(inc.id)}</div>
                        <div style={{ fontSize: "0.9rem", color: "var(--d-text-sub)" }}>{inc.location}, {inc.city}</div>
                      </div>
                      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
                        <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                          <button
                            className="dp-btn dp-btn-ghost dp-btn-sm"
                            disabled={status === "inactive"}
                            style={
                              status === "inactive"
                                ? { opacity: 0.5, cursor: "not-allowed" }
                                : undefined
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (status === "inactive") {
                                toast.show("Action locked: go On Duty to assign");
                                return;
                              }
                              onDispatch(inc);
                            }}
                          >Assign</button>
                          <button
                            className="dp-btn dp-btn-green dp-btn-sm"
                            onClick={async (e) => { e.stopPropagation(); if (inc.status === "Resolved" || inc.status === "Invalid") { toast.show("Already closed"); return; } if (status === "inactive") { toast.show("Action locked: go On Duty to update incidents."); return; } try { await onUpdate(inc.id, { status: "Resolved", resolvedAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) }); toast.show(`${shortenId(inc.id)} resolved`); if (selInc?.id === inc.id) setSelInc(null); } catch (err) { console.error("Quick Resolve failed:", err); toast.show("Failed to resolve incident"); } }}
                          >Quick Resolve</button>
                        </div>
                      </div>
                    </div>
                    <span className="dp-incident-list-arrow">›</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Show selected incident in a modal popup instead of the left panel */}
      {selInc && (
        <Modal title={`Incident ${shortenId(selInc.id)}`} onClose={() => { setSelInc(null); setSuppressAutoSelect(true); }} width={760}>
          <ExpandedTicket
            inc={selInc}
            units={units}
            onBackup={() => { setBackupModal(selInc); setSelInc(null); setSuppressAutoSelect(true); }}
            onEscalate={() => { setEscalateModal(selInc); setSelInc(null); setSuppressAutoSelect(true); }}
            onResolve={() => {
              onUpdate(selInc.id, {
                status: "Resolved",
                resolvedAt: new Date().toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              });
              toast.show(`${shortenId(selInc.id)} resolved`);
              setSelInc(null);
              setSuppressAutoSelect(true);
            }}
            onClose={() => { setSelInc(null); setSuppressAutoSelect(true); }}
            status={status}
          />
        </Modal>
      )}

      {/* Backup modal */}
      {backupModal && (
        <Modal
          title={`Request Backup — ${shortenId(backupModal.id)}`}
          onClose={() => {
            setBackupModal(null);
            setSelectedVolunteers([]);
          }}
          width={520}
        >
          <div
            className="dp-alert dp-alert-amber"
            style={{ marginBottom: "1rem" }}
          >
            {backupModal.type} · {backupModal.address} — Situation:{" "}
            {backupModal.situationType}
          </div>
          <label className="dp-label">Available Volunteers for Deployment</label>
          <div style={{ marginBottom: "1rem" }}>
            {(() => {
              const availableUnits = units.filter((u) => u.status === "Available" && !backupModal.assignedUnits.includes(u.id));
              if (availableUnits.length === 0) {
                return (
                  <div
                    style={{
                      padding: "1rem",
                      background: "var(--d-surface-low)",
                      borderRadius: "0.6rem",
                      textAlign: "center",
                      color: "var(--d-text-sub)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No available volunteers at this time. All units are deployed.
                  </div>
                );
              }
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "0.6rem",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {availableUnits.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() => {
                        setSelectedVolunteers((prev) =>
                          prev.includes(unit.id)
                            ? prev.filter((id) => id !== unit.id)
                            : [...prev, unit.id]
                        );
                      }}
                      style={{
                        padding: "0.85rem",
                        background: selectedVolunteers.includes(unit.id)
                          ? "var(--d-primary-light)"
                          : "var(--d-surface)",
                        border: selectedVolunteers.includes(unit.id)
                          ? "2px solid var(--d-primary)"
                          : "1px solid var(--d-border)",
                        borderRadius: "0.6rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVolunteers.includes(unit.id)}
                          onChange={() => {}}
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            {unit.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--d-text-sub)" }}>
                            {unit.station}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#2e7d32",
                            background: "rgba(46, 125, 50, 0.1)",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "12px",
                          }}
                        >
                          {unit.status}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                          color: "var(--d-text-muted)",
                        }}
                      >
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>Personnel:</span> {unit.personnel}
                        </div>
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>Distance:</span> {unit.distance}
                        </div>
                        <div>
                          <span style={{ color: "var(--d-text-sub)", fontWeight: 600 }}>ETA:</span> {unit.eta}
                        </div>
                      </div>
                      <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--d-text-muted)" }}>
                        <strong>Leader:</strong> {unit.teamLeader} · <strong>Contact:</strong> {unit.contact}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setBackupModal(null);
                setSelectedVolunteers([]);
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-orange"
              disabled={selectedVolunteers.length === 0}
              onClick={() => {
                const selectedUnitNames = selectedVolunteers
                  .map((id) => units.find((u) => u.id === id)?.name)
                  .filter(Boolean)
                  .join(", ");
                onUpdate(backupModal.id, { 
                  situationType: "Escalating",
                  assignedUnits: [...new Set([...backupModal.assignedUnits, ...selectedVolunteers])]
                });
                toast.show(`Backup requested: ${selectedUnitNames}`);
                setBackupModal(null);
                setSelectedVolunteers([]);
              }}
            >
              Deploy Selected Volunteers ({selectedVolunteers.length})
            </button>
          </div>
        </Modal>
      )}

      {/* Escalate modal */}
      {escalateModal && (
        <Modal
          title={`High-Level Intervention — ${shortenId(escalateModal.id)}`}
          onClose={() => setEscalateModal(null)}
          width={460}
        >
          <div
            className="dp-alert dp-alert-red"
            style={{ marginBottom: "1rem" }}
          >
            Escalating <strong>{shortenId(escalateModal.id)}</strong> to
            High-Level Intervention. Senior command will be notified.
          </div>
          <div
            style={{
              background: "var(--d-surface-low)",
              borderRadius: 8,
              padding: "0.7rem",
              fontSize: "0.85rem",
              color: "var(--d-text-muted)",
            }}
          >
            {escalateModal.type} · {escalateModal.address}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
              marginTop: "1rem",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setEscalateModal(null)}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-red"
              onClick={() => {
                onUpdate(escalateModal.id, { situationType: "Critical" });
                toast.show(`${shortenId(escalateModal.id)} escalated`);
                setEscalateModal(null);
              }}
            >
              Confirm Escalation
            </button>
          </div>
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// ── Expanded ticket (used in Incidents page) ──────────────────────────────────
function ExpandedTicket({
  inc,
  units,
  onBackup,
  onEscalate,
  onResolve,
  onClose,
  status,
}: {
  inc: Incident;
  units: Unit[];
  onBackup: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onClose: () => void;
  status: "active" | "inactive";
}) {
  const isInactive = status === "inactive";
  const assigned = inc.assignedUnits
    .map((id) => units.find((u) => u.id === id))
    .filter(Boolean) as Unit[];
  return (
    <div className="dp-ticket-detail dp-fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.8rem",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1.1rem",
              fontWeight: 900,
              color: "var(--d-primary)",
            }}
          >
            {shortenId(inc.id)}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              marginBottom: "0.3rem",
            }}
          >
            {inc.type}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
            <Badge label={inc.status} cls={statusClass(inc.status)} />
            <Badge
              label={inc.situationType}
              cls={situationClass(inc.situationType)}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["In Progress", "Dispatched"].includes(inc.status) &&
            inc.situationType !== "Critical" && (
              <button
                className="dp-btn dp-btn-sm dp-btn-outline-amber"
                disabled={isInactive}
                style={
                  isInactive
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : undefined
                }
                onClick={onBackup}
              >
                Backup
              </button>
            )}
          {["In Progress", "Dispatched"].includes(inc.status) && (
            <button
              className="dp-btn dp-btn-sm dp-btn-outline-red"
              disabled={isInactive}
              style={
                isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
              }
              onClick={onEscalate}
            >
              High-Level
            </button>
          )}
          {["In Progress", "Dispatched"].includes(inc.status) && (
            <button
              className="dp-btn dp-btn-sm dp-btn-outline-green"
              disabled={isInactive}
              style={
                isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
              }
              onClick={onResolve}
            >
              Resolve
            </button>
          )}
          <button className="dp-btn dp-btn-sm dp-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="dp-ticket-detail-grid">
        <div>
          <div className="dp-ticket-section-label">Location & Report</div>
          {[
            ["Address", inc.address],
            ["Barangay", inc.barangay],
            ["City", inc.city],
            ["Reporter", inc.reporter],
            ["Phone", inc.reporterPhone],
            ["Reported", inc.timeReported],
            ["Date", inc.dateReported],
            ["Active", `${inc.timeActive} mins`],
          ].map(([l, v]) => (
            <div key={l} className="dp-ticket-row">
              <span className="dp-ticket-row-label">{l}</span>
              <span className="dp-ticket-row-val">{v}</span>
            </div>
          ))}
          {inc.dispatchedAt && (
            <div className="dp-ticket-row">
              <span className="dp-ticket-row-label">Dispatched</span>
              <span className="dp-ticket-row-val" style={{ fontWeight: 700 }}>
                {inc.dispatchedAt}
              </span>
            </div>
          )}
          {inc.resolvedAt && (
            <div className="dp-ticket-row">
              <span className="dp-ticket-row-label">Resolved</span>
              <span
                className="dp-ticket-row-val"
                style={{ fontWeight: 700, color: "var(--d-green)" }}
              >
                {inc.resolvedAt}
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="dp-ticket-section-label">Description & Notes</div>
          <div className="dp-ticket-desc">{inc.description}</div>
          {inc.notes && (
            <>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--d-text-sub)",
                  textTransform: "uppercase",
                  margin: "0.5rem 0 0.3rem",
                }}
              >
                Field Notes
              </div>
              <div
                className="dp-ticket-desc"
                style={{ whiteSpace: "pre-line" }}
              >
                {inc.notes}
              </div>
            </>
          )}
          {inc.invalidReason && (
            <div
              className="dp-alert dp-alert-red"
              style={{ marginTop: "0.5rem" }}
            >
              Invalid reason: {inc.invalidReason}
            </div>
          )}
        </div>
        <div>
          <div className="dp-ticket-section-label">
            Assigned Volunteers ({assigned.length})
          </div>
          {assigned.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--d-text-sub)" }}>
              No volunteers assigned.
            </p>
          ) : (
            assigned.map((u) => (
              <div
                key={u.id}
                style={{
                  background: "var(--d-surface)",
                  border: "1px solid var(--d-border)",
                  borderRadius: 8,
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    marginBottom: "0.2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <span>{UNIT_TYPE_ICON[u.type]}</span>
                  {u.name}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}
                >
                  {u.station}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}
                >
                  {u.teamLeader} · {u.contact}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ResourcesPage({
  units,
  setUnits,
  teams = [],
  setTeams,
  assignmentIncident,
  onVolunteerAssigned,
  onAssignmentComplete,
  status,
}: {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  assignmentIncident?: Incident | null;
  onVolunteerAssigned?: (unit: Unit, details: { incident: string; eta: string; status: UnitStatus; note: string }) => void;
  onAssignmentComplete?: () => void;
  status: "active" | "inactive";
}) {
  const isInactive = status === "inactive";
  const [tab, setTab] = useState<"teams"|"units">("teams");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addUnitModal, setAddUnitModal] = useState(false);
  const [delConfirm, setDelConfirm] = useState<{ id: string; name: string } | null>(null);
  const [archivedTeams, setArchivedTeams] = useState<Team[]>([]);
  const [archivedUnits, setArchivedUnits] = useState<Unit[]>([]);
  const [teamRemoveConfirm, setTeamRemoveConfirm] = useState<Team | null>(null);
  const [unitRemoveConfirm, setUnitRemoveConfirm] = useState<Unit | null>(null);
  const [msgModal, setMsgModal] = useState<Unit | null>(null);
  const [msgText, setMsgText] = useState("");
  const [deployModal, setDeployModal] = useState<Unit | null>(null);
  const [deployDetails, setDeployDetails] = useState<{
    incident: string;
    eta: string;
    status: UnitStatus;
    note: string;
  }>({
    incident: "",
    eta: "",
    status: "On Route",
    note: "",
  });
  const [newU, setNewU] = useState({
    name: "",
    type: "FIELD" as UnitType,
    station: "",
    leader: "",
    contact: "",
    personnel: "",
  });
  const toast = useToast();

  useEffect(() => {
    if (!assignmentIncident) return;
    setTab("units");
    setStatusFilter("Available");
    setDeployDetails((current) => ({
      ...current,
      incident: assignmentIncident.id,
      status: "On Route",
    }));
  }, [assignmentIncident?.id]);

  const TYPE_COLOR: Record<string, string> = {
    FIELD: "#2E7D32",
    MEDIC: "#1976D2",
    LOGISTICS: "#FFB300",
  };
  const TYPE_BORDER: Record<string, string> = {
    FIELD: "var(--d-primary)",
    MEDIC: "var(--d-blue)",
    LOGISTICS: "var(--d-amber)",
  };

  const filteredUnits = units.filter((u) => {
    if (typeFilter !== "All" && u.type !== typeFilter) return false;
    if (statusFilter !== "All" && u.status !== statusFilter) return false;
    return true;
  });

  const filteredTeams = teams.filter(t => typeFilter==="All"||t.type===typeFilter);
  const resourceStats = tab === "teams"
    ? [
        { l:"Volunteer Roles",v:teams.length,c:"var(--d-text)" },
        { l:"Ready Roles",v:teams.filter(t=>t.status==="Ready").length,c:"var(--d-green)" },
        { l:"Filled Slots",v:teams.reduce((sum,t)=>sum+t.members,0),c:"var(--d-primary)" },
        { l:"Open Slots",v:teams.reduce((sum,t)=>sum+t.vehicles,0),c:"var(--d-text-sub)" },
      ]
    : [
        { l:"Approved Volunteers",v:units.length,c:"var(--d-text)" },
        { l:"Available",v:units.filter(u=>u.status==="Available").length,c:"var(--d-green)" },
        { l:"Deployed",v:units.filter(u=>["On Route","On Scene"].includes(u.status)).length,c:"var(--d-primary)" },
        { l:"Offline",v:units.filter(u=>u.status==="Offline").length,c:"var(--d-text-sub)" },
      ];

  const TEAM_STATUS_CLS: Record<string, string> = {
    Ready: "dp-badge-green",
    Deployed: "dp-badge-blue",
    Standby: "dp-badge-amber",
    Offline: "dp-badge-grey",
  };

  const typeFilters: { value: "All" | UnitType; label: string }[] = [
    { value: "All", label: "All Types" },
    { value: "FIELD", label: "Field" },
    { value: "MEDIC", label: "Medical" },
    { value: "LOGISTICS", label: "Logistics" },
  ];

  const statusFilters = [
    { value: "All", label: "All Statuses" },
    { value: "Available", label: "Available" },
    { value: "On Route", label: "On Route" },
    { value: "On Scene", label: "On Scene" },
    { value: "Offline", label: "Offline" },
  ];

  const handleAddUnit = () => {
    if (!newU.name || !newU.station || !newU.leader || !newU.contact) return;
    const prefix = newU.type;
    const id = `${prefix}-${String(units.filter((u) => u.type === newU.type).length + 10).padStart(2, "0")}`;
    setUnits((p) => [
      ...p,
      {
        id,
        type: newU.type as UnitType,
        name: newU.name,
        station: newU.station,
        status: "Available",
        lat: 14.604 + (Math.random() - 0.5) * 0.05,
        lng: 120.997 + (Math.random() - 0.5) * 0.05,
        personnel: parseInt(newU.personnel) || 3,
        distance: "—",
        eta: "—",
        teamLeader: newU.leader,
        contact: newU.contact,
        plateNumber: "N/A",
        lastActive: "Just added",
      },
    ]);
    setAddUnitModal(false);
    setNewU({
      name: "",
      type: "FIELD" as UnitType,
      station: "",
      leader: "",
      contact: "",
      personnel: "",
    });
    toast.show(`${newU.name} added to roster`);
  };

  return (
    <div className="dp-resources dp-fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 0.25rem",
              fontSize: "1.35rem",
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            Resources
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--d-text-muted)",
            }}
          >
            Manage teams, units, and responders across Metro Cluster 3
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {tab === "units" && (
            <button
              className="dp-btn dp-btn-orange"
              disabled={isInactive}
              style={
                isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined
              }
              onClick={() => setAddUnitModal(true)}
            >
              + Add Volunteer
            </button>
          )}
        </div>
      </div>

      {assignmentIncident && (
        <div className="dp-alert dp-alert-blue" style={{ margin: "1rem 0 0" }}>
          Assigning volunteers to <strong>{shortenId(assignmentIncident.id)}</strong>{" "}
          - {assignmentIncident.type} at {assignmentIncident.location}
        </div>
      )}

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "0.75rem",
        }}
      >
        {[
          { l: "Total Volunteers", v: units.length, c: "var(--d-text)" },
          {
            l: "Available",
            v: units.filter((u) => u.status === "Available").length,
            c: "var(--d-green)",
          },
          {
            l: "Deployed",
            v: units.filter((u) => ["On Route", "On Scene"].includes(u.status))
              .length,
            c: "var(--d-primary)",
          },
          {
            l: "Offline",
            v: units.filter((u) => u.status === "Offline").length,
            c: "var(--d-text-sub)",
          },
        ].map((s) => (
          <div key={s.l} className="dp-stat">
            <div className="dp-stat-label">{s.l}</div>
            <div
              className="dp-stat-value"
              style={{ color: s.c, fontSize: "1.6rem" }}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="dp-resources-tabs">
        <button
          className={`dp-resources-tab ${tab === "teams" ? "active" : ""}`}
          onClick={() => {
            setTab("teams");
            setStatusFilter("All");
          }}
        >
          Response Teams
        </button>
        <button
          className={`dp-resources-tab ${tab === "units" ? "active" : ""}`}
          onClick={() => setTab("units")}
        >
          Individual Volunteers
        </button>
      </div>

      {/* Filters */}
      <div className={`dp-filter-row dp-resources-filter-row ${tab === "units" ? "is-units" : ""}`}>
        <div className="dp-filter-group">
          <div className="dp-filter-group-head">
            <div className="dp-filter-group-label">Volunteer Type</div>
            <div className="dp-filter-group-help">
              Select the kind of volunteer needed for the operation.
            </div>
          </div>
          <div className="dp-filter-group-pills">
            {typeFilters.map((f) => (
              <button
                key={f.value}
                className={`dp-filter-pill ${typeFilter === f.value ? "active" : ""}`}
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "units" && (
          <div className="dp-filter-group">
            <div className="dp-filter-group-head">
              <div className="dp-filter-group-label">Current Status</div>
              <div className="dp-filter-group-help">
                Narrow the list by who is available, deployed, or offline.
              </div>
            </div>
            <div className="dp-filter-group-pills">
              {statusFilters.map((s) => (
                <button
                  key={s.value}
                  className={`dp-filter-pill ${statusFilter === s.value ? "active" : ""}`}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="dp-filter-result-count">
          {tab === "units"
            ? `${filteredUnits.length} volunteer${filteredUnits.length === 1 ? "" : "s"} shown`
            : `${filteredTeams.length} team${filteredTeams.length === 1 ? "" : "s"} shown`}
        </div>
      </div>

      {/* Teams */}
      {tab === "teams" && (
        <div className="dp-team-grid">
          {filteredTeams.map((team, index) => (
            <div key={`${team.id}-${index}`} className="dp-team-card">
              <div className="dp-team-card-header">
                <div>
                  <div className="dp-team-card-name">
                    {UNIT_TYPE_ICON[team.type]} {team.name}
                  </div>
                  <div className="dp-team-card-station">{team.station}</div>
                </div>
                <Badge label={team.status} cls={TEAM_STATUS_CLS[team.status]} />
              </div>
              <div className="dp-team-card-grid">
                {[["Source",team.leader],["Schedule",team.contact],["Filled Slots",`${team.members} volunteers`],["Open Slots",`${team.vehicles} slots`],["Location",team.coverage]].map(([l,v])=>(
                  <div key={l}><div className="dp-team-card-item-label">{l}</div><div className="dp-team-card-item-val">{v}</div></div>
                ))}
              </div>
              <div className="dp-team-card-item-label">Requirements / Tasks</div>
              <div className="dp-equipment-list">
                {team.equipment.map((e) => (
                  <span key={e} className="dp-equipment-tag">
                    {e}
                  </span>
                ))}
              </div>
              <div className="dp-team-card-footer">
                <button
                  className="dp-btn dp-btn-ghost dp-btn-sm"
                  disabled={isInactive}
                  style={
                    isInactive
                      ? { opacity: 0.5, cursor: "not-allowed" }
                      : undefined
                  }
                  onClick={() => toast.show(`Message sent to ${team.name}`)}
                >
                  Message
                </button>
                <button
                  className="dp-btn dp-btn-ghost dp-btn-sm"
                  disabled={isInactive}
                  style={{
                    borderColor: "var(--d-red)",
                    color: "var(--d-red)",
                    opacity: isInactive ? 0.5 : 1,
                    cursor: isInactive ? "not-allowed" : "pointer",
                  }}
                  onClick={() => setTeamRemoveConfirm(team)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {filteredTeams.length===0&&<div className="dp-card" style={{ gridColumn:"1 / -1",padding:"2rem",textAlign:"center",color:"var(--d-text-sub)" }}>No Bayanihub volunteer roles match your filters.</div>}
        </div>
      )}

      {/* Units table */}
      {tab === "units" && (
        <div className="dp-card">
          <table className="dp-table">
            <thead>
              <tr>
                <th>Volunteer ID</th>
                <th>Type</th>
                <th>Name</th>
                <th>Station</th>
                <th>Leader</th>
                <th>Contact</th>
                <th>Personnel</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u, index) => (
                <tr key={`${u.id}-${index}`}>
                  <td
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: TYPE_COLOR[u.type],
                    }}
                  >
                    {u.id}
                  </td>
                  <td>
                    <span style={{ fontSize: "1.1rem" }}>
                      {UNIT_TYPE_ICON[u.type]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td
                    style={{ color: "var(--d-text-muted)", fontSize: "0.8rem" }}
                  >
                    {u.station}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{u.teamLeader}</td>
                  <td
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.78rem",
                      color: "var(--d-text-muted)",
                    }}
                  >
                    {u.contact}
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>
                    {u.personnel}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <span
                        className="dp-unit-status-dot"
                        style={{ background: unitStatusColor(u.status) }}
                      />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        {u.status}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{ fontSize: "0.78rem", color: "var(--d-text-sub)" }}
                  >
                    {u.lastActive}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button
                        className="dp-btn dp-btn-green dp-btn-sm"
                        disabled={isInactive}
                        style={
                          isInactive
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : undefined
                        }
                        onClick={() => {
                          setDeployModal(u);
                          setDeployDetails({
                            incident: assignmentIncident?.id ?? "",
                            eta: u.eta === "—" ? "" : u.eta,
                            status: "On Route",
                            note: "",
                          });
                        }}
                      >
                        Assign
                      </button>
                      <button
                        className="dp-btn dp-btn-ghost dp-btn-sm"
                        disabled={isInactive}
                        style={
                          isInactive
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : undefined
                        }
                        onClick={() => {
                          setMsgModal(u);
                          setMsgText("");
                        }}
                      >
                        Message
                      </button>
                      <button
                        className="dp-btn dp-btn-ghost dp-btn-sm"
                        disabled={isInactive}
                        style={{
                          borderColor:
                            u.status === "Offline"
                              ? "var(--d-green)"
                              : "var(--d-red)",
                          color:
                            u.status === "Offline"
                              ? "var(--d-green)"
                              : "var(--d-red)",
                          opacity: isInactive ? 0.5 : 1,
                          cursor: isInactive ? "not-allowed" : "pointer",
                        }}
                        onClick={() => {
                          setUnits((p) =>
                            p.map((x) =>
                              x.id === u.id
                                ? {
                                  ...x,
                                  status:
                                    x.status === "Offline"
                                      ? "Available"
                                      : "Offline",
                                }
                                : x,
                            ),
                          );
                          toast.show(
                            `${u.id} ${u.status === "Offline" ? "enabled" : "disabled"}`,
                          );
                        }}
                      >
                        {u.status === "Offline" ? "Enable" : "Disable"}
                      </button>
                      <button
                        className="dp-btn dp-btn-ghost dp-btn-sm"
                        disabled={isInactive}
                        style={{
                          borderColor: "var(--d-red)",
                          color: "var(--d-red)",
                          opacity: isInactive ? 0.5 : 1,
                          cursor: isInactive ? "not-allowed" : "pointer",
                        }}
                        onClick={() => setUnitRemoveConfirm(u)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUnits.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--d-text-sub)",
                    }}
                  >
                    No volunteers match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivated & Archived Resources Container */}
      {(archivedTeams.length > 0 || archivedUnits.length > 0) && (
        <div className="dp-archive-section">
          <div className="dp-archive-header">
            <div>
              <div className="dp-archive-title">
                Deactivated & Archived Resources
              </div>
              <p className="dp-archive-desc">
                The following resources have been deactivated. They do not appear in active dispatch queues, but their contact details, coverage, and metadata are preserved here.
              </p>
            </div>
            <span className="dp-badge dp-badge-grey">
              {archivedTeams.length + archivedUnits.length} archived
            </span>
          </div>

          <div className="dp-archive-grid">
            {/* Archived Teams */}
            {archivedTeams.map((team) => (
              <div key={team.id} className="dp-archive-card">
                <div className="dp-archive-info">
                  <div className="dp-archive-name">
                     [Team] {team.name}
                  </div>
                  <div className="dp-archive-meta">
                    Leader: {team.leader} · Contact: {team.contact} · Station: {team.station}
                  </div>
                </div>
                <div className="dp-archive-actions">
                  <button
                    className="dp-btn dp-btn-green dp-btn-sm"
                    onClick={() => {
                      setTeams((p) => [...p, { ...team, status: "Offline" }]);
                      setArchivedTeams((p) => p.filter((t) => t.id !== team.id));
                      toast.show(`${team.name} restored to active roster`);
                    }}
                  >
                    Restore
                  </button>
                  <button
                    className="dp-btn dp-btn-ghost dp-btn-sm"
                    style={{ borderColor: "var(--d-red)", color: "var(--d-red)" }}
                    onClick={() => {
                      setArchivedTeams((p) => p.filter((t) => t.id !== team.id));
                      toast.show(`${team.name} permanently deleted from archive`);
                    }}
                  >
                    Purge
                  </button>
                </div>
              </div>
            ))}

            {/* Archived Units / Volunteers */}
            {archivedUnits.map((u) => (
              <div key={u.id} className="dp-archive-card">
                <div className="dp-archive-info">
                  <div className="dp-archive-name">
                    [Volunteer] {u.name} ({u.id})
                  </div>
                  <div className="dp-archive-meta">
                    Leader: {u.teamLeader} · Contact: {u.contact} · Station: {u.station}
                  </div>
                </div>
                <div className="dp-archive-actions">
                  <button
                    className="dp-btn dp-btn-green dp-btn-sm"
                    onClick={() => {
                      setUnits((p) => [...p, { ...u, status: "Offline" }]);
                      setArchivedUnits((p) => p.filter((x) => x.id !== u.id));
                      toast.show(`${u.name} restored to active roster`);
                    }}
                  >
                    Restore
                  </button>
                  <button
                    className="dp-btn dp-btn-ghost dp-btn-sm"
                    style={{ borderColor: "var(--d-red)", color: "var(--d-red)" }}
                    onClick={() => {
                      setArchivedUnits((p) => p.filter((x) => x.id !== u.id));
                      toast.show(`${u.name} permanently deleted from archive`);
                    }}
                  >
                    Purge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add unit modal */}
      {addUnitModal && (
        <Modal title="Add New Volunteer" onClose={() => setAddUnitModal(false)}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div className="dp-field">
              <label>Volunteer Name *</label>
              <input
                value={newU.name}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Field Volunteer Echo-2"
              />
            </div>
            <div className="dp-field">
              <label>Type *</label>
              <select
                value={newU.type}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, type: e.target.value as UnitType }))
                }
              >
                <option value="FIELD">Field Volunteer</option>
                <option value="MEDIC">Medic Volunteer</option>
                <option value="LOGISTICS">Logistics Volunteer</option>
              </select>
            </div>
            <div className="dp-field" style={{ gridColumn: "span 2" }}>
              <label>Station *</label>
              <input
                value={newU.station}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, station: e.target.value }))
                }
                placeholder="Station address"
              />
            </div>
            <div className="dp-field">
              <label>Team Leader *</label>
              <input
                value={newU.leader}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, leader: e.target.value }))
                }
                placeholder="Full name and rank"
              />
            </div>
            <div className="dp-field">
              <label>Contact *</label>
              <input
                value={newU.contact}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, contact: e.target.value }))
                }
                placeholder="+63 912 000 0000"
              />
            </div>
            <div className="dp-field">
              <label>Personnel</label>
              <input
                value={newU.personnel}
                onChange={(e) =>
                  setNewU((p) => ({ ...p, personnel: e.target.value }))
                }
                placeholder="e.g. 4"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
              marginTop: "1.2rem",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setAddUnitModal(false)}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-orange"
              disabled={
                !newU.name || !newU.station || !newU.leader || !newU.contact
              }
              onClick={handleAddUnit}
            >
              Add Volunteer
            </button>
          </div>
        </Modal>
      )}

      {/* Team Remove Confirmation Modal */}
      {teamRemoveConfirm && (
        <Modal
          title="Remove Response Team"
          onClose={() => setTeamRemoveConfirm(null)}
          width={460}
        >
          <div style={{ marginBottom: "1.2rem", fontSize: "0.875rem", color: "var(--d-text-sub)", lineHeight: 1.5 }}>
            Select how you would like to handle the removal of response team <strong>{teamRemoveConfirm.name}</strong>.
          </div>

          <div className="dp-removal-options">
            <button
              type="button"
              className="dp-removal-option"
              onClick={() => {
                setArchivedTeams((p) => [...p, teamRemoveConfirm]);
                setTeams((p) => p.filter((t) => t.id !== teamRemoveConfirm.id));
                toast.show(`${teamRemoveConfirm.name} moved to deactivated archive`);
                setTeamRemoveConfirm(null);
              }}
            >
              <div className="dp-removal-option-icon" style={{ color: "var(--d-primary)" }}>
                <Icon name="users" size={20} />
              </div>
              <div className="dp-removal-option-content">
                <div className="dp-removal-option-title">Deactivate & Archive</div>
                <div className="dp-removal-option-desc">
                  Move to the deactivated container. All team metadata is safely preserved for easy reactivation.
                </div>
              </div>
            </button>

            <button
              type="button"
              className="dp-removal-option danger"
              onClick={() => {
                setTeams((p) => p.filter((t) => t.id !== teamRemoveConfirm.id));
                toast.show(`${teamRemoveConfirm.name} permanently deleted`);
                setTeamRemoveConfirm(null);
              }}
            >
              <div className="dp-removal-option-icon" style={{ color: "var(--d-red)" }}>
                <Icon name="trash" size={20} />
              </div>
              <div className="dp-removal-option-content">
                <div className="dp-removal-option-title" style={{ color: "var(--d-red)" }}>Delete Permanently</div>
                <div className="dp-removal-option-desc">
                  Completely erase this team from system records. This action is final and cannot be undone.
                </div>
              </div>
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.2rem" }}>
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setTeamRemoveConfirm(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Volunteer Unit Remove Confirmation Modal */}
      {unitRemoveConfirm && (
        <Modal
          title="Remove Volunteer Unit"
          onClose={() => setUnitRemoveConfirm(null)}
          width={460}
        >
          <div style={{ marginBottom: "1.2rem", fontSize: "0.875rem", color: "var(--d-text-sub)", lineHeight: 1.5 }}>
            Select how you would like to handle the removal of volunteer unit <strong>{unitRemoveConfirm.name}</strong>.
          </div>

          <div className="dp-removal-options">
            <button
              type="button"
              className="dp-removal-option"
              onClick={() => {
                setArchivedUnits((p) => [...p, unitRemoveConfirm]);
                setUnits((p) => p.filter((u) => u.id !== unitRemoveConfirm.id));
                toast.show(`${unitRemoveConfirm.name} moved to deactivated archive`);
                setUnitRemoveConfirm(null);
              }}
            >
              <div className="dp-removal-option-icon" style={{ color: "var(--d-primary)" }}>
                <Icon name="users" size={20} />
              </div>
              <div className="dp-removal-option-content">
                <div className="dp-removal-option-title">Deactivate & Archive</div>
                <div className="dp-removal-option-desc">
                  Move to the deactivated container. Preservation of station and contact info allows quick restoration.
                </div>
              </div>
            </button>

            <button
              type="button"
              className="dp-removal-option danger"
              onClick={() => {
                setUnits((p) => p.filter((u) => u.id !== unitRemoveConfirm.id));
                toast.show(`${unitRemoveConfirm.name} permanently deleted`);
                setUnitRemoveConfirm(null);
              }}
            >
              <div className="dp-removal-option-icon" style={{ color: "var(--d-red)" }}>
                <Icon name="trash" size={20} />
              </div>
              <div className="dp-removal-option-content">
                <div className="dp-removal-option-title" style={{ color: "var(--d-red)" }}>Delete Permanently</div>
                <div className="dp-removal-option-desc">
                  Completely erase this volunteer unit from system records. This action is final and cannot be undone.
                </div>
              </div>
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.2rem" }}>
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setUnitRemoveConfirm(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Message modal */}
      {msgModal && (
        <Modal
          title={`Message — ${msgModal.name}`}
          onClose={() => setMsgModal(null)}
          width={440}
        >
          <div
            style={{
              background: "var(--d-surface-low)",
              borderRadius: 8,
              padding: "0.7rem",
              marginBottom: "1rem",
              fontSize: "0.85rem",
              color: "var(--d-text-muted)",
            }}
          >
            To:{" "}
            <strong style={{ color: "var(--d-text)" }}>{msgModal.name}</strong>{" "}
            · {msgModal.teamLeader} · {msgModal.contact}
          </div>
          <label className="dp-label">Message *</label>
          <textarea
            className="dp-textarea"
            rows={3}
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="Type your message..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => setMsgModal(null)}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-orange"
              disabled={!msgText.trim()}
              onClick={() => {
                toast.show(`Message sent to ${msgModal.name}`);
                setMsgModal(null);
                setMsgText("");
              }}
            >
              Send Message
            </button>
          </div>
        </Modal>
      )}
      {/* Deploy modal */}
      {deployModal && (
        <Modal
          title={`Deploy — ${deployModal.name}`}
          onClose={() => setDeployModal(null)}
          width={540}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="dp-field">
              <label>Incident ID</label>
              <input value={deployDetails.incident} onChange={(e) => setDeployDetails(p => ({ ...p, incident: e.target.value }))} placeholder="Optional incident or task ID" />
            </div>
            <div className="dp-field">
              <label>ETA</label>
              <input value={deployDetails.eta} onChange={(e) => setDeployDetails(p => ({ ...p, eta: e.target.value }))} placeholder="e.g. 00:15" />
            </div>
            <div className="dp-field" style={{ gridColumn: "span 2" }}>
              <label>Set Status</label>
              <select value={deployDetails.status} onChange={(e) => setDeployDetails(p => ({ ...p, status: e.target.value as UnitStatus }))}>
                <option>On Route</option>
                <option>On Scene</option>
              </select>
            </div>
            <div className="dp-field" style={{ gridColumn: "span 2" }}>
              <label>Notes</label>
              <input value={deployDetails.note} onChange={(e) => setDeployDetails(p => ({ ...p, note: e.target.value }))} placeholder="Optional instructions" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => setDeployModal(null)}>Cancel</button>
            <button className="dp-btn dp-btn-orange" onClick={() => {
              if (deployModal) {
                setUnits(p => p.map(u => u.id === deployModal.id ? { ...u, status: deployDetails.status, lastActive: deployDetails.eta || u.lastActive } : u));
                onVolunteerAssigned?.(deployModal, deployDetails);
                toast.show(
                  deployDetails.incident.trim()
                    ? `${deployModal.name} assigned to ${shortenId(deployDetails.incident)}`
                    : `${deployModal.name} set to ${deployDetails.status}`,
                );
              }
              setDeployModal(null);
              setDeployDetails({ incident: "", eta: "", status: "On Route", note: "" });
              onAssignmentComplete?.();
            }}>Confirm Deploy</button>
          </div>
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

function AskVolunteersPage({
  status,
  volunteerNeed,
  setVolunteerNeed,
  volunteerIncidentId,
  setVolunteerIncidentId,
  volunteerTargets,
  volunteerNotes,
  setVolunteerNotes,
  onSend,
}: {
  status: "active" | "inactive";
  volunteerNeed: "FIELD" | "MEDIC" | "LOGISTICS";
  setVolunteerNeed: React.Dispatch<React.SetStateAction<"FIELD" | "MEDIC" | "LOGISTICS">>;
  volunteerIncidentId: string;
  setVolunteerIncidentId: React.Dispatch<React.SetStateAction<string>>;
  volunteerTargets: Incident[];
  volunteerNotes: string;
  setVolunteerNotes: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
}) {
  const isInactive = status === "inactive";
  const supportOptions: { value: "FIELD" | "MEDIC" | "LOGISTICS"; label: string }[] = [
    { value: "FIELD", label: "Field Volunteer" },
    { value: "MEDIC", label: "Medic Volunteer" },
    { value: "LOGISTICS", label: "Logistics Volunteer" },
  ];
  const incidentTargetOptions = [
    { value: "GENERAL", label: "General reinforcement (no specific incident)" },
    ...volunteerTargets.map((inc) => ({
      value: inc.id,
      label: `${shortenId(inc.id)} - ${inc.type} | ${inc.location || inc.address} | ${inc.priority} ${inc.status}`,
    })),
  ];

  return (
    <div className="dp-askv-page dp-fade-in">
      <div className="dp-askv-wrap">
        <div className="dp-askv-hero">
          <div className="dp-askv-hero-badge">Bayanihub Link</div>
          <h2>Ask Volunteers</h2>
          <p>
            Request targeted volunteer reinforcement with clear incident context
            and field-ready instructions.
          </p>
        </div>

        <div className="dp-askv-card">
          <div className="dp-alert dp-alert-blue" style={{ marginBottom: "1rem" }}>
            This sends a volunteer assistance request to the Bayanihub network.
          </div>
          <div className="dp-field dp-askv-field">
            <label>Support Type</label>
            <QueueFilterDropdown<"FIELD" | "MEDIC" | "LOGISTICS">
              className="dp-askv-dropdown"
              value={volunteerNeed}
              onChange={setVolunteerNeed}
              options={supportOptions}
            />
          </div>
          <div className="dp-field dp-askv-field" style={{ marginTop: "0.8rem" }}>
            <label>Incident Target</label>
            <QueueFilterDropdown<string>
              className="dp-askv-dropdown"
              value={volunteerIncidentId}
              onChange={setVolunteerIncidentId}
              options={incidentTargetOptions}
            />
          </div>
          <div className="dp-field" style={{ marginTop: "0.8rem" }}>
            <label>Notes / Instructions</label>
            <textarea
              className="dp-textarea"
              rows={5}
              value={volunteerNotes}
              onChange={(e) => setVolunteerNotes(e.target.value)}
              placeholder="Example: Need 5 medical volunteers with first-aid kits at staging area in 20 minutes."
            />
          </div>
          <div className="dp-askv-actions">
            <button
              className="dp-btn dp-btn-green"
              disabled={isInactive}
              style={isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              onClick={onSend}
            >
              Send Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ══════════════════════════════════════════════════════════════════════════════
function ProfilePage({
  onLogout,
  onProfileUpdated,
}: {
  onLogout: () => void;
  onProfileUpdated?: () => void;
}) {
  const [profile, setProfile] = useState({ ...MOCK_DISPATCHER });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...MOCK_DISPATCHER });
  const [logoutModal, setLogoutModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [oldPwVal, setOldPwVal] = useState("");
  const [newPwVal, setNewPwVal] = useState("");
  const [conPwVal, setConPwVal] = useState("");
  const toast = useToast();

  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken) return;

    getDispatcherProfile(session.accessToken)
      .then((data) => {
        const realProfile = mapBackendProfile(data);
        setProfile(realProfile);
        setDraft(realProfile);
      })
      .catch((err) => {
        console.error("Failed to load dispatcher profile:", err);
        toast.show(err?.message || "Failed to load profile");
      });
  }, []);

  const save = async () => {
    const session = loadSession();
    if (!session?.accessToken) return;

    try {
      const { updateProfile } = await import("../lib/api");
      const parts = draft.name.split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      const res = await updateProfile(session.accessToken, {
        firstName,
        lastName,
        email: draft.email,
        phone: draft.phone,
      });

      if (res?.user) {
        session.user = {
          ...session.user,
          ...res.user,
        };
        const { saveSession } = await import("../lib/session");
        saveSession(session);
      }

      setProfile({ ...draft });
      setEditing(false);
      toast.show("Profile updated successfully");
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      toast.show(err?.message || "Failed to update profile");
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPwVal) {
      toast.show("Please enter a new password");
      return;
    }
    if (newPwVal !== conPwVal) {
      toast.show("New passwords do not match");
      return;
    }
    const session = loadSession();
    if (!session?.accessToken) return;

    try {
      const { updateProfile } = await import("../lib/api");
      await updateProfile(session.accessToken, {
        password: newPwVal,
      });
      toast.show("Password changed successfully");
      setPwModal(false);
      setOldPwVal("");
      setNewPwVal("");
      setConPwVal("");
    } catch (err: any) {
      console.error("Failed to change password:", err);
      toast.show(err?.message || "Failed to update password");
    }
  };

  return (
    <div className="dp-profile dp-fade-in">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2
          style={{
            margin: "0 0 0.25rem",
            fontSize: "1.35rem",
            fontWeight: 900,
            letterSpacing: "-0.04em",
          }}
        >
          My Profile
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--d-text-muted)",
          }}
        >
          View and manage your dispatcher account information
        </p>
      </div>

      <div className="dp-profile-grid">
        {/* Avatar card */}
        <div>
          <div className="dp-profile-avatar-card">
            <div className="dp-profile-avatar">{profile.initials}</div>
            <div className="dp-profile-name">{profile.name}</div>
            <div className="dp-profile-rank">{profile.rank}</div>
            <div className="dp-profile-badge">{profile.badge}</div>
            <div className="dp-profile-stats">
              <div className="dp-profile-stat">
                <div className="dp-profile-stat-label">Total Dispatches</div>
                <div
                  className="dp-profile-stat-val"
                  style={{ color: "var(--d-primary)" }}
                >
                  {profile.totalDispatches.toLocaleString()}
                </div>
              </div>
              <div className="dp-profile-stat">
                <div className="dp-profile-stat-label">Resolved Today</div>
                <div
                  className="dp-profile-stat-val"
                  style={{ color: "var(--d-green)" }}
                >
                  {profile.resolvedToday}
                </div>
              </div>
              <div className="dp-profile-stat">
                <div className="dp-profile-stat-label">Member Since</div>
                <div
                  className="dp-profile-stat-val"
                  style={{ fontSize: "0.9rem", fontWeight: 600 }}
                >
                  {profile.joinedDate}
                </div>
              </div>
            </div>
            <div className="dp-profile-actions">
              {!editing ? (
                <button
                  className="dp-btn dp-btn-orange"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    setEditing(true);
                    setDraft({ ...profile });
                  }}
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    className="dp-btn dp-btn-green"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={save}
                  >
                    Save Changes
                  </button>
                  <button
                    className="dp-btn dp-btn-ghost"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      marginTop: "0.3rem",
                    }}
                    onClick={() => {
                      setEditing(false);
                      setDraft({ ...profile });
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                className="dp-btn dp-btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setPwModal(true)}
              >
                Change Password
              </button>
              <div className="dp-divider" />
              <button
                className="dp-btn dp-btn-ghost"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  borderColor: "var(--d-red)",
                  color: "var(--d-red)",
                }}
                onClick={() => setLogoutModal(true)}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="dp-profile-fields">
          {editing && (
            <div
              className="dp-alert dp-alert-amber"
              style={{ marginBottom: "1rem" }}
            >
              You are in edit mode. Make changes and click Save.
            </div>
          )}
          <div className="dp-profile-2col">
            <div>
              <div className="dp-profile-section-head">
                Personal Information
              </div>
              {(["name", "username", "email", "phone"] as const).map((k) => (
                <div key={k} className="dp-field-display">
                  <div className="dp-field-display-label">
                    {k === "name"
                      ? "Full Name"
                      : k.charAt(0).toUpperCase() + k.slice(1)}
                  </div>
                  {editing ? (
                    <input
                      className="dp-input"
                      style={{ width: "100%", marginTop: "0.2rem" }}
                      value={(draft as any)[k]}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [k]: e.target.value }))
                      }
                    />
                  ) : (
                    <div className="dp-field-display-val">
                      {(profile as any)[k]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div className="dp-profile-section-head">
                Assignment (Read-only)
              </div>
              {[
                ["Badge", "badge"],
                ["Rank", "rank"],
                ["Cluster", "cluster"],
                ["Station", "station"],
              ].map(([l, k]) => (
                <div key={k} className="dp-field-display">
                  <div className="dp-field-display-label">{l}</div>
                  <div
                    className="dp-field-display-val"
                    style={{ color: "var(--d-text-muted)" }}
                  >
                    {(profile as any)[k]}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="dp-readonly-note">Badge, rank, cluster, and station are assigned by the system administrator and cannot be self-edited. Contact your admin to update these fields.</div>
        </div>
      </div>

      {/* Logout modal */}
      {logoutModal && (
        <Modal
          title="Sign Out"
          onClose={() => setLogoutModal(false)}
          width={400}
        >
          <div style={{ textAlign: "center", padding: "0.5rem 0 1rem" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              Sign out of Damayan Dispatcher?
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                color: "var(--d-text-muted)",
                lineHeight: 1.6,
              }}
            >
              You will be redirected to the login page and your session will
              end.
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              className="dp-btn dp-btn-ghost"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => setLogoutModal(false)}
            >
              Stay
            </button>
            <button
              className="dp-btn dp-btn-red"
              style={{ flex: 2, justifyContent: "center" }}
              onClick={onLogout}
            >
              Sign Out
            </button>
          </div>
        </Modal>
      )}

      {/* Password modal */}
      {pwModal && (
        <Modal
          title="Change Password"
          onClose={() => setPwModal(false)}
          width={420}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div className="dp-field">
              <label>Current Password</label>
              <input
                type="password"
                value={oldPwVal}
                onChange={(e) => setOldPwVal(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="dp-field">
              <label>New Password</label>
              <input
                type="password"
                value={newPwVal}
                onChange={(e) => setNewPwVal(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="dp-field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={conPwVal}
                onChange={(e) => setConPwVal(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
              marginTop: "1.2rem",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setPwModal(false);
                setOldPwVal("");
                setNewPwVal("");
                setConPwVal("");
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-orange"
              onClick={handleUpdatePassword}
            >
              Update Password
            </button>
          </div>
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SHELL
// ══════════════════════════════════════════════════════════════════════════════
function mapBackendToFrontendIncident(report: IncidentReport, dispatchOrders: DispatchOrder[] = []): Incident {
  const priorityMap: Record<string, IncidentPriority> = {
    low: "LOW",
    moderate: "MEDIUM",
    high: "HIGH",
    critical: "CRITICAL",
  };

  const statusMap: Record<string, IncidentStatus> = {
    pending: "New",
    reviewed: "Waiting",
    actioned: "Dispatched",
    closed: "Resolved",
  };
  const reportText = `${report.title} ${report.content}`.toLowerCase();
  const inferredType =
    /bridge|collapse|structural|building/.test(reportText) ? "Infrastructure Damage" :
      /flood|water|overflow|evacuat/.test(reportText) ? "Flood / Evacuation" :
        /fire|smoke|burn/.test(reportText) ? "Fire Emergency" :
          /medical|injur|wound|patient|ambulance|cardiac|fracture/.test(reportText) ? "Medical Emergency" :
            /food|water|relief|shortage|supply/.test(reportText) ? "Relief / Supply Request" :
              /road|accident|collision|traffic/.test(reportText) ? "Road Accident" :
                report.title;
  const category: Incident["category"] =
    /medical|injur|wound|patient|ambulance|cardiac|fracture/.test(reportText) ? "MEDIC" :
      /food|water|relief|shortage|supply|transport|evacuat/.test(reportText) ? "LOGISTICS" :
        /bridge|collapse|structural|building|fire|flood|rescue|road|accident|collision/.test(reportText) ? "FIELD" :
          "Other";

  const relatedOrders = dispatchOrders.filter((order) => order.reportId === report.id);
  const latestOrder = relatedOrders[0];
  const orderStatusMap: Record<string, IncidentStatus> = {
    pending: "Dispatched",
    accepted: "Dispatched",
    in_progress: "In Progress",
    completed: "Resolved",
  };
  const status =
    latestOrder?.status ? orderStatusMap[latestOrder.status] ?? statusMap[report.status?.toLowerCase() || "pending"] :
    statusMap[report.status?.toLowerCase() || "pending"] || "New";
  const createdAt = new Date(report.createdAt);
  const dispatchedAt = latestOrder?.createdAt
    ? new Date(latestOrder.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : undefined;
  const resolvedAt = latestOrder?.status === "completed" && latestOrder.updatedAt
    ? new Date(latestOrder.updatedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return {
    id: report.id,
    type: inferredType,
    category,
    reporter: "Citizen Report",
    reporterPhone: "Verified",
    address: report.location,
    barangay: "",
    city: "",
    location: report.location,
    lat: 14.6042,
    lng: 120.9822,
    timeReported: createdAt.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    dateReported: createdAt.toLocaleDateString("en-PH"),
    priority:
      priorityMap[report.severity?.toLowerCase() || "moderate"] || "MEDIUM",
    status,
    situationType: report.severity?.toLowerCase() === "critical" ? "Critical" : latestOrder ? "Escalating" : "Under Control",
    assignedUnits: [],
    description: report.content,
    notes: latestOrder?.instructions ?? "",
    timeActive: Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60000)),
    dispatchedAt,
    resolvedAt,
  };
}

function buildIncidentGeocodeQuery(incident: Incident): string {
  const parts = [incident.address, incident.barangay, incident.city]
    .map((part) => part?.trim())
    .filter(Boolean);
  const query = Array.from(new Set(parts)).join(", ");
  if (!query) return "";
  return /philippines/i.test(query) ? query : `${query}, Philippines`;
}

function mapBackendResponderType(type?: string): UnitType {
  const normalized = type?.toLowerCase() ?? "";
  if (["amb", "ambulance", "medical", "medic", "health"].includes(normalized)) return "MEDIC";
  if (["logistics", "relief", "supply", "transport"].includes(normalized)) return "LOGISTICS";
  return "FIELD";
}

function mapOrganizationToTeam(organization: Organization): Team {
  const type = mapBackendResponderType(organization.type);

  return {
    id: organization.id,
    name: organization.name,
    type,
    members: organization.verified ? 10 : 4,
    vehicles: organization.verified ? 2 : 1,
    station: organization.address || "Unassigned station",
    contact: organization.contactPhone || organization.contactEmail || "No contact listed",
    leader: organization.contactEmail || "Coordinator pending",
    status: organization.verified ? "Ready" : "Standby",
    equipment: [organization.type || "resource partner"],
    coverage: organization.address || "Coverage not listed",
  };
}

function mapVolunteerRoleToTeam(role: DispatcherVolunteerTeam): Team {
  return {
    id: role.id,
    name: role.name,
    type: mapBackendResponderType(role.type),
    members: role.members,
    vehicles: role.vehicles,
    station: role.station,
    contact: role.contact,
    leader: role.leader,
    status: role.status,
    equipment: role.equipment.length ? role.equipment : ["No requirements listed"],
    coverage: role.coverage,
  };
}

function mapBackendProfile(profile: BackendDispatcherProfile) {
  return {
    ...MOCK_DISPATCHER,
    id: profile.id,
    name: profile.name,
    username: profile.username,
    email: profile.email,
    phone: profile.phone,
    badge: profile.badge,
    rank: profile.rank,
    cluster: profile.cluster,
    station: profile.station,
    initials: profile.initials,
    joinedDate: profile.joinedDate,
    totalDispatches: profile.totalDispatches,
    resolvedToday: profile.resolvedToday,
  };
}

function mapVolunteerUnit(unit: DispatcherVolunteerUnit): Unit {
  return {
    id: unit.id,
    type: mapBackendResponderType(unit.type),
    name: unit.name,
    station: unit.station,
    status: unit.status,
    lat: unit.lat,
    lng: unit.lng,
    personnel: unit.personnel,
    distance: unit.distance,
    eta: unit.eta,
    teamLeader: unit.teamLeader,
    contact: unit.contact,
    plateNumber: unit.plateNumber,
    lastActive: unit.lastActive,
  };
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<NavPage>("dashboard");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dropdown, setDropdown] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [liveActivityModal, setLiveActivityModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [volunteerNeed, setVolunteerNeed] = useState<
    "FIELD" | "MEDIC" | "LOGISTICS"
  >("FIELD");
  const [volunteerIncidentId, setVolunteerIncidentId] = useState("GENERAL");
  const [volunteerNotes, setVolunteerNotes] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<Incident | null>(null);
  const [resourceAssignmentIncident, setResourceAssignmentIncident] =
    useState<Incident | null>(null);
  const [dispUser, setDispUser] = useState<{
    name: string;
    initials: string;
    rank: string;
    badge: string;
    cluster: string;
    station: string;
  } | null>(null);
  const [cityData, setCityData] = useState<Array<{
    psgcCode: string;
    name: string;
    province: string | null;
    region: string | null;
    coordinates: [number, number];
  }>>([]);
  const clock = useClock();
  const toast = useToast();
  const dropRef = useRef<HTMLDivElement>(null);
  const geocodeCacheRef = useRef<Record<string, [number, number]>>({});

  const syncProfile = async () => {
    const session = loadSession();
    if (session?.accessToken) {
      try {
        const profile = await getDispatcherProfile(session.accessToken);
        setDispUser({
          name: profile.name,
          initials: profile.initials,
          rank: profile.rank,
          badge: profile.badge,
          cluster: profile.cluster,
          station: profile.station,
        });
        return;
      } catch (err) {
        console.error("Failed to sync dispatcher profile:", err);
      }
    }

    if (session?.user) {
      const u = session.user;
      const initials =
        `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() ||
        "DS";
      const name =
        u.name ||
        `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        "Dispatcher User";
      setDispUser({
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Dispatcher",
        initials: `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "DS",
        rank: "Dispatcher I",
        badge: "Not assigned",
        cluster: u.municipality || u.province || u.barangay || "Unassigned Cluster",
        station: u.address || "Unassigned Command Center",
      });
    }
  };

  useEffect(() => {
    syncProfile();
    const session = loadSession();
    if (session?.accessToken) {
      getDispatcherOverview(session.accessToken)
        .then((data) => {
          const mappedIncidents = data.incidentReports.map((report) =>
            mapBackendToFrontendIncident(report, data.dispatchOrders),
          );
          setIncidents(mappedIncidents);
          // Only geocode incidents that don't already have DB coordinates
          const needsGeocode = mappedIncidents.filter((i) => i.lat === 14.6042 && i.lng === 120.9822);
          if (needsGeocode.length > 0) {
            void geocodeIncidentCoordinates(session.accessToken, needsGeocode);
          }
          setTeams(
            data.volunteerTeams?.length
              ? data.volunteerTeams.map(mapVolunteerRoleToTeam)
              : data.organizations.map(mapOrganizationToTeam),
          );
          if (data.volunteerUnits?.length) {
            setUnits(data.volunteerUnits.map(mapVolunteerUnit));
          }
        })
        .catch((err) => {
          console.error("Failed to fetch incidents:", err);
          if (err.status === 401) {
            toast.show("Session expired. Please log in again.");
            setTimeout(() => onLogout(), 1500);
          } else {
            toast.show("Error connecting to incident queue.");
          }
        });
      getDispatcherCityData(session.accessToken)
        .then((cities) => setCityData(cities))
        .catch((err) => console.warn("Failed to load city data:", err));
    } else {
      // No token, force logout
      onLogout();
    }
  }, []);

  const geocodeIncidentCoordinates = async (token: string, sourceIncidents: Incident[]) => {
    const updates = await Promise.all(
      sourceIncidents.map(async (incident) => {
        const query = buildIncidentGeocodeQuery(incident);
        if (!query) return null;

        const cacheKey = query.toLowerCase();
        const cached = geocodeCacheRef.current[cacheKey];
        if (cached) {
          return { id: incident.id, lat: cached[0], lng: cached[1] };
        }

        try {
          const result = await geocodeDispatcherAddress(token, query);
          const coords: [number, number] = [result.latitude, result.longitude];
          geocodeCacheRef.current[cacheKey] = coords;
          return { id: incident.id, lat: coords[0], lng: coords[1] };
        } catch (err) {
          console.warn(`Failed to geocode incident ${incident.id}:`, err);
          return null;
        }
      }),
    );

    const resolved = updates.filter((item): item is { id: string; lat: number; lng: number } => Boolean(item));
    if (!resolved.length) return;

    setIncidents((current) =>
      current.map((incident) => {
        const update = resolved.find((item) => item.id === incident.id);
        return update ? { ...incident, lat: update.lat, lng: update.lng } : incident;
      }),
    );
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateIncident = async (id: string, patch: Partial<Incident>) => {
    if (status !== "active") {
      toast.show("Action locked: You must be On Duty to update incidents.");
      return;
    }
    const session = loadSession();
    if (!session?.accessToken) {
      toast.show("Session expired. Please log in again.");
      return;
    }

    // Map frontend values back to backend expectations
    const backendPatch: any = {};
    if (patch.status) {
      const statusMap: Record<string, string> = {
        New: "pending",
        Waiting: "reviewed",
        Dispatched: "actioned",
        "In Progress": "actioned",
        Resolved: "closed",
        Invalid: "closed",
      };
      backendPatch.status = statusMap[patch.status] || "pending";
    }
    if (patch.priority) {
      const priorityMap: Record<string, string> = {
        LOW: "low",
        MEDIUM: "moderate",
        HIGH: "high",
        CRITICAL: "critical",
      };
      backendPatch.severity = priorityMap[patch.priority] || "moderate";
    }
    if (patch.type) backendPatch.title = patch.type;
    if (patch.description) backendPatch.content = patch.description;
    if (patch.location) backendPatch.location = patch.location;

    try {
      // Update state immediately for responsive UI
      setIncidents((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      
      // Then try to sync with backend
      await updateIncidentReport(session.accessToken, id, backendPatch);
    } catch (err) {
      console.error("Failed to update incident:", err);
      toast.show("Update saved locally. Backend sync failed.");
    }
  };

  const handleDashboardDispatch = (inc: Incident) => {
    if (status !== "active") {
      toast.show("Action locked: You must be On Duty to dispatch volunteers.");
      return;
    }
    setDispatchTarget(inc);
    setPage("resource-map");
  };

  const handleResourceAssign = (inc: Incident) => {
    if (status !== "active") {
      toast.show("Action locked: You must be On Duty to assign volunteers.");
      return;
    }
    setResourceAssignmentIncident(inc);
    setPage("resources");
  };

  const handleVolunteerAssigned = (
    unit: Unit,
    details: { incident: string; eta: string; status: UnitStatus; note: string },
  ) => {
    const targetId = resourceAssignmentIncident?.id || details.incident;
    if (!targetId) return;

    setIncidents((current) =>
      current.map((inc) =>
        inc.id === targetId
          ? {
            ...inc,
            status: inc.status === "Resolved" || inc.status === "Invalid" ? inc.status : "Dispatched",
            assignedUnits: Array.from(new Set([...inc.assignedUnits, unit.id])),
            dispatchedAt:
              inc.dispatchedAt ||
              new Date().toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            notes: details.note ? `${inc.notes ? `${inc.notes}\n` : ""}${details.note}` : inc.notes,
          }
          : inc,
      ),
    );

    const incident = incidents.find((i) => i.id === targetId);

    // Move volunteer pin to incident location on the map
    if (incident) {
      setUnits((current) =>
        current.map((u) =>
          u.id === unit.id
            ? { ...u, lat: incident.lat, lng: incident.lng, status: "On Route" as UnitStatus }
            : u,
        ),
      );
    }

    const session = loadSession();
    if (!session?.accessToken) return;
    const assignedTo = session.user.authUserId || session.user.id;

    const priorityMap: Record<string, string> = { LOW: "low", MEDIUM: "medium", HIGH: "high", CRITICAL: "critical" };
    createVolunteerDispatch(session.accessToken, {
      reportId: targetId,
      assignedTo,
      volunteerName: unit.name,
      priority: incident?.priority ? priorityMap[incident.priority] : "medium",
      instructions: details.note || undefined,
      disasterId: incident?.disasterId,
    }).catch((err) => {
      console.error("Failed to persist volunteer dispatch:", err);
      toast.show("Assigned locally. Could not save to database.");
    });
  };

  const handleDashboardMarkInvalid = (inc: Incident, reason: string) => {
    if (status !== "active") {
      toast.show("Action locked: You must be On Duty to invalidate reports.");
      return;
    }
    updateIncident(inc.id, { status: "Invalid", invalidReason: reason });
    toast.show(`${shortenId(inc.id)} marked as invalid`);
  };

  const newCount = incidents.filter(
    (i) => i.status === "New" || i.status === "Waiting",
  ).length;
  const activeCount = incidents.filter((i) =>
    ["In Progress", "Dispatched"].includes(i.status),
  ).length;

  const NAV: { id: NavPage; icon: IconName; label: string; badge?: number }[] =
    [
      { id: "dashboard", icon: "dashboard", label: "Dashboard" },
      {
        id: "resource-map",
        icon: "map",
        label: "Resource Map",
        badge: newCount || undefined,
      },
      {
        id: "rescue-monitoring",
        icon: "activity",
        label: "Rescue Monitoring",
        badge: activeCount || undefined,
      },
      { id: "incidents", icon: "ticket", label: "Incidents" },
      { id: "resources", icon: "users", label: "Resources" },
      { id: "ask-volunteers", icon: "megaphone", label: "Ask Volunteers" },
    ];

  const recentActivity = incidents
    .filter((inc) => inc.status !== "Invalid")
    .slice(0, 8)
    .map((inc) => ({
      id: inc.id,
      type: inc.type,
      status: inc.status,
      time: inc.timeReported,
      location: inc.location,
    }));
  const volunteerTargets = incidents.filter((inc) =>
    ["New", "Waiting", "Dispatched", "In Progress"].includes(inc.status),
  );

  return (
    <div
      className={`dp-page dp-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      {/* ── Sidebar ── */}
      <aside className="dp-sidebar">
        {/* Collapse toggle button */}
        <button
          className="dp-sidebar-toggle"
          onClick={() => setSidebarCollapsed((c) => !c)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>

        <div className="dp-sidebar-top">
          <div className="dp-sidebar-brand">
            <div className="dp-sidebar-brand-mark">
              <img src="/damayan_logo.svg" alt="DAMAYAN Logo" />
            </div>
            <div>
              <div className="dp-sidebar-brand-name">DAMAYAN</div>
              <div className="dp-sidebar-brand-role">Dispatcher</div>
            </div>
          </div>

          <div className="dp-status-pill">
            <div className="dp-status-row">
              <span className={`dp-status-dot ${status}`} />
              <span
                className={
                  status === "active"
                    ? "dp-status-active"
                    : "dp-status-inactive"
                }
              >
                {status === "active" ? "Active / On Duty" : "Inactive"}
              </span>
            </div>
            <div className="dp-status-cluster">
              {dispUser?.cluster || "Assigned cluster unavailable"}
            </div>
            <button
              className={`dp-status-toggle ${status === "active" ? "set-inactive" : "set-active"}`}
              onClick={() =>
                setStatus((s) => (s === "active" ? "inactive" : "active"))
              }
            >
              {status === "active" ? "Set Inactive" : "Set Active / On Duty"}
            </button>
          </div>
        </div>

        <nav className="dp-sidebar-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              data-label={item.label}
              className={`dp-nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="dp-nav-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="dp-nav-label">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="dp-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="dp-sidebar-footer">
          <button
            data-label="Sign Out"
            className="dp-nav-item"
            onClick={() => onLogout()}
          >
            <span className="dp-nav-icon">
              <Icon name="logout" size={18} />
            </span>
            <span className="dp-nav-label" style={{ color: "var(--d-text-sub)" }}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="dp-main">
        {/* Topbar */}
        <header className="dp-topbar">
          <div className="dp-topbar-left">
            <span className="dp-topbar-brand">DAMAYAN</span>
            <span className="dp-topbar-divider" aria-hidden="true">|</span>
            <span className="dp-topbar-crumb">PORTAL</span>
            <span className="dp-topbar-chevron" aria-hidden="true">›</span>
            <span className="dp-topbar-crumb current">{page.toUpperCase()}</span>
          </div>
          <div className="dp-topbar-right">
            <span
              className={`dp-phase-badge ${status === "active" ? "active" : "inactive"}`}
              title={`${dispUser?.station || "Command Center"} - ${dispUser?.cluster || "Assigned Cluster"}`}
            >
              {status === "active" ? "ACTIVE RESPONSE" : "OFF DUTY"}
            </span>
            <span className="dp-clock">{clock}</span>
            <button
              className="dp-broadcast-btn"
              disabled={status === "inactive"}
              style={
                status === "inactive"
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : undefined
              }
              onClick={() => {
                if (status === "inactive") {
                  toast.show(
                    "Action locked: You must be On Duty to broadcast alerts.",
                  );
                  return;
                }
                setBroadcastModal(true);
              }}
            >
              Broadcast
            </button>
            <button
              className="dp-live-activity-btn"
              onClick={() => setLiveActivityModal(true)}
            >
              <span className="dp-live-activity-dot" />
              Live Activity
            </button>
            <div ref={dropRef} style={{ position: "relative" }}>
              <div
                className="dp-avatar-btn"
                onClick={() => setDropdown((d) => !d)}
              >
                {dispUser?.initials || "??"}
              </div>
              {dropdown && (
                <div className="dp-avatar-dropdown">
                  <div className="dp-avatar-dropdown-header">
                    <div className="dp-avatar-dropdown-profile">
                      <div className="dp-avatar-dropdown-initials">
                        {dispUser?.initials || "??"}
                      </div>
                      <div>
                        <div className="dp-avatar-dropdown-name">
                          {dispUser?.name || "Dispatcher User"}
                        </div>
                        <div className="dp-avatar-dropdown-role">
                          {dispUser?.rank || "Dispatcher"}
                        </div>
                        <div className="dp-avatar-dropdown-status">
                          {status === "active" ? "Active / On Duty" : "Off Duty"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="dp-avatar-dropdown-item"
                    onClick={() => {
                      setPage("profile");
                      setDropdown(false);
                    }}
                  >
                    View Profile
                  </button>
                  <button
                    className="dp-avatar-dropdown-item"
                    onClick={() => {
                      setPage("profile");
                      setDropdown(false);
                    }}
                  >
                    Edit Profile
                  </button>
                  <div className="dp-avatar-dropdown-divider" />
                  <button
                    className="dp-avatar-dropdown-item danger"
                    onClick={() => {
                      setDropdown(false);
                      onLogout();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="dp-content">
          {page === "dashboard" && (
            <DashboardPage
              incidents={incidents}
              units={units}
              onDispatch={handleDashboardDispatch}
              onMarkInvalid={handleDashboardMarkInvalid}
              status={status}
            />
          )}
          {page === "resource-map" && (
            <ResourceMapPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
              dispatchTarget={dispatchTarget}
              onClearDispatchTarget={() => setDispatchTarget(null)}
              status={status}
              cityData={cityData}
            />
          )}
          {page === "rescue-monitoring" && (
            <RescueMonitoringPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
              status={status}
            />
          )}
          {page === "incidents" && (
            <IncidentsPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
              onDispatch={handleResourceAssign}
              status={status}
            />
          )}
          {page === "resources" && (
            <ResourcesPage
              units={units}
              setUnits={setUnits}
              teams={teams}
              setTeams={setTeams}
              assignmentIncident={resourceAssignmentIncident}
              onVolunteerAssigned={handleVolunteerAssigned}
              onAssignmentComplete={() => setResourceAssignmentIncident(null)}
              status={status}
            />
          )}
          {page === "ask-volunteers" && (
            <AskVolunteersPage
              status={status}
              volunteerNeed={volunteerNeed}
              setVolunteerNeed={setVolunteerNeed}
              volunteerIncidentId={volunteerIncidentId}
              setVolunteerIncidentId={setVolunteerIncidentId}
              volunteerTargets={volunteerTargets}
              volunteerNotes={volunteerNotes}
              setVolunteerNotes={setVolunteerNotes}
              onSend={() => {
                if (status === "inactive") {
                  toast.show("Action locked: You must be On Duty to request volunteers.");
                  return;
                }
                const session = loadSession();
                if (!session?.accessToken) {
                  toast.show("Session expired. Please log in again.");
                  return;
                }
                const assignedTo = session.user.authUserId || session.user.id;
                const targetLabel = volunteerIncidentId === "GENERAL" ? "general ops" : shortenId(volunteerIncidentId);
                const typeLabel = volunteerNeed === "FIELD" ? "Field" : volunteerNeed === "MEDIC" ? "Medic" : "Logistics";

                if (volunteerIncidentId !== "GENERAL") {
                  const incident = incidents.find((i) => i.id === volunteerIncidentId);
                  createVolunteerDispatch(session.accessToken, {
                    reportId: volunteerIncidentId,
                    assignedTo,
                    volunteerName: `${typeLabel} Volunteer Request`,
                    priority: incident?.priority?.toLowerCase() === "critical" ? "critical"
                      : incident?.priority?.toLowerCase() === "high" ? "urgent"
                      : incident?.priority?.toLowerCase() === "low" ? "low" : "normal",
                    instructions: volunteerNotes || `${typeLabel} volunteer needed`,
                    disasterId: incident?.disasterId,
                  }).catch((err) => console.error("Volunteer dispatch failed:", err));
                } else {
                  sendDispatcherBroadcast(session.accessToken, {
                    title: `${typeLabel} Volunteer Request`,
                    message: volunteerNotes || `${typeLabel} volunteers needed for general operations. Please respond if available.`,
                    severity: "warning",
                    type: "Volunteer Request",
                  }).catch((err) => console.error("Broadcast failed:", err));
                }

                toast.show(`Volunteer request sent to Bayanihub (${volunteerNeed}) for ${targetLabel}.`);
                setVolunteerNeed("FIELD");
                setVolunteerIncidentId("GENERAL");
                setVolunteerNotes("");
              }}
            />
          )}
          {page === "profile" && (
            <ProfilePage onLogout={onLogout} onProfileUpdated={syncProfile} />
          )}
        </div>
      </div>

      {/* Broadcast modal */}
      {broadcastModal && (
        <Modal
          title="System-Wide Broadcast Alert"
          onClose={() => {
            setBroadcastModal(false);
            setBroadcastMsg("");
          }}
          width={500}
        >
          <div
            className="dp-alert dp-alert-red"
            style={{ marginBottom: "1rem" }}
          >
            This message will be sent to all field responders and registered
            citizens in Metro Cluster 3 via push notification and SMS.
          </div>
          <label className="dp-label">Alert Message *</label>
          <textarea
            className="dp-textarea"
            rows={4}
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type your emergency broadcast message..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="dp-btn dp-btn-ghost"
              onClick={() => {
                setBroadcastModal(false);
                setBroadcastMsg("");
              }}
            >
              Cancel
            </button>
            <button
              className="dp-btn dp-btn-red"
              disabled={!broadcastMsg.trim()}
              onClick={async () => {
                const session = loadSession();
                if (!session?.accessToken) {
                  toast.show("Session expired. Please log in again.");
                  onLogout();
                  return;
                }

                try {
                  const result = await sendDispatcherBroadcast(session.accessToken, {
                    message: broadcastMsg,
                    severity: "critical",
                    type: "Emergency",
                  });
                  toast.show(`Broadcast saved and sent to ${result.deliveredInApp} users`);
                  setBroadcastModal(false);
                  setBroadcastMsg("");
                } catch (err: any) {
                  console.error("Failed to send broadcast:", err);
                  toast.show(err?.message || "Failed to send broadcast");
                }
              }}
            >
              Send Broadcast Now
            </button>
          </div>
        </Modal>
      )}

      {liveActivityModal && (
        <Modal
          title="Live Activity Feed"
          onClose={() => setLiveActivityModal(false)}
          width={560}
        >
          <div className="dp-live-activity-list">
            {recentActivity.length === 0 ? (
              <div className="dp-empty">
                <div className="dp-empty-title">No live activity yet</div>
              </div>
            ) : (
              recentActivity.map((item) => (
                <div key={item.id} className="dp-live-activity-item">
                  <div className="dp-live-activity-item-top">
                    <span className="dp-live-activity-id">
                      {shortenId(item.id)}
                    </span>
                    <Badge label={item.status} cls={statusClass(item.status)} />
                  </div>
                  <div className="dp-live-activity-type">{item.type}</div>
                  <div className="dp-live-activity-sub">
                    {item.location} - {item.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
type Stage = "login" | "awaiting" | "portal";

export default function DispatcherPortal() {
  const [stage, setStage] = useState<Stage>("portal");
  return stage === "login" ? (
    <LoginPage
      onLogin={() => setStage("portal")}
      onRegister={() => setStage("awaiting")}
    />
  ) : stage === "awaiting" ? (
    <AwaitingPage onProceed={() => setStage("portal")} />
  ) : (
    <Shell
      onLogout={() => {
        window.location.href = "/login";
      }}
    />
  );
}

