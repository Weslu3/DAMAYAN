"use client";
import "./dispatcher.css";
import { useState, useEffect, useRef } from "react";
import {
  NavPage, Incident, Unit, Team, IncidentPriority, IncidentStatus, SituationType, UnitType,
  MOCK_DISPATCHER, MOCK_UNITS, MOCK_INCIDENTS, MOCK_TEAMS,
  priorityClass, statusClass, situationClass, situationColor, unitStatusColor, unitTypeColor,
  priorityColor, UNIT_TYPE_ICON, CATEGORY_ICON,
} from "./data";
import LiveMap, { MapMode } from "./LiveMap";
import { getDispatcherIncidents, updateIncidentReport } from "../lib/api";
import { loadSession } from "../lib/session";
import { IncidentReport } from "../lib/types";

// ══════════════════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`dp-badge ${cls}`}>{label}</span>;
}

function Modal({ title, onClose, width = 560, children }: { title: string; onClose: () => void; width?: number; children: React.ReactNode }) {
  return (
    <div className="dp-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dp-modal" style={{ maxWidth: width }}>
        <div className="dp-modal-header">
          <span className="dp-modal-title">{title}</span>
          <button className="dp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="dp-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return <div className="dp-toast">{msg}</div>;
}

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
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
  } catch { return timeStr; }
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2800); };
  return { msg, show };
}

function shortenId(id: string) {
  if (!id) return "";
  if (id.includes("-")) return id.split("-")[0].toUpperCase();
  return id.substring(0, 8).toUpperCase();
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState(""); const [pass, setPass] = useState("");
  const [idFile, setIdFile] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState(""); const [resetSent, setResetSent] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <div className="dp-page dp-login-page">
      <div className="dp-login-card">
        {/* Brand */}
        <div className="dp-login-brand">
          <div>
            <div className="dp-login-logo">
              <div className="dp-login-logo-mark">D</div>
              <div>
                <span className="dp-login-logo-name">Damayan</span>
                <p className="dp-login-logo-role">Dispatcher Portal</p>
              </div>
            </div>
            <h1>Coordinate.<br />Dispatch.<br />Protect.</h1>
            <p>Real-time dispatch management for police, ambulance, and fire response across Metro Cluster 3.</p>
          </div>
          <div className="dp-login-brand-badges">
            {[{ l:"Police" }, { l:"Medical" }, { l:"Fire" }].map(b => (
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
                <p>Enter your registered email or phone. We'll send a reset link via Email/SMS.</p>
              </div>
              {resetSent ? (
                <div className="dp-alert dp-alert-green" style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <strong>Reset link sent!</strong><br />Check your email or SMS inbox.
                  <br /><button className="dp-btn dp-btn-green" style={{ marginTop: "1rem" }} onClick={() => { setForgot(false); setResetSent(false); }}>← Back to Login</button>
                </div>
              ) : (
                <div className="dp-form" style={{ marginTop: "1.5rem" }}>
                  <div className="dp-field">
                    <label>Email or Phone</label>
                    <input value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="your@email.com or +63..." />
                  </div>
                  <button className="dp-btn-primary" onClick={() => setResetSent(true)}>Send Reset Link via Email/SMS</button>
                  <button className="dp-btn dp-btn-ghost" style={{ width: "100%" }} onClick={() => setForgot(false)}>← Back to Login</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="dp-login-tabs">
                <button className={`dp-login-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Login</button>
                <button className={`dp-login-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>Register</button>
              </div>
              {mode === "login" ? (
                <>
                  <div className="dp-login-intro">
                    <h2>Welcome back</h2>
                    <p>Sign in to the Damayan Dispatcher Portal.</p>
                  </div>
                  {err && <div className="dp-error-msg">Invalid credentials. Please check your username and password.</div>}
                  <div className="dp-form" style={{ marginTop: "1.2rem" }}>
                    <div className="dp-field">
                      <label>Username</label>
                      <input value={user} onChange={e => setUser(e.target.value)} placeholder="dispatcher_username" />
                    </div>
                    <div className="dp-field">
                      <div className="dp-field-row">
                        <label>Password</label>
                        <button onClick={() => setForgot(true)}>Forgot password?</button>
                      </div>
                      <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
                    </div>
                    <button className="dp-btn-primary" onClick={() => { if (user && pass) { setErr(false); onLogin(); } else setErr(true); }}>Sign In →</button>
                  </div>
                  <p className="dp-login-switch">Don't have an account? <a onClick={() => setMode("register")}>Register here</a></p>
                </>
              ) : (
                <>
                  <div className="dp-login-intro">
                    <h2>Create Account</h2>
                    <p>Register with your credentials and a valid Government ID for admin verification.</p>
                  </div>
                  <div className="dp-form" style={{ marginTop: "1.2rem" }}>
                    <div className="dp-field">
                      <label>Username</label>
                      <input value={user} onChange={e => setUser(e.target.value)} placeholder="Choose a username" />
                    </div>
                    <div className="dp-field">
                      <label>Password</label>
                      <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
                    </div>
                    <div className="dp-field">
                      <label>Upload Valid Government ID *</label>
                      <div className={`dp-id-upload ${idFile ? "uploaded" : ""}`} onClick={() => setIdFile("gov_id.jpg")}>
                        {idFile ? <><div className="label" style={{ color: "var(--d-green)", fontWeight: 700 }}>{idFile} — uploaded</div></> : <><div className="label">Click to upload Government ID</div><div className="hint">UMID, SSS, Passport, Driver's License</div></>}
                      </div>
                    </div>
                    <button className="dp-btn-primary" disabled={!user || !pass || !idFile} onClick={onRegister}>Register & Submit for Verification</button>
                  </div>
                  <div className="dp-login-note">⏳ After submission, wait for admin approval before accessing the portal.</div>
                  <p className="dp-login-switch">Already have an account? <a onClick={() => setMode("login")}>Sign in here</a></p>
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
        <div className="dp-verify-icon" style={{ background: "var(--d-primary)", color: "white", width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: "1.2rem", fontWeight: 800 }}>T</div>
        <h2>Waiting for Verification</h2>
        <p>Your account and government ID have been submitted. An administrator will verify your documents. You'll be notified via email/SMS once approved.</p>
        <div className="dp-verify-steps">
          <div className="dp-verify-step">Account created with username & password</div>
          <div className="dp-verify-step">Government ID uploaded successfully</div>
          <div className="dp-verify-step pending">Awaiting admin verification</div>
        </div>
        <button className="dp-btn-primary" onClick={onProceed}>Continue (Demo: Skip Verification)</button>
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
function DashboardPage({ incidents, units, onDispatch, onMarkInvalid }: {
  incidents: Incident[];
  units: Unit[];
  onDispatch: (inc: Incident) => void;
  onMarkInvalid: (inc: Incident, reason: string) => void;
}) {
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const newInc    = incidents.filter(i => i.status === "New" || i.status === "Waiting");
  const activeInc = incidents.filter(i => i.status === "In Progress" || i.status === "Dispatched");
  const resolved  = incidents.filter(i => i.status === "Resolved");
  const critical  = incidents.filter(i => (i.priority === "CRITICAL" || i.priority === "HIGH") && i.status !== "Resolved" && i.status !== "Invalid");
  const avail     = units.filter(u => u.status === "Available").length;
  const deployed  = units.filter(u => u.status !== "Available" && u.status !== "Offline").length;

  const stats = [
    { label: "New Incidents",    value: newInc.length,    color: "var(--d-red)",     icon: "N" },
    { label: "Active Response",  value: activeInc.length, color: "var(--d-primary)", icon: "A" },
    { label: "Resolved Today",   value: resolved.length,  color: "var(--d-green)",   icon: "R" },
    { label: "Critical / High",  value: critical.length,  color: "#c77700",          icon: "!" },
    { label: "Units Available",  value: avail,            color: "var(--d-blue)",    icon: "U", sub: `${deployed} deployed` },
    { label: "Total Units",      value: units.length,     color: "var(--d-text)",    icon: "T" },
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

  return (
    <div className="dp-dashboard dp-fade-in">
      <div className="dp-dash-greeting">
        <div className="dp-dash-greeting-date">{today}</div>
        <h1>Command Overview</h1>
        <p>Metro Cluster 3 — Sampaloc Command Center</p>
      </div>

      {/* Stats */}
      <div className="dp-stats-row">
        {stats.map(s => (
          <div key={s.label} className="dp-stat">
            <div className="dp-stat-icon">{s.icon}</div>
            <div className="dp-stat-label">{s.label}</div>
            <div className="dp-stat-value" style={{ color: s.color }}>{s.value}</div>
            {s.sub && <div className="dp-stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Pending queue */}
      <div className="dp-card">
        <div className="dp-card-header">
          <div>
            <div className="dp-card-title">Pending Incident Queue</div>
            <div className="dp-card-sub">Incoming reports awaiting review and dispatch</div>
          </div>
          <span className="dp-badge dp-badge-red">{queueInc.length} incoming</span>
        </div>
        {/* Table header */}
        <div className="dp-queue-row" style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-low)", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--d-text-sub)", cursor: "default" }}>
          <span>ID</span><span>Type</span><span>Location</span><span>Reported</span><span>Priority</span><span>Status</span><span>Action</span>
        </div>
        {queueInc.length === 0
          ? <div className="dp-empty"><div className="dp-empty-title">No pending incidents</div></div>
          : queueInc.map(inc => (
              <QueueRow
                key={inc.id}
                inc={inc}
                units={units}
                onDispatch={onDispatch}
                onMarkInvalid={onMarkInvalid}
              />
            ))}
      </div>

      <div className="dp-dash-grid">
        {/* Critical */}
        <div className="dp-card">
          <div className="dp-card-header">
            <div className="dp-card-title">Critical & High Priority</div>
            <span className="dp-badge dp-badge-red">{critical.length} active</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {critical.length === 0
              ? <div className="dp-empty"><div className="dp-empty-title">No critical incidents</div></div>
              : critical.map(inc => (
                  <div key={inc.id} style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(191,182,162,0.15)", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "1.2rem", flexShrink: 0 }}>{CATEGORY_ICON[inc.category]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "var(--d-primary)" }}>{shortenId(inc.id)}</span>
                        <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
                        <Badge label={inc.situationType} cls={situationClass(inc.situationType)} />
                      </div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>{inc.type}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--d-text-sub)" }}>📍 {inc.address}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Unit status + activity */}
        <div className="dp-dash-col">
          <div className="dp-card" style={{ padding: "1rem" }}>
            <div className="dp-card-title" style={{ marginBottom: "0.8rem" }}>Unit Status</div>
            {(["FIRE","AMB","POL"] as UnitType[]).map(type => {
              const tu = units.filter(u => u.type === type);
              const av = tu.filter(u => u.status === "Available").length;
              const pct = tu.length ? Math.round(av / tu.length * 100) : 0;
              const c = unitTypeColor(type);
              return (
                <div key={type} className="dp-unit-bar">
                    <span>{type === "FIRE" ? "Fire" : type === "AMB" ? "Medical" : "Police"}</span>
                  <div className="dp-unit-bar-track"><div className="dp-unit-bar-fill" style={{ width: `${pct}%`, background: c }} /></div>
                </div>
              );
            })}
          </div>

          <div className="dp-card" style={{ padding: "1rem", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
              <div className="dp-card-title">Live Activity</div>
              <span className="dp-status-dot active" style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} className="dp-activity-item">
                  <span className="dp-activity-time">{a.time}</span>
                  <span className="dp-activity-type" style={{ color: a.color }}>{a.type}</span>
                  <span className="dp-activity-msg">{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Situational awareness */}
        <div className="dp-dash-col">
          <div className="dp-card" style={{ padding: "1rem" }}>
            <div className="dp-card-title" style={{ marginBottom: "0.8rem" }}>Situational Awareness</div>
            <div className="dp-situation-strip">
              {(["Under Control","Escalating","Critical"] as SituationType[]).map(sit => {
                const count = incidents.filter(i => i.situationType === sit && i.status !== "Resolved" && i.status !== "Invalid").length;
                const c = situationColor(sit);
                return (
                  <div key={sit} className="dp-situation-card" style={{ background: `${c}0d`, borderColor: `${c}30`, color: c }}>
                    <div className="dp-situation-card-title">
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                      {sit}
                    </div>
                    <div className="dp-situation-card-count">{count}</div>
                    <div className="dp-situation-card-sub">incidents</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dp-card" style={{ flex: 1, padding: "1rem" }}>
            <div className="dp-card-title" style={{ marginBottom: "0.8rem" }}>Quick Stats</div>
            {[
              { label: "Incidents Today",    value: incidents.length },
              { label: "Response Rate",      value: `${Math.round((resolved.length / Math.max(incidents.length, 1)) * 100)}%` },
              { label: "Avg. Response Time", value: "4.2 mins" },
              { label: "Units on Duty",      value: `${units.filter(u => u.status !== "Offline").length}/${units.length}` },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(191,182,162,0.15)", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--d-text-muted)" }}>{s.label}</span>
                <span style={{ fontWeight: 800, color: "var(--d-text)" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Queue row — dispatch navigates to Resource Map dispatch mode; invalid removes from queue
function QueueRow({ inc, units, onDispatch, onMarkInvalid }: {
  inc: Incident;
  units: Unit[];
  onDispatch: (inc: Incident) => void;
  onMarkInvalid: (inc: Incident, reason: string) => void;
}) {
  const [ticketModal, setTicketModal] = useState(false);
  const [invalidModal, setInvalidModal] = useState(false);
  const [reason, setReason] = useState("");
  const toast = useToast();

  const handleConfirmInvalid = () => {
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
        <div className="dp-queue-actions" onClick={e => e.stopPropagation()}>
          <button className="dp-btn dp-btn-sm dp-btn-green" onClick={() => onDispatch(inc)}>Dispatch</button>
          <button className="dp-btn dp-btn-sm dp-btn-ghost" onClick={() => setInvalidModal(true)}>Invalid</button>
        </div>
      </div>

      {ticketModal && <TicketModal inc={inc} units={units} onClose={() => setTicketModal(false)} />}

      {invalidModal && (
        <Modal title={`Mark ${inc.id} as Invalid`} onClose={() => { setInvalidModal(false); setReason(""); }} width={460}>
          <p style={{ color: "var(--d-text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
            <strong style={{ color: "var(--d-text)" }}>{inc.type}</strong> reported at {inc.address} — {inc.timeReported}
          </p>
          <label className="dp-label">Reason for marking invalid *</label>
          <textarea
            className="dp-textarea"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Duplicate report, false alarm, caller unreachable..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => { setInvalidModal(false); setReason(""); }}>Cancel</button>
            <button className="dp-btn dp-btn-red" disabled={!reason.trim()} onClick={handleConfirmInvalid}>Confirm Invalid</button>
          </div>
        </Modal>
      )}
      {toast.msg && <Toast msg={toast.msg} />}
    </>
  );
}

function TicketModal({ inc, units, onClose }: { inc: Incident; units: Unit[]; onClose: () => void }) {
  const assigned = inc.assignedUnits.map(id => units.find(u => u.id === id)).filter(Boolean) as Unit[];
  const pc = priorityColor(inc.priority);
  const sc = situationColor(inc.situationType);

  return (
    <Modal title="Incident Ticket" onClose={onClose} width={680}>
      {/* Header block */}
      <div className="dp-ticket-header-block">
        <div>
          <div className="dp-ticket-id">{shortenId(inc.id)}</div>
          <div className="dp-ticket-type-title">{inc.type} — {inc.category}</div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
            <Badge label={inc.status} cls={statusClass(inc.status)} />
            <Badge label={inc.situationType} cls={situationClass(inc.situationType)} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--d-text-sub)", marginBottom: "0.2rem" }}>Reported</div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{inc.timeReported}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--d-text-sub)" }}>{inc.dateReported}</div>
          {inc.timeActive && <div style={{ fontSize: "0.78rem", color: "var(--d-amber)", marginTop: "0.2rem", fontWeight: 700 }}>⏱ {inc.timeActive} min active</div>}
        </div>
      </div>

      <div className="dp-ticket-modal-grid">
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--d-text-sub)", marginBottom: "0.6rem" }}>Location & Reporter</div>
          {[
            ["Address",    inc.address],
            ["Barangay",   inc.barangay],
            ["City",       inc.city],
            ["Reporter",   inc.reporter],
            ["Phone",      inc.reporterPhone],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--d-text-sub)", minWidth: 70, paddingTop: 1 }}>{l}</span>
              <span style={{ fontSize: "0.825rem", color: "var(--d-text)", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          {inc.dispatchedAt && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--d-text-sub)", minWidth: 70, paddingTop: 1 }}>Dispatched</span>
              <span style={{ fontSize: "0.825rem", color: "var(--d-text)", fontWeight: 700 }}>{inc.dispatchedAt}</span>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--d-text-sub)", marginBottom: "0.6rem" }}>Assigned Units ({assigned.length})</div>
          {assigned.length === 0
            ? <p style={{ fontSize: "0.85rem", color: "var(--d-text-sub)" }}>No units assigned.</p>
            : assigned.map(u => (
                <div key={u.id} style={{ background: "var(--d-surface-low)", borderRadius: 8, padding: "0.6rem 0.75rem", marginBottom: "0.5rem", border: "1px solid var(--d-border)" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", marginBottom: "0.2rem" }}>{u.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}>Station: {u.station}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}>Leader: {u.teamLeader} · {u.contact}</div>
                </div>
              ))}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--d-text-sub)", marginBottom: "0.5rem" }}>Incident Description</div>
        <div className="dp-ticket-desc">{inc.description}</div>
        {inc.notes && (
          <>
            <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--d-text-sub)", marginBottom: "0.5rem", marginTop: "0.75rem" }}>Field Notes</div>
            <div className="dp-ticket-desc" style={{ whiteSpace: "pre-line" }}>{inc.notes}</div>
          </>
        )}
      </div>
      <div className="dp-modal-footer">
        <button className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
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
function ResourceMapPage({ incidents, units, onUpdate, dispatchTarget, onClearDispatchTarget }: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
  dispatchTarget: Incident | null;
  onClearDispatchTarget: () => void;
}) {
  // If a dispatchTarget arrives from dashboard, start in dispatch mode
  const [mapMode, setMapMode] = useState<"monitoring" | "dispatch">(dispatchTarget ? "dispatch" : "monitoring");
  const [filterType, setFilterType] = useState("All");
  const [selInc, setSelInc] = useState<Incident | null>(dispatchTarget);
  const [assigned, setAssigned] = useState<string[]>(dispatchTarget?.assignedUnits ?? []);
  const [invalidModal, setInvalidModal] = useState<Incident | null>(null);
  const [reason, setReason] = useState("");
  const toast = useToast();

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
      setAssigned(p => {
        if (p.includes(uid)) {
          toast.show(`${uid} deselected`);
          return p.filter(id => id !== uid);
        }
        toast.show(`${uid} selected for assignment`);
        return [...p, uid];
      });
    };
    (window as any).__dpMsg = (uid: string) => toast.show(`Message sent to ${uid}`);
    return () => { delete (window as any).__dpAssign; delete (window as any).__dpMsg; };
  }, [selInc]);

  const confirmDispatch = () => {
    // Move incident to Dispatched/In Progress
    if (selInc) {
      onUpdate(selInc.id, {
        status: "Dispatched",
        assignedUnits: assigned,
        dispatchedAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
      });
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
    toast.show(`${invalidModal.id} marked invalid`);
    setInvalidModal(null);
    setReason("");
  };

  const assignedUnits = assigned.map(id => units.find(u => u.id === id)).filter(Boolean) as Unit[];

  const LEGEND_MON: [string, string][] = [["Available","#2e7d32"],["On Route","#1565c0"],["On Scene","#c62828"],["Offline","#9e9e9e"]];
  const LEGEND_DIS: [string, string][] = [["FIRE","#c2440a"],["AMB","#1565c0"],["POL","#5e35b1"]];

  return (
    <div className="dp-map-page dp-fade-in">
      {/* Controls */}
      <div className="dp-map-controls">
        <div className="dp-map-mode-tabs">
          {(["monitoring","dispatch"] as const).map(m => (
            <button
              key={m}
              className={`dp-map-tab ${mapMode === m ? "active" : ""}`}
              onClick={() => {
                if (m !== "dispatch") { setSelInc(null); setAssigned([]); onClearDispatchTarget(); }
                setMapMode(m);
              }}
            >
              {m === "monitoring" ? "🗺 Live Monitoring" : "🚨 Dispatch Select"}
            </button>
          ))}
        </div>
        <div className="dp-map-legend">
          {(mapMode === "dispatch" ? LEGEND_DIS : LEGEND_MON).map(([l, c]) => (
            <div key={l} className="dp-legend-item"><span className="dp-legend-dot" style={{ background: c }} />{l}</div>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select className="dp-input" style={{ width: "auto", padding: "0.4rem 0.7rem", fontSize: "0.8rem" }} value={filterType} onChange={e => { setFilterType(e.target.value); }}>
            <option value="All">All Units</option>
            <option value="FIRE">🔥 Fire</option>
            <option value="AMB">🚑 Ambulance</option>
            <option value="POL">🚔 Police</option>
          </select>
          {mapMode === "dispatch" && selInc && assigned.length > 0 && (
            <button className="dp-btn dp-btn-green dp-btn-sm" onClick={confirmDispatch}>✓ Confirm Dispatch</button>
          )}
          {mapMode !== "monitoring" && (
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setMapMode("monitoring"); setSelInc(null); setAssigned([]); onClearDispatchTarget(); }}>← Back</button>
          )}
        </div>
      </div>

      <div className="dp-map-body">
        {/* Dispatch side panel */}
        {/* Dispatch side panel */}
        {mapMode === "dispatch" && (
          <div className="dp-dispatch-panel">
            {!selInc ? (
              <div className="dp-dispatch-panel-empty">
                <div style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--d-text-sub)", marginBottom: "1rem", marginTop: "0.75rem", padding: "0 0.75rem" }}>
                  Select Incident to Dispatch
                </div>
                <div className="dp-dispatch-units" style={{ flex: 1, overflowY: "auto", padding: "0 0.4rem" }}>
                  {incidents.filter(i => ["New", "Waiting"].includes(i.status)).map(i => (
                    <div key={i.id} className="dp-unit-card" style={{ cursor: "pointer", borderLeft: `4px solid ${priorityColor(i.priority)}`, padding: "0.8rem" }} onClick={() => setSelInc(i)}>
                      <div className="dp-unit-card-name" style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>{i.type}</div>
                      <div className="dp-unit-card-info" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
                        ID: <strong style={{ fontFamily: "monospace" }}>{shortenId(i.id)}</strong><br />
                        Loc: {i.location}<br />
                        Time: {i.timeReported}
                      </div>
                    </div>
                  ))}
                  {incidents.filter(i => ["New", "Waiting"].includes(i.status)).length === 0 && (
                    <p style={{ fontSize: "0.85rem", color: "var(--d-text-sub)", textAlign: "center", marginTop: "2rem" }}>No pending incidents.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="dp-dispatch-panel-header">
                  <div className="dp-dispatch-panel-title">Dispatching units to</div>
                  <div className="dp-dispatch-panel-id">{shortenId(selInc.id)} — {selInc.type}</div>
                  <div className="dp-dispatch-panel-addr">📍 {selInc.address}</div>
                  <button className="dp-btn dp-btn-ghost dp-btn-xs" style={{ marginTop: "0.5rem" }} onClick={() => { setSelInc(null); setAssigned([]); }}>Change Incident</button>
                </div>
                <div className="dp-dispatch-units">
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--d-text-sub)", marginBottom: "0.6rem" }}>Available Units</div>
                  {units.filter(u => u.status === "Available").map(u => {
                    const isAss = assigned.includes(u.id);
                    const c = unitTypeColor(u.type);
                    return (
                      <div key={u.id} className={`dp-unit-card ${isAss ? "assigned" : ""}`}>
                        <div className="dp-unit-card-name">
                          <span style={{ fontSize: "1rem" }}>{UNIT_TYPE_ICON[u.type]}</span>{u.name}
                        </div>
                        <div className="dp-unit-card-info">
                          Station: {u.station}<br />
                          Distance: <strong>{u.distance}</strong> · ETA: <strong>{u.eta}</strong><br />
                          Crew: <strong>{u.personnel}</strong> · {u.teamLeader}
                        </div>
                        <div className="dp-unit-card-actions">
                          <button className="dp-btn dp-btn-ghost dp-btn-sm" style={{ flex: 1 }} onClick={() => toast.show(`Message sent to ${u.name}`)}>Message</button>
                          <button
                            className="dp-btn dp-btn-sm"
                            style={{ flex: 1, background: isAss ? "var(--d-green)" : c, color: "#fff", border: "none" }}
                            onClick={() => (window as any).__dpAssign(u.id)}
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
                    <div className="dp-dispatch-assigned-title">Assigned Units ({assignedUnits.length})</div>
                    <table className="dp-table" style={{ fontSize: "0.78rem" }}>
                      <thead><tr><th>ID</th><th>Type</th><th>ETA</th><th>Status</th></tr></thead>
                      <tbody>
                        {assignedUnits.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{u.id}</td>
                            <td>{u.type}</td>
                            <td>{u.eta}</td>
                            <td style={{ color: "var(--d-blue)", fontWeight: 700 }}>On Route</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="dp-btn dp-btn-orange" style={{ width: "100%", marginTop: "0.6rem", justifyContent: "center" }} onClick={confirmDispatch}>Confirm Dispatch →</button>
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
              mode={mapMode === "dispatch" ? "dispatch" : "monitoring"}
              incidents={incidents}
              units={units}
              filterType={filterType}
              selectedIncident={selInc}
              assignedUnits={assigned}
              onUnitAssign={uid => (window as any).__dpAssign(uid)}
              onIncidentClick={i => setSelInc(i)}
              height="100%"
            />
          </div>
        </div>
      </div>

      {/* Invalid modal */}
      {invalidModal && (
        <Modal title={`Mark ${invalidModal.id} as Invalid`} onClose={() => { setInvalidModal(null); setReason(""); }} width={460}>
          <div style={{ background: "var(--d-surface-low)", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.85rem", color: "var(--d-text-muted)" }}>
            <strong style={{ color: "var(--d-text)" }}>{invalidModal.type}</strong> at {invalidModal.address} — {invalidModal.timeReported}
          </div>
          <label className="dp-label">Reason *</label>
          <textarea className="dp-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Duplicate report, false alarm..." style={{ width: "100%", marginBottom: "1rem" }} />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => { setInvalidModal(null); setReason(""); }}>Cancel</button>
            <button className="dp-btn dp-btn-red" disabled={!reason.trim()} onClick={confirmInvalid}>Confirm Invalid</button>
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
function RescueMonitoringPage({ incidents, units, onUpdate }: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
}) {
  const [selInc, setSelInc] = useState<Incident | null>(null);
  const [backupModal, setBackupModal] = useState<Incident | null>(null);
  const [escalateModal, setEscalateModal] = useState<Incident | null>(null);
  const [backupNote, setBackupNote] = useState("");
  const [mapKey, setMapKey] = useState(0);
  const [afterCalamityInc, setAfterCalamityInc] = useState<Incident | null>(null);
  const [afterStep, setAfterStep] = useState<"confirm" | "verify" | "close">("confirm");
  const [safetyChecked, setSafetyChecked] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (window as any).__dpBackup   = (id: string) => { onUpdate(id, { situationType: "Escalating" }); toast.show(`Backup requested for ${id}`); };
    (window as any).__dpEscalate = (id: string) => { onUpdate(id, { situationType: "Critical"  }); toast.show(`${id} escalated`); };
    return () => { delete (window as any).__dpBackup; delete (window as any).__dpEscalate; };
  }, []);

  // Only show Dispatched + In Progress
  const activeInc = incidents.filter(i => ["Dispatched", "In Progress"].includes(i.status));

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
    onUpdate(inc.id, { status: "Resolved", resolvedAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
    setAfterCalamityInc(null);
    setSelInc(null);
    setMapKey(k => k + 1);
    toast.show(`${inc.id} marked as Resolved / Closed`);
  };

  return (
    <div className="dp-incidents-page dp-fade-in">

      {/* ── Left: in-progress list ── */}
      <div className="dp-incidents-list">
        <div className="dp-incidents-filters">
          <div className="dp-incidents-counts">
            <div className="dp-count-box" style={{ background: "var(--d-primary-light)" }}>
              <div className="num" style={{ color: "var(--d-primary)" }}>{activeInc.length}</div>
              <div className="lbl" style={{ color: "var(--d-primary)" }}>In Progress</div>
            </div>
            <div className="dp-count-box" style={{ background: "rgba(21,101,192,0.08)" }}>
              <div className="num" style={{ color: "var(--d-blue)" }}>{incidents.filter(i => i.status === "Resolved").length}</div>
              <div className="lbl" style={{ color: "var(--d-blue)" }}>Resolved</div>
            </div>
          </div>
          {/* Situation legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.6rem 0.2rem" }}>
            {(["Under Control","Escalating","Critical"] as SituationType[]).map(s => {
              const c = situationColor(s);
              const count = activeInc.filter(i => i.situationType === s).length;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--d-text-muted)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Situation {s}</span>
                  <span style={{ fontWeight: 800, color: c }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs: All / by situation */}
        <div className="dp-incidents-tab-row">
          <span style={{ padding: "0.6rem 1rem", fontSize: "0.8rem", fontWeight: 800, color: "var(--d-text-muted)" }}>Incidents in Progress</span>
        </div>

        <div className="dp-incidents-scroll">
          {activeInc.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-title">No active rescues</div>
              <div className="dp-empty-sub">All incidents are resolved or pending</div>
            </div>
          ) : activeInc.map(inc => {
            const dotColor = situationColor(inc.situationType);
            return (
              <div
                key={inc.id}
                className={`dp-incident-list-item ${selInc?.id === inc.id ? "active" : ""}`}
                onClick={() => handleSelect(inc)}
              >
                <span className="dp-incident-list-dot" style={{ background: dotColor }} />
                <div className="dp-incident-list-body">
                  <div className="dp-incident-list-id">{inc.id}</div>
                  <div className="dp-incident-list-type">{inc.type}</div>
                  <div className="dp-incident-list-loc">{inc.location}, {inc.city}</div>
                  <div className="dp-incident-list-meta">
                    <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
                    <Badge label={inc.situationType} cls={situationClass(inc.situationType)} />
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--d-text-sub)", marginTop: "0.2rem" }}>
                    ⏱ Active: {inc.timeActive} min · {inc.assignedUnits.length} unit{inc.assignedUnits.length !== 1 ? "s" : ""} assigned
                  </div>
                </div>
                <span className="dp-incident-list-arrow">›</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Map + rescue detail ── */}
      <div className="dp-incidents-map">
        {/* Map header with situation legend */}
        <div className="dp-map-header">
          <span className="dp-map-header-title">🛡 Rescue Monitoring</span>
          <div className="dp-rescue-legend">
            {(["Under Control","Escalating","Critical"] as SituationType[]).map(s => (
              <div key={s} className="dp-rescue-legend-item">
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: situationColor(s), display: "inline-block", flexShrink: 0 }} />
                Situation {s}
              </div>
            ))}
          </div>
        </div>

        {/* Map — zooms to selected incident */}
        <div style={{ flex: selInc ? "0 0 42%" : "1", minHeight: 0 }}>
          <LiveMap
            mode="rescue"
            incidents={incidents}
            units={units}
            selectedIncident={selInc}
            onIncidentClick={handleSelect}
            height="100%"
          />
        </div>

        {/* Rescue detail panel for selected incident */}
        {selInc && (
          <div style={{ flex: 1, overflowY: "auto", background: "var(--d-bg)" }}>
            <RescueDetailPanel
              inc={selInc}
              units={units}
              onBackup={() => setBackupModal(selInc)}
              onEscalate={() => setEscalateModal(selInc)}
              onResolve={() => handleResolve(selInc)}
              onClose={() => setSelInc(null)}
            />
          </div>
        )}
      </div>

      {/* Backup modal */}
      {backupModal && (
        <Modal title={`Request Backup — ${backupModal.id}`} onClose={() => { setBackupModal(null); setBackupNote(""); }} width={460}>
          <div className="dp-alert dp-alert-amber" style={{ marginBottom: "1rem" }}>
            {backupModal.type} · {backupModal.address} — Situation: {backupModal.situationType}
          </div>
          <label className="dp-label">Backup request note</label>
          <textarea className="dp-textarea" rows={3} value={backupNote} onChange={e => setBackupNote(e.target.value)} placeholder="Describe why backup is needed..." style={{ width: "100%", marginBottom: "1rem" }} />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => { setBackupModal(null); setBackupNote(""); }}>Cancel</button>
            <button className="dp-btn dp-btn-orange" disabled={!backupNote.trim()} onClick={() => {
              onUpdate(backupModal.id, { situationType: "Escalating" });
              toast.show(`Backup requested for ${backupModal.id}`);
              setBackupModal(null); setBackupNote("");
            }}>Send Backup Request</button>
          </div>
        </Modal>
      )}

      {/* Escalate modal */}
      {escalateModal && (
        <Modal title={`High-Level Intervention — ${escalateModal.id}`} onClose={() => setEscalateModal(null)} width={460}>
          <div className="dp-alert dp-alert-red" style={{ marginBottom: "1rem" }}>
            ⚠️ You are escalating <strong>{escalateModal.id}</strong> to High-Level Intervention. This will flag the incident as Critical and notify senior command.
          </div>
          <div style={{ background: "var(--d-surface-low)", borderRadius: 8, padding: "0.7rem", fontSize: "0.85rem", color: "var(--d-text-muted)" }}>
            {escalateModal.type} · {escalateModal.address}<br />Assigned: {escalateModal.assignedUnits.length} units
          </div>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => setEscalateModal(null)}>Cancel</button>
            <button className="dp-btn dp-btn-red" onClick={() => {
              onUpdate(escalateModal.id, { situationType: "Critical" });
              toast.show(`${escalateModal.id} escalated`);
              setEscalateModal(null);
            }}>Confirm Escalation</button>
          </div>
        </Modal>
      )}


      {/* ── After Calamity Modal (Receive Confirmation → Verify Safety → Mark Resolved) ── */}
      {afterCalamityInc && (
        <Modal
          title={`After Calamity — ${afterCalamityInc.id}`}
          onClose={() => setAfterCalamityInc(null)}
          width={500}
        >
          {/* Step indicator */}
          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem" }}>
            {(["confirm", "verify", "close"] as const).map((s, i) => {
              const labels = ["Receive Confirmation", "Verify Victim Safety", "Mark Resolved/Closed"];
              const idx = ["confirm", "verify", "close"].indexOf(afterStep);
              const done = idx > i;
              const active = afterStep === s;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: 1 }}>
                  <div style={{
                    flex: 1,
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    textAlign: "center",
                    background: done ? "var(--d-green)" : active ? "var(--d-primary)" : "var(--d-surface-low)",
                    color: done || active ? "#fff" : "var(--d-text-sub)",
                    border: done || active ? "none" : "1px solid var(--d-border)",
                  }}>
                    {i + 1}. {labels[i]}
                  </div>
                  {i < 2 && <span style={{ color: "var(--d-text-sub)", fontSize: "0.6rem" }}>›</span>}
                </div>
              );
            })}
          </div>

          {/* Step 1: Receive Rescue Complete Confirmation */}
          {afterStep === "confirm" && (
            <div>
              <div className="dp-alert dp-alert-green" style={{ marginBottom: "1.25rem" }}>
                <strong>Rescue Complete — Awaiting Confirmation</strong><br />
                Field unit has signalled rescue operations are complete for {afterCalamityInc.id}.
              </div>
              <div style={{ padding: "0.85rem 1rem", background: "var(--d-surface-low)", borderRadius: "0.75rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
                <div style={{ fontWeight: 800, marginBottom: "0.4rem" }}>{afterCalamityInc.id} — {afterCalamityInc.type}</div>
                <div style={{ color: "var(--d-text-sub)", marginBottom: "0.25rem" }}>{afterCalamityInc.address}</div>
                <div>Units: <strong>{afterCalamityInc.assignedUnits.join(", ") || "N/A"}</strong></div>
                <div style={{ marginTop: "0.4rem", color: "var(--d-text-sub)" }}>Confirmation received at: <strong style={{ color: "var(--d-text)" }}>
                  {new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                </strong></div>
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
              <div className="dp-alert dp-alert-blue" style={{ marginBottom: "1.25rem" }}>
                Confirm that all rescued persons are safe and handed off to appropriate care.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                {[
                  { label: "All persons accounted for", done: true },
                  { label: "Transferred to medical care / family", done: true },
                  { label: "Identity documented", done: true },
                  { label: "Families notified", done: safetyChecked },
                ].map((chk, i) => (
                  <div
                    key={i}
                    onClick={() => i === 3 && setSafetyChecked(v => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.6rem",
                      padding: "0.7rem 0.9rem",
                      background: chk.done ? "var(--d-green-bg)" : "var(--d-surface-low)",
                      borderRadius: "0.65rem",
                      cursor: i === 3 ? "pointer" : "default",
                      border: i === 3 ? "1px dashed var(--d-border)" : "1px solid transparent",
                    }}
                  >
                    <span style={{ color: chk.done ? "var(--d-green)" : "var(--d-text-sub)", fontWeight: 800 }}>
                      {chk.done ? "✓" : "○"}
                    </span>
                    <span style={{ fontSize: "0.82rem" }}>{chk.label}</span>
                    {i === 3 && <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--d-text-sub)" }}>(tap to confirm)</span>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                <button className="dp-btn dp-btn-ghost" onClick={() => setAfterStep("confirm")}>← Back</button>
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
              <div className="dp-alert dp-alert-green" style={{ marginBottom: "1.25rem" }}>
                <strong>Victim safety verified.</strong> Ready to mark {afterCalamityInc.id} as Resolved / Closed.
              </div>
              <div style={{ padding: "0.85rem 1rem", background: "var(--d-surface-low)", borderRadius: "0.75rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
                <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>Incident Summary</div>
                <div style={{ color: "var(--d-text-sub)", marginBottom: "0.2rem" }}>{afterCalamityInc.id} · {afterCalamityInc.type}</div>
                <div style={{ color: "var(--d-text-sub)", marginBottom: "0.2rem" }}>{afterCalamityInc.address}</div>
                <div style={{ color: "var(--d-text-sub)" }}>Units: {afterCalamityInc.assignedUnits.join(", ") || "N/A"}</div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                <button className="dp-btn dp-btn-ghost" onClick={() => setAfterStep("verify")}>← Back</button>
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

// Rescue detail panel — comprehensive real-time rescue monitoring view
function RescueDetailPanel({ inc, units, onBackup, onEscalate, onResolve, onClose }: {
  inc: Incident; units: Unit[];
  onBackup: () => void; onEscalate: () => void; onResolve: () => void; onClose: () => void;
}) {
  const assigned = inc.assignedUnits.map(id => units.find(u => u.id === id)).filter(Boolean) as Unit[];
  const sc = situationColor(inc.situationType);

  // ── Mock real-time data derived from incident ──────────────────────────────
  const now = new Date();
  const dispatchTime = inc.dispatchedAt || "09:23 AM";

  // Victims derived from description keywords
  const victimData = [
    { name: "Victim 1", condition: "Critical", color: "#c62828", status: "Trapped" },
    { name: "Victim 2", condition: "Injured",  color: "#c77700", status: "Awaiting rescue" },
    { name: "Victim 3", condition: "Safe",     color: "#2e7d32", status: "Evacuated" },
  ].slice(0, inc.category === "AMB" ? 2 : 3);

  // Timeline entries
  const timeline = [
    { time: inc.timeReported,  msg: `Incident reported — ${inc.type}`, actor: inc.reporter, color: "#c62828",  icon: "!" },
    { time: dispatchTime,       msg: `Dispatch confirmed. ${assigned.length} unit(s) deployed.`, actor: "Dispatcher DS", color: "#c2440a", icon: "⚡" },
    ...(assigned.length > 0 ? [{ time: addMins(dispatchTime, 2), msg: `${assigned[0]?.name} en route to scene.`, actor: assigned[0]?.teamLeader || "", color: "#1565c0", icon: "→" }] : []),
    ...(inc.timeActive > 5 ? [{ time: addMins(dispatchTime, 5), msg: "First responders arrived on scene.", actor: assigned[0]?.name || "Unit", color: "#2e7d32", icon: "✓" }] : []),
    ...(inc.timeActive > 10 ? [{ time: addMins(dispatchTime, 8), msg: `Situation assessed: ${inc.situationType}. Rescue operations ongoing.`, actor: "Field Lead", color: situationColor(inc.situationType), icon: "●" }] : []),
    ...(inc.notes ? [{ time: addMins(dispatchTime, inc.timeActive - 1), msg: inc.notes, actor: "Field Officer", color: "#6a1b9a", icon: "📝" }] : []),
  ];

  // Comms feed
  const comms = [
    { type: "radio", time: addMins(dispatchTime, 1), from: assigned[0]?.teamLeader || "Unit Lead", msg: `En route to ${inc.location}. ETA ${assigned[0]?.eta || "5 mins"}.` },
    { type: "update", time: addMins(dispatchTime, 3), from: "Dispatch Center", msg: `${inc.id} acknowledged. All units proceed to ${inc.address}.` },
    ...(inc.timeActive > 8 ? [{ type: "radio", time: addMins(dispatchTime, 6), from: assigned[0]?.teamLeader || "Unit Lead", msg: "On scene. Assessing situation. Requesting more details." }] : []),
    ...(inc.situationType === "Critical" ? [{ type: "alert", time: addMins(dispatchTime, 8), from: "System Alert", msg: `⚠ Situation escalated to CRITICAL at ${inc.location}. All nearby units on standby.` }] : []),
    ...(inc.timeActive > 12 ? [{ type: "update", time: addMins(dispatchTime, 10), from: "Field Lead", msg: `Scene secured. ${victimData.filter(v => v.condition !== "Safe").length} victim(s) still require assistance.` }] : []),
  ];

  // Nearby hospitals
  const hospitals = [
    { name: "UERM Medical Center",   dist: "1.2 km", eta: "4 mins",  cap: "Available",   capColor: "#2e7d32" },
    { name: "UST Hospital",          dist: "2.1 km", eta: "7 mins",  cap: "Available",   capColor: "#2e7d32" },
    { name: "Chinese General Hosp.", dist: "2.8 km", eta: "9 mins",  cap: "Near Capacity",capColor: "#c77700" },
    { name: "Ospital ng Sampaloc",   dist: "0.8 km", eta: "3 mins",  cap: "Available",   capColor: "#2e7d32" },
  ];

  // Resources on scene
  const resources = [
    ...(assigned.filter(u => u.type === "FIRE").map(u => ({ icon: "🚒", name: u.name, status: "On Scene", detail: `${u.personnel} firefighters · Hydraulic tools, breathing apparatus`, color: "#c2440a" }))),
    ...(assigned.filter(u => u.type === "AMB").map(u => ({ icon: "🚑", name: u.name, status: "On Scene", detail: `${u.personnel} paramedics · AED, trauma kit, oxygen`, color: "#1565c0" }))),
    ...(assigned.filter(u => u.type === "POL").map(u => ({ icon: "🚔", name: u.name, status: "On Scene", detail: `${u.personnel} officers · Crowd control, body cameras`, color: "#5e35b1" }))),
  ];

  // Risk & Environment
  const risks = [
    { icon: "🌦", label: "Weather", val: "Partly cloudy, 28°C · Wind 12 km/h NW · Visibility Good" },
    ...(inc.category === "FIRE" ? [
      { icon: "🔥", label: "Fire Spread Risk", val: "Moderate — Wind pushing northeast. Adjacent structures at risk if not contained within 15 mins." },
      { icon: "🏗", label: "Structural Stability", val: "Unknown — 3-storey building. Upper floors may be compromised. Entry only with full PPE." },
    ] : []),
    ...(inc.category === "Other" ? [
      { icon: "🌊", label: "Flood Level", val: `Rising — currently ${inc.timeActive > 10 ? "knee-to-waist" : "ankle"}-deep. Canal overflow ongoing.` },
    ] : []),
    { icon: "⚡", label: "Hazards", val: "Possible live electrical wires. Gas line proximity not confirmed. Keep 10m clearance." },
    { icon: "👥", label: "Crowd / Access", val: "Bystanders present. Road access partially blocked. Police establishing perimeter." },
  ];

  return (
    <div className="dp-fade-in" style={{ background: "var(--d-bg)" }}>
      {/* ── Sticky action header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--d-surface)", borderBottom: "1px solid var(--d-border)", padding: "0.75rem 1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 900, color: "var(--d-primary)" }}>{inc.id}</span>
          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--d-text)" }}>{inc.type}</span>
          <Badge label={inc.priority}      cls={priorityClass(inc.priority)} />
          <Badge label={inc.status}        cls={statusClass(inc.status)} />
          <Badge label={inc.situationType} cls={situationClass(inc.situationType)} />
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {inc.situationType !== "Critical" && (
            <button className="dp-btn dp-btn-sm dp-btn-outline-amber" onClick={onBackup}>+ Request Backup</button>
          )}
          <button className="dp-btn dp-btn-sm dp-btn-outline-red" onClick={onEscalate}>⚡ High-Level Intervention</button>
          <button className="dp-btn dp-btn-sm dp-btn-outline-green" onClick={onResolve}>Mark Resolved</button>
          <button className="dp-btn dp-btn-sm dp-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* ── Situation status bar ── */}
      <div style={{ padding: "0.8rem 1.2rem", background: `${sc}0d`, borderBottom: `1px solid ${sc}25` }}>
        <div className="dp-rescue-stat-row">
          {[
            { label: "Situation",     val: inc.situationType,            color: sc,                   sub: "" },
            { label: "Time Active",   val: `${inc.timeActive} min`,       color: "var(--d-text)",      sub: `Reported ${inc.timeReported}` },
            { label: "Units On Scene",val: `${assigned.length}`,          color: "var(--d-text)",      sub: assigned.map(u => u.type).join(", ") || "None" },
            { label: "Victims",       val: `${victimData.length}`,        color: "var(--d-red)",       sub: `${victimData.filter(v=>v.condition==="Critical").length} critical` },
            { label: "Dispatched At", val: dispatchTime,                  color: "var(--d-text)",      sub: `By ${MOCK_DISPATCHER.name}` },
          ].map(s => (
            <div key={s.label} className="dp-rescue-stat-box">
              <div className="dp-rescue-stat-box-label">{s.label}</div>
              <div className="dp-rescue-stat-box-val" style={{ color: s.color }}>{s.val}</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {[
                ["Ticket ID",  inc.id],
                ["Type",       inc.type],
                ["Address",    inc.address],
                ["Barangay",   inc.barangay],
                ["City",       inc.city],
                ["Reporter",   `${inc.reporter} · ${inc.reporterPhone}`],
                ["Date",       `${inc.dateReported} ${inc.timeReported}`],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
                  <span style={{ minWidth: 72, color: "var(--d-text-sub)", flexShrink: 0 }}>{l}</span>
                  <span style={{ color: "var(--d-text)", fontWeight: 500, lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
            </div>
            {inc.description && (
              <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: 7, fontSize: "0.8rem", color: "var(--d-text)", lineHeight: 1.55 }}>{inc.description}</div>
            )}
          </div>

          {/* 2. Status of Victims */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Status of Victims ({victimData.length})</div>
            {victimData.map((v, i) => (
              <div key={i} className="dp-victim-card">
                <span className="dp-victim-status-dot" style={{ background: v.color }} />
                <span className="dp-victim-name">{v.name}</span>
                <span className="dp-victim-cond" style={{ color: v.color }}>{v.condition}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--d-text-sub)", marginLeft: "0.3rem" }}>· {v.status}</span>
              </div>
            ))}
            <div style={{ marginTop: "0.4rem", padding: "0.5rem 0.65rem", background: "var(--d-surface-low)", borderRadius: 7, fontSize: "0.75rem", color: "var(--d-text-muted)" }}>
              Nearest available hospital: <strong style={{ color: "var(--d-text)" }}>{hospitals[0].name}</strong> — {hospitals[0].dist} · ETA {hospitals[0].eta}
            </div>
          </div>

          {/* 3. Team Updates */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Team Updates</div>
            {assigned.length === 0
              ? <div style={{ fontSize: "0.82rem", color: "var(--d-text-sub)", padding: "0.5rem 0" }}>No units currently assigned.</div>
              : assigned.map(u => {
                  const uc = unitTypeColor(u.type);
                  return (
                    <div key={u.id} style={{ background: "var(--d-surface)", border: `1px solid var(--d-border)`, borderLeft: `3px solid ${uc}`, borderRadius: 8, padding: "0.65rem 0.8rem", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <div style={{ fontWeight: 800, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span>{UNIT_TYPE_ICON[u.type]}</span>{u.name}
                        </div>
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#1565c0", background: "rgba(21,101,192,0.1)", padding: "0.15rem 0.5rem", borderRadius: 20 }}>On Scene</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--d-text-muted)", lineHeight: 1.5 }}>
                        Leader: <strong style={{ color: "var(--d-text)" }}>{u.teamLeader}</strong> · {u.contact}<br />
                        Station: {u.station} · Crew: {u.personnel} · ETA was {u.eta}
                      </div>
                      <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", color: "var(--d-primary)", fontWeight: 700 }}>
                        Activity: Rescue operations in progress
                      </div>
                    </div>
                  );
                })}
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
                  <span style={{ marginLeft: "auto", textTransform: "uppercase", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em" }}>{c.type}</span>
                </div>
                <div className="dp-comms-text">{c.msg}</div>
              </div>
            ))}
          </div>

          {/* 5. Resources & Equipment */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Resources & Equipment on Scene</div>
            {resources.length === 0
              ? <div style={{ fontSize: "0.82rem", color: "var(--d-text-sub)" }}>No resources deployed yet.</div>
              : resources.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.55rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(191,182,162,0.12)", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--d-text)" }}>{r.name}</span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: r.color }}>{r.status}</span>
                      </div>
                      <div style={{ fontSize: "0.73rem", color: "var(--d-text-muted)", marginTop: "0.1rem" }}>{r.detail}</div>
                    </div>
                  </div>
                ))}

            {/* Nearby hospitals */}
            <div style={{ marginTop: "0.8rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--d-text-sub)", marginBottom: "0.4rem" }}>Nearest Hospitals</div>
              {hospitals.map((h, i) => (
                <div key={i} className="dp-hospital-row">
                  <span className="dp-hospital-name">{h.name}</span>
                  <span className="dp-hospital-dist">{h.dist} · {h.eta}</span>
                  <span className="dp-hospital-cap" style={{ color: h.capColor }}>{h.cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Timeline / Activity Log */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Timeline / Activity Log</div>
            <div className="dp-timeline">
              {timeline.map((t, i) => (
                <div key={i} className="dp-timeline-item">
                  <div className="dp-timeline-dot" style={{ background: `${t.color}20`, color: t.color }}>{t.icon}</div>
                  <div className="dp-timeline-body">
                    <div className="dp-timeline-time">{t.time}</div>
                    <div className="dp-timeline-msg">{t.msg}</div>
                    {t.actor && <div className="dp-timeline-actor">{t.actor}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Decision Controls */}
          <div className="dp-rescue-section">
            <div className="dp-rescue-section-head">Decision Controls</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <button className="dp-btn dp-btn-outline-amber" style={{ justifyContent: "center", flexDirection: "column", gap: "0.15rem", height: 60, textAlign: "center" }} onClick={onBackup}>
                <span style={{ fontSize: "1.1rem" }}>+</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>Request Backup</span>
              </button>
              <button className="dp-btn dp-btn-outline-red" style={{ justifyContent: "center", flexDirection: "column", gap: "0.15rem", height: 60, textAlign: "center" }} onClick={onEscalate}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>High-Level Intervention</span>
              </button>
              <button className="dp-btn dp-btn-outline-blue" style={{ justifyContent: "center", flexDirection: "column", gap: "0.15rem", height: 60, textAlign: "center" }} onClick={() => {}}>
                <span style={{ fontSize: "1.1rem" }}>↗</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>Redirect Teams</span>
              </button>
              <button className="dp-btn dp-btn-outline-orange" style={{ justifyContent: "center", flexDirection: "column", gap: "0.15rem", height: 60, textAlign: "center" }} onClick={() => {}}>
                <span style={{ fontSize: "1.1rem" }}>📢</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>Send Alert / Instruction</span>
              </button>
            </div>
            <button className="dp-btn dp-btn-outline-green" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem", height: 44 }} onClick={onResolve}>
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
function IncidentsPage({ incidents, units, onUpdate }: {
  incidents: Incident[];
  units: Unit[];
  onUpdate: (id: string, p: Partial<Incident>) => void;
}) {
  const [tab, setTab] = useState<"All" | "In Progress" | "Completed" | "Invalid">("All");
  const [searchId,   setSearchId]   = useState("");
  const [searchType, setSearchType] = useState("");
  const [searchLoc,  setSearchLoc]  = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [priFilter,  setPriFilter]  = useState("All");
  const [selInc, setSelInc] = useState<Incident | null>(null);
  const [backupModal,   setBackupModal]   = useState<Incident | null>(null);
  const [escalateModal, setEscalateModal] = useState<Incident | null>(null);
  const [backupNote, setBackupNote] = useState("");
  const toast = useToast();

  const inProgress = incidents.filter(i => ["In Progress","Dispatched"].includes(i.status));
  const completed  = incidents.filter(i => i.status === "Resolved");
  const invalid    = incidents.filter(i => i.status === "Invalid");

  const filtered = incidents.filter(i => {
    if (tab === "In Progress" && !["In Progress","Dispatched"].includes(i.status)) return false;
    if (tab === "Completed"   && i.status !== "Resolved") return false;
    if (tab === "Invalid"     && i.status !== "Invalid")  return false;
    if (searchId   && !i.id.toLowerCase().includes(searchId.toLowerCase()))                           return false;
    if (searchType && !i.type.toLowerCase().includes(searchType.toLowerCase()))                       return false;
    if (searchLoc  && !i.address.toLowerCase().includes(searchLoc.toLowerCase()) && !i.location.toLowerCase().includes(searchLoc.toLowerCase())) return false;
    if (dateFilter && i.dateReported !== dateFilter) return false;
    if (priFilter !== "All" && i.priority !== priFilter) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>

      {/* ── Left: filters + list ── */}
      <div className="dp-incidents-list" style={{ width: 380 }}>
        <div className="dp-incidents-filters">
          {/* Counts row */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[
              { label: "In Progress", count: inProgress.length,     color: "var(--d-primary)", bg: "var(--d-primary-light)" },
              { label: "Completed",   count: completed.length,      color: "var(--d-blue)",    bg: "rgba(21,101,192,0.08)"  },
              { label: "Invalid",     count: invalid.length,        color: "var(--d-text-sub)","bg": "var(--d-surface-mid)"  },
            ].map(s => (
              <div key={s.label} className="dp-count-box" style={{ background: s.bg }}>
                <div className="num" style={{ color: s.color }}>{s.count}</div>
                <div className="lbl" style={{ color: s.color, fontSize: "0.65rem" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search fields */}
          <div className="dp-search-box">
            <span className="dp-search-icon">#</span>
            <input placeholder="Search Ticket ID..." value={searchId} onChange={e => setSearchId(e.target.value)} />
          </div>
          <div className="dp-search-box">
            <span className="dp-search-icon">S</span>
            <input placeholder="Filter by type..." value={searchType} onChange={e => setSearchType(e.target.value)} />
          </div>
          <div className="dp-search-box">
            <span className="dp-search-icon">L</span>
            <input placeholder="Filter by location..." value={searchLoc} onChange={e => setSearchLoc(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              type="date"
              className="dp-input"
              style={{ flex: 1, fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
            <select
              className="dp-input"
              style={{ flex: 1, fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}
              value={priFilter}
              onChange={e => setPriFilter(e.target.value)}
            >
              <option value="All">All Priority</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div className="dp-incidents-tab-row">
          {(["All","In Progress","Completed","Invalid"] as const).map(t => (
            <button key={t} className={`dp-incidents-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} style={{ fontSize: "0.76rem" }}>{t}</button>
          ))}
        </div>

        <div className="dp-incidents-scroll">
          {filtered.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-title">No results</div>
              <div className="dp-empty-sub">Try adjusting your filters</div>
            </div>
          ) : filtered.map(inc => {
            const dotColor = inc.status === "Resolved" ? "#2e7d32" : inc.status === "Invalid" ? "#9e9e9e" : situationColor(inc.situationType);
            return (
              <div
                key={inc.id}
                className={`dp-incident-list-item ${selInc?.id === inc.id ? "active" : ""}`}
                onClick={() => setSelInc(inc)}
              >
                <span className="dp-incident-list-dot" style={{ background: dotColor }} />
                <div className="dp-incident-list-body">
                  <div className="dp-incident-list-id">{inc.id}</div>
                  <div className="dp-incident-list-type">{inc.type}</div>
                  <div className="dp-incident-list-loc">📍 {inc.location}, {inc.city}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--d-text-sub)" }}>{inc.dateReported} · {inc.timeReported}</div>
                  <div className="dp-incident-list-meta">
                    <Badge label={inc.priority} cls={priorityClass(inc.priority)} />
                    <Badge label={inc.status}   cls={statusClass(inc.status)} />
                  </div>
                </div>
                <span className="dp-incident-list-arrow">›</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: ticket detail (no map) ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selInc ? (
          <div style={{ flex: 1, overflowY: "auto", background: "var(--d-bg)" }}>
            <ExpandedTicket
              inc={selInc}
              units={units}
              onBackup={() => setBackupModal(selInc)}
              onEscalate={() => setEscalateModal(selInc)}
              onResolve={() => {
                onUpdate(selInc.id, { status: "Resolved", resolvedAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
                toast.show(`${selInc.id} resolved`);
                setSelInc(null);
              }}
              onClose={() => setSelInc(null)}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--d-bg)" }}>
            <div className="dp-empty">
              <div className="dp-empty-title">Select an incident</div>
              <div className="dp-empty-sub">Click any ticket from the list to view its details</div>
            </div>
          </div>
        )}
      </div>

      {/* Backup modal */}
      {backupModal && (
        <Modal title={`Request Backup — ${backupModal.id}`} onClose={() => { setBackupModal(null); setBackupNote(""); }} width={460}>
          <div className="dp-alert dp-alert-amber" style={{ marginBottom: "1rem" }}>
            {backupModal.type} · {backupModal.address} — Situation: {backupModal.situationType}
          </div>
          <label className="dp-label">Backup request note</label>
          <textarea className="dp-textarea" rows={3} value={backupNote} onChange={e => setBackupNote(e.target.value)} placeholder="Describe why backup is needed..." style={{ width: "100%", marginBottom: "1rem" }} />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => { setBackupModal(null); setBackupNote(""); }}>Cancel</button>
            <button className="dp-btn dp-btn-orange" disabled={!backupNote.trim()} onClick={() => {
              onUpdate(backupModal.id, { situationType: "Escalating" });
              toast.show(`Backup requested for ${backupModal.id}`);
              setBackupModal(null); setBackupNote("");
            }}>Send Backup Request</button>
          </div>
        </Modal>
      )}

      {/* Escalate modal */}
      {escalateModal && (
        <Modal title={`High-Level Intervention — ${escalateModal.id}`} onClose={() => setEscalateModal(null)} width={460}>
          <div className="dp-alert dp-alert-red" style={{ marginBottom: "1rem" }}>
            ⚠️ Escalating <strong>{escalateModal.id}</strong> to High-Level Intervention. Senior command will be notified.
          </div>
          <div style={{ background: "var(--d-surface-low)", borderRadius: 8, padding: "0.7rem", fontSize: "0.85rem", color: "var(--d-text-muted)" }}>
            {escalateModal.type} · {escalateModal.address}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => setEscalateModal(null)}>Cancel</button>
            <button className="dp-btn dp-btn-red" onClick={() => {
              onUpdate(escalateModal.id, { situationType: "Critical" });
              toast.show(`${escalateModal.id} escalated`);
              setEscalateModal(null);
            }}>Confirm Escalation</button>
          </div>
        </Modal>
      )}

      {toast.msg && <Toast msg={toast.msg} />}
    </div>
  );
}

// ── Expanded ticket (used in Incidents page) ──────────────────────────────────
function ExpandedTicket({ inc, units, onBackup, onEscalate, onResolve, onClose }: {
  inc: Incident; units: Unit[];
  onBackup: () => void; onEscalate: () => void; onResolve: () => void; onClose: () => void;
}) {
  const assigned = inc.assignedUnits.map(id => units.find(u => u.id === id)).filter(Boolean) as Unit[];
  return (
    <div className="dp-ticket-detail dp-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 900, color: "var(--d-primary)" }}>{inc.id}</div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.3rem" }}>{inc.type}</div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <Badge label={inc.priority}      cls={priorityClass(inc.priority)} />
            <Badge label={inc.status}        cls={statusClass(inc.status)} />
            <Badge label={inc.situationType} cls={situationClass(inc.situationType)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["In Progress","Dispatched"].includes(inc.status) && inc.situationType !== "Critical" && (
            <button className="dp-btn dp-btn-sm dp-btn-outline-amber" onClick={onBackup}>Backup</button>
          )}
          {["In Progress","Dispatched"].includes(inc.status) && (
            <button className="dp-btn dp-btn-sm dp-btn-outline-red" onClick={onEscalate}>High-Level</button>
          )}
          {["In Progress","Dispatched"].includes(inc.status) && (
            <button className="dp-btn dp-btn-sm dp-btn-outline-green" onClick={onResolve}>Resolve</button>
          )}
          <button className="dp-btn dp-btn-sm dp-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="dp-ticket-detail-grid">
        <div>
          <div className="dp-ticket-section-label">Location & Report</div>
          {[
            ["Address",   inc.address],
            ["Barangay",  inc.barangay],
            ["City",      inc.city],
            ["Reporter",  inc.reporter],
            ["Phone",     inc.reporterPhone],
            ["Reported",  inc.timeReported],
            ["Date",      inc.dateReported],
            ["Active",    `${inc.timeActive} mins`],
          ].map(([l, v]) => (
            <div key={l} className="dp-ticket-row">
              <span className="dp-ticket-row-label">{l}</span>
              <span className="dp-ticket-row-val">{v}</span>
            </div>
          ))}
          {inc.dispatchedAt && <div className="dp-ticket-row"><span className="dp-ticket-row-label">Dispatched</span><span className="dp-ticket-row-val" style={{ fontWeight: 700 }}>{inc.dispatchedAt}</span></div>}
          {inc.resolvedAt   && <div className="dp-ticket-row"><span className="dp-ticket-row-label">Resolved</span><span className="dp-ticket-row-val" style={{ fontWeight: 700, color: "var(--d-green)" }}>{inc.resolvedAt}</span></div>}
        </div>
        <div>
          <div className="dp-ticket-section-label">Description & Notes</div>
          <div className="dp-ticket-desc">{inc.description}</div>
          {inc.notes && (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--d-text-sub)", textTransform: "uppercase", margin: "0.5rem 0 0.3rem" }}>Field Notes</div>
              <div className="dp-ticket-desc" style={{ whiteSpace: "pre-line" }}>{inc.notes}</div>
            </>
          )}
          {inc.invalidReason && (
            <div className="dp-alert dp-alert-red" style={{ marginTop: "0.5rem" }}>Invalid reason: {inc.invalidReason}</div>
          )}
        </div>
        <div>
          <div className="dp-ticket-section-label">Assigned Units ({assigned.length})</div>
          {assigned.length === 0
            ? <p style={{ fontSize: "0.85rem", color: "var(--d-text-sub)" }}>No units assigned.</p>
            : assigned.map(u => (
                <div key={u.id} style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: 8, padding: "0.6rem 0.75rem", marginBottom: "0.5rem" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", marginBottom: "0.2rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>{UNIT_TYPE_ICON[u.type]}</span>{u.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}>📍 {u.station}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--d-text-muted)" }}>{u.teamLeader} · {u.contact}</div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

function ResourcesPage({ units, setUnits }: { units: Unit[]; setUnits: React.Dispatch<React.SetStateAction<Unit[]>> }) {
  const [tab, setTab] = useState<"teams"|"units">("teams");
  const [teams, setTeams] = useState(MOCK_TEAMS);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [addUnitModal, setAddUnitModal] = useState(false);
  const [delConfirm, setDelConfirm] = useState<string|null>(null);
  const [msgModal, setMsgModal] = useState<Unit|null>(null);
  const [msgText, setMsgText] = useState("");
  const [newU, setNewU] = useState({ name:"",type:"FIRE",station:"",leader:"",contact:"",personnel:"",plate:"" });
  const toast = useToast();

  const TYPE_COLOR: Record<string,string> = { FIRE:"#c2440a",AMB:"#1565c0",POL:"#5e35b1" };
  const TYPE_BORDER: Record<string,string> = { FIRE:"var(--d-primary)",AMB:"var(--d-blue)",POL:"#5e35b1" };

  const filteredUnits = units.filter(u => {
    if (typeFilter!=="All"&&u.type!==typeFilter) return false;
    if (statusFilter!=="All"&&u.status!==statusFilter) return false;
    if (search&&!u.name.toLowerCase().includes(search.toLowerCase())&&!u.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredTeams = teams.filter(t => typeFilter==="All"||t.type===typeFilter);

  const TEAM_STATUS_CLS: Record<string,string> = { Ready:"dp-badge-green",Deployed:"dp-badge-blue",Standby:"dp-badge-amber",Offline:"dp-badge-grey" };

  const handleAddUnit = () => {
    if (!newU.name||!newU.station||!newU.leader||!newU.contact) return;
    const prefix = newU.type;
    const id = `${prefix}-${String(units.filter(u=>u.type===newU.type).length+10).padStart(2,"0")}`;
    setUnits(p=>[...p,{ id, type:newU.type as UnitType, name:newU.name, station:newU.station, status:"Available", lat:14.604+(Math.random()-.5)*.05, lng:120.997+(Math.random()-.5)*.05, personnel:parseInt(newU.personnel)||3, distance:"—", eta:"—", teamLeader:newU.leader, contact:newU.contact, plateNumber:newU.plate||"—", lastActive:"Just added" }]);
    setAddUnitModal(false); setNewU({ name:"",type:"FIRE",station:"",leader:"",contact:"",personnel:"",plate:"" });
    toast.show(`${newU.name} added to roster`);
  };

  return (
    <div className="dp-resources dp-fade-in">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
        <div>
          <h2 style={{ margin:"0 0 0.25rem",fontSize:"1.35rem",fontWeight:900,letterSpacing:"-0.04em" }}>Resources</h2>
          <p style={{ margin:0,fontSize:"0.875rem",color:"var(--d-text-muted)" }}>Manage teams, units, and responders across Metro Cluster 3</p>
        </div>
        <div style={{ display:"flex",gap:"0.6rem" }}>
          {tab==="units"&&<button className="dp-btn dp-btn-orange" onClick={()=>setAddUnitModal(true)}>+ Add Unit</button>}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.75rem" }}>
        {[{ l:"Total Units",v:units.length,c:"var(--d-text)" },{ l:"Available",v:units.filter(u=>u.status==="Available").length,c:"var(--d-green)" },{ l:"Deployed",v:units.filter(u=>["On Route","On Scene"].includes(u.status)).length,c:"var(--d-primary)" },{ l:"Offline",v:units.filter(u=>u.status==="Offline").length,c:"var(--d-text-sub)" }].map(s=>(
          <div key={s.l} className="dp-stat"><div className="dp-stat-label">{s.l}</div><div className="dp-stat-value" style={{ color:s.c,fontSize:"1.6rem" }}>{s.v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="dp-resources-tabs">
        <button className={`dp-resources-tab ${tab==="teams"?"active":""}`} onClick={()=>setTab("teams")}>🏢 Response Teams</button>
        <button className={`dp-resources-tab ${tab==="units"?"active":""}`} onClick={()=>setTab("units")}>Individual Units</button>
      </div>

      {/* Filters */}
      <div className="dp-filter-row">
        {["All","FIRE","AMB","POL"].map(f=><button key={f} className={`dp-filter-pill ${typeFilter===f?"active":""}`} onClick={()=>setTypeFilter(f)}>{f==="All"?"All Types":`${UNIT_TYPE_ICON[f as UnitType]||""} ${f}`}</button>)}
        {tab==="units"&&["All","Available","On Route","On Scene","Offline"].map(s=><button key={s} className={`dp-filter-pill ${statusFilter===s?"active":""}`} onClick={()=>setStatusFilter(s)}>{s}</button>)}
        {tab==="units"&&(
          <div className="dp-search-box" style={{ marginLeft:"auto" }}>
            <span className="dp-search-icon">🔍</span>
            <input placeholder="Search units..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:160 }} />
          </div>
        )}
      </div>

      {/* Teams */}
      {tab==="teams"&&(
        <div className="dp-team-grid">
          {filteredTeams.map(team=>(
            <div key={team.id} className="dp-team-card" style={{ borderTopColor:TYPE_BORDER[team.type] }}>
              <div className="dp-team-card-header">
                <div>
                  <div className="dp-team-card-name">{UNIT_TYPE_ICON[team.type]} {team.name}</div>
                  <div className="dp-team-card-station">{team.station}</div>
                </div>
                <Badge label={team.status} cls={TEAM_STATUS_CLS[team.status]} />
              </div>
              <div className="dp-team-card-grid">
                {[["Leader",team.leader],["Contact",team.contact],["Members",`${team.members} personnel`],["Vehicles",`${team.vehicles} units`],["Coverage",team.coverage]].map(([l,v])=>(
                  <div key={l}><div className="dp-team-card-item-label">{l}</div><div className="dp-team-card-item-val">{v}</div></div>
                ))}
              </div>
              <div className="dp-equipment-list">
                {team.equipment.map(e=><span key={e} className="dp-equipment-tag">{e}</span>)}
              </div>
              <div className="dp-team-card-footer">
                <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={()=>toast.show(`Message sent to ${team.name}`)}>💬 Message</button>
                <button className="dp-btn dp-btn-ghost dp-btn-sm" style={{ borderColor:"var(--d-red)",color:"var(--d-red)" }} onClick={()=>{setTeams(p=>p.filter(t=>t.id!==team.id));toast.show(`${team.name} removed`);}}>🗑 Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Units table */}
      {tab==="units"&&(
        <div className="dp-card">
          <table className="dp-table">
            <thead><tr><th>Unit ID</th><th>Type</th><th>Name</th><th>Station</th><th>Leader</th><th>Contact</th><th>Plate</th><th>Personnel</th><th>Status</th><th>Last Active</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredUnits.map(u=>(
                <tr key={u.id}>
                  <td style={{ fontFamily:"monospace",fontWeight:700,color:TYPE_COLOR[u.type] }}>{u.id}</td>
                  <td><span style={{ fontSize:"1.1rem" }}>{UNIT_TYPE_ICON[u.type]}</span></td>
                  <td style={{ fontWeight:600 }}>{u.name}</td>
                  <td style={{ color:"var(--d-text-muted)",fontSize:"0.8rem" }}>{u.station}</td>
                  <td style={{ fontSize:"0.85rem" }}>{u.teamLeader}</td>
                  <td style={{ fontFamily:"monospace",fontSize:"0.78rem",color:"var(--d-text-muted)" }}>{u.contact}</td>
                  <td style={{ fontFamily:"monospace",fontSize:"0.78rem",color:"var(--d-text-sub)" }}>{u.plateNumber}</td>
                  <td style={{ textAlign:"center",fontWeight:700 }}>{u.personnel}</td>
                  <td>
                    <div style={{ display:"flex",alignItems:"center",gap:"0.35rem" }}>
                      <span className="dp-unit-status-dot" style={{ background:unitStatusColor(u.status) }} />
                      <span style={{ fontSize:"0.8rem",fontWeight:600 }}>{u.status}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:"0.78rem",color:"var(--d-text-sub)" }}>{u.lastActive}</td>
                  <td>
                    <div style={{ display:"flex",gap:"0.35rem" }}>
                      <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={()=>{setMsgModal(u);setMsgText("")}}>💬</button>
                      <button className="dp-btn dp-btn-ghost dp-btn-sm" style={{ borderColor:u.status==="Offline"?"var(--d-green)":"var(--d-red)",color:u.status==="Offline"?"var(--d-green)":"var(--d-red)" }} onClick={()=>{setUnits(p=>p.map(x=>x.id===u.id?{...x,status:x.status==="Offline"?"Available":"Offline"}:x));toast.show(`${u.id} ${u.status==="Offline"?"enabled":"disabled"}`)}}>
                        {u.status==="Offline"?"Enable":"Disable"}
                      </button>
                      <button className="dp-btn dp-btn-ghost dp-btn-sm" style={{ borderColor:"var(--d-red)",color:"var(--d-red)" }} onClick={()=>setDelConfirm(u.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUnits.length===0&&<tr><td colSpan={11} style={{ padding:"2rem",textAlign:"center",color:"var(--d-text-sub)" }}>No units match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add unit modal */}
      {addUnitModal&&(
        <Modal title="Add New Unit" onClose={()=>setAddUnitModal(false)}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem" }}>
            <div className="dp-field"><label>Unit Name *</label><input value={newU.name} onChange={e=>setNewU(p=>({...p,name:e.target.value}))} placeholder="e.g. Fire Unit Echo-2"/></div>
            <div className="dp-field"><label>Type *</label><select value={newU.type} onChange={e=>setNewU(p=>({...p,type:e.target.value}))}><option value="FIRE">🔥 Fire (FIRE)</option><option value="AMB">🚑 Ambulance (AMB)</option><option value="POL">🚔 Police (POL)</option></select></div>
            <div className="dp-field" style={{ gridColumn:"span 2" }}><label>Station *</label><input value={newU.station} onChange={e=>setNewU(p=>({...p,station:e.target.value}))} placeholder="Station address"/></div>
            <div className="dp-field"><label>Team Leader *</label><input value={newU.leader} onChange={e=>setNewU(p=>({...p,leader:e.target.value}))} placeholder="Full name and rank"/></div>
            <div className="dp-field"><label>Contact *</label><input value={newU.contact} onChange={e=>setNewU(p=>({...p,contact:e.target.value}))} placeholder="+63 912 000 0000"/></div>
            <div className="dp-field"><label>Personnel</label><input value={newU.personnel} onChange={e=>setNewU(p=>({...p,personnel:e.target.value}))} placeholder="e.g. 4"/></div>
            <div className="dp-field"><label>Plate Number</label><input value={newU.plate} onChange={e=>setNewU(p=>({...p,plate:e.target.value}))} placeholder="e.g. BFP-1099"/></div>
          </div>
          <div style={{ display:"flex",gap:"0.6rem",justifyContent:"flex-end",marginTop:"1.2rem" }}>
            <button className="dp-btn dp-btn-ghost" onClick={()=>setAddUnitModal(false)}>Cancel</button>
            <button className="dp-btn dp-btn-orange" disabled={!newU.name||!newU.station||!newU.leader||!newU.contact} onClick={handleAddUnit}>Add Unit</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delConfirm&&(
        <Modal title="Remove Unit" onClose={()=>setDelConfirm(null)} width={420}>
          <div className="dp-alert dp-alert-red" style={{ marginBottom:"1rem" }}>Are you sure you want to remove <strong>{delConfirm}</strong>? This action cannot be undone.</div>
          <div style={{ display:"flex",gap:"0.6rem",justifyContent:"flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
            <button className="dp-btn dp-btn-red" onClick={()=>{ setUnits(p=>p.filter(u=>u.id!==delConfirm)); setDelConfirm(null); toast.show(`Unit ${delConfirm} removed`); }}>Confirm Remove</button>
          </div>
        </Modal>
      )}

      {/* Message modal */}
      {msgModal&&(
        <Modal title={`Message — ${msgModal.name}`} onClose={()=>setMsgModal(null)} width={440}>
          <div style={{ background:"var(--d-surface-low)",borderRadius:8,padding:"0.7rem",marginBottom:"1rem",fontSize:"0.85rem",color:"var(--d-text-muted)" }}>
            To: <strong style={{ color:"var(--d-text)" }}>{msgModal.name}</strong> · {msgModal.teamLeader} · {msgModal.contact}
          </div>
          <label className="dp-label">Message *</label>
          <textarea className="dp-textarea" rows={3} value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Type your message..." style={{ width:"100%",marginBottom:"1rem" }} />
          <div style={{ display:"flex",gap:"0.6rem",justifyContent:"flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={()=>setMsgModal(null)}>Cancel</button>
            <button className="dp-btn dp-btn-orange" disabled={!msgText.trim()} onClick={()=>{ toast.show(`Message sent to ${msgModal.name}`); setMsgModal(null); setMsgText(""); }}>Send Message</button>
          </div>
        </Modal>
      )}

      {toast.msg&&<Toast msg={toast.msg} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ══════════════════════════════════════════════════════════════════════════════
function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const [profile, setProfile] = useState({ ...MOCK_DISPATCHER });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ ...MOCK_DISPATCHER });
  const [logoutModal, setLogoutModal] = useState(false);
  const [pwModal, setPwModal]   = useState(false);
  const [oldPw,setOldPw]=[useState(""),useState("")]as any;
  const [newPw,setNewPw]=[useState(""),useState("")]as any;
  const [conPw,setConPw]=[useState(""),useState("")]as any;
  const toast = useToast();

  const save = () => { setProfile({...draft}); setEditing(false); toast.show("Profile updated"); };

  return (
    <div className="dp-profile dp-fade-in">
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ margin:"0 0 0.25rem",fontSize:"1.35rem",fontWeight:900,letterSpacing:"-0.04em" }}>My Profile</h2>
        <p style={{ margin:0,fontSize:"0.875rem",color:"var(--d-text-muted)" }}>View and manage your dispatcher account information</p>
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
              <div className="dp-profile-stat"><div className="dp-profile-stat-label">Total Dispatches</div><div className="dp-profile-stat-val" style={{ color:"var(--d-primary)" }}>{profile.totalDispatches.toLocaleString()}</div></div>
              <div className="dp-profile-stat"><div className="dp-profile-stat-label">Resolved Today</div><div className="dp-profile-stat-val" style={{ color:"var(--d-green)" }}>{profile.resolvedToday}</div></div>
              <div className="dp-profile-stat"><div className="dp-profile-stat-label">Member Since</div><div className="dp-profile-stat-val" style={{ fontSize:"0.9rem",fontWeight:600 }}>{profile.joinedDate}</div></div>
            </div>
            <div className="dp-profile-actions">
              {!editing
                ? <button className="dp-btn dp-btn-orange" style={{ width:"100%",justifyContent:"center" }} onClick={()=>{setEditing(true);setDraft({...profile})}}>Edit Profile</button>
                : <><button className="dp-btn dp-btn-green" style={{ width:"100%",justifyContent:"center" }} onClick={save}>Save Changes</button><button className="dp-btn dp-btn-ghost" style={{ width:"100%",justifyContent:"center",marginTop:"0.3rem" }} onClick={()=>{setEditing(false);setDraft({...profile})}}>Cancel</button></>}
              <button className="dp-btn dp-btn-ghost" style={{ width:"100%",justifyContent:"center" }} onClick={()=>setPwModal(true)}>🔒 Change Password</button>
              <div className="dp-divider" />
              <button className="dp-btn dp-btn-ghost" style={{ width:"100%",justifyContent:"center",borderColor:"var(--d-red)",color:"var(--d-red)" }} onClick={()=>setLogoutModal(true)}>→ Sign Out</button>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="dp-profile-fields">
          {editing&&<div className="dp-alert dp-alert-amber" style={{ marginBottom:"1rem" }}>✏️ You are in edit mode. Make changes and click Save.</div>}
          <div className="dp-profile-2col">
            <div>
              <div className="dp-profile-section-head">Personal Information</div>
              {(["name","username","email","phone"] as const).map(k=>(
                <div key={k} className="dp-field-display">
                  <div className="dp-field-display-label">{k==="name"?"Full Name":k.charAt(0).toUpperCase()+k.slice(1)}</div>
                  {editing ? <input className="dp-input" style={{ width:"100%",marginTop:"0.2rem" }} value={(draft as any)[k]} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} /> : <div className="dp-field-display-val">{(profile as any)[k]}</div>}
                </div>
              ))}
            </div>
            <div>
              <div className="dp-profile-section-head">Assignment (Read-only)</div>
              {[["Badge","badge"],["Rank","rank"],["Cluster","cluster"],["Station","station"]].map(([l,k])=>(
                <div key={k} className="dp-field-display">
                  <div className="dp-field-display-label">{l}</div>
                  <div className="dp-field-display-val" style={{ color:"var(--d-text-muted)" }}>{(profile as any)[k]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dp-readonly-note">📌 Badge, rank, cluster, and station are assigned by the system administrator and cannot be self-edited. Contact your admin to update these fields.</div>
        </div>
      </div>

      {/* Logout modal */}
      {logoutModal&&(
        <Modal title="Sign Out" onClose={()=>setLogoutModal(false)} width={400}>
          <div style={{ textAlign:"center",padding:"0.5rem 0 1rem" }}>
            <div style={{ fontWeight:800,fontSize:"1rem",marginBottom:"0.5rem" }}>Sign out of Damayan Dispatcher?</div>
            <div style={{ fontSize:"0.875rem",color:"var(--d-text-muted)",lineHeight:1.6 }}>You will be redirected to the login page and your session will end.</div>
          </div>
          <div style={{ display:"flex",gap:"0.6rem" }}>
            <button className="dp-btn dp-btn-ghost" style={{ flex:1,justifyContent:"center" }} onClick={()=>setLogoutModal(false)}>Stay</button>
            <button className="dp-btn dp-btn-red" style={{ flex:2,justifyContent:"center" }} onClick={onLogout}>Sign Out</button>
          </div>
        </Modal>
      )}

      {/* Password modal */}
      {pwModal&&(
        <Modal title="Change Password" onClose={()=>setPwModal(false)} width={420}>
          <div style={{ display:"flex",flexDirection:"column",gap:"1rem" }}>
            <div className="dp-field"><label>Current Password</label><input type="password" placeholder="••••••••" /></div>
            <div className="dp-field"><label>New Password</label><input type="password" placeholder="Min. 8 characters" /></div>
            <div className="dp-field"><label>Confirm New Password</label><input type="password" placeholder="Re-enter new password" /></div>
          </div>
          <div style={{ display:"flex",gap:"0.6rem",justifyContent:"flex-end",marginTop:"1.2rem" }}>
            <button className="dp-btn dp-btn-ghost" onClick={()=>setPwModal(false)}>Cancel</button>
            <button className="dp-btn dp-btn-orange" onClick={()=>{ toast.show("Password changed successfully"); setPwModal(false); }}>Update Password</button>
          </div>
        </Modal>
      )}

      {toast.msg&&<Toast msg={toast.msg} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SHELL

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SHELL
// ══════════════════════════════════════════════════════════════════════════════
function mapBackendToFrontendIncident(report: IncidentReport): Incident {
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

  return {
    id: report.id,
    type: report.title,
    category: "Other",
    reporter: "Citizen Report",
    reporterPhone: "Verified",
    address: report.location,
    barangay: "",
    city: "",
    location: report.location,
    lat: 14.6042,
    lng: 120.9822,
    timeReported: new Date(report.createdAt).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    dateReported: new Date(report.createdAt).toLocaleDateString("en-PH"),
    priority: priorityMap[report.severity?.toLowerCase() || "moderate"] || "MEDIUM",
    status: statusMap[report.status?.toLowerCase() || "pending"] || "New",
    situationType: "Under Control",
    assignedUnits: [],
    description: report.content,
    notes: "",
    timeActive: 0,
  };
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<NavPage>("dashboard");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<Unit[]>(MOCK_UNITS);
  const [dropdown, setDropdown] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<Incident | null>(null);
  const clock = useClock();
  const toast = useToast();
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = loadSession();
    if (session?.accessToken) {
      getDispatcherIncidents(session.accessToken)
        .then((data) => {
          setIncidents(data.map(mapBackendToFrontendIncident));
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
    } else {
      // No token, force logout
      onLogout();
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateIncident = async (id: string, patch: Partial<Incident>) => {
    const session = loadSession();
    if (!session?.accessToken) return;

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
      // Find the real backend ID (since we might have shortened it for display)
      // Actually, for now, we assume the shortened ID is unique enough or we keep the full ID in the state
      // In mapBackendToFrontendIncident, I used report.id.split("-")[0]. 
      // I should probably keep the full ID in a hidden property or use the full ID.
      
      // I'll update mapBackendToFrontendIncident to keep the full ID but display shortened.
      // Wait, I'll just use the full ID for now to be safe.
      
      await updateIncidentReport(session.accessToken, id, backendPatch);
      setIncidents((p) =>
        p.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    } catch (err) {
      console.error("Failed to update incident:", err);
      toast.show("Failed to sync update to server.");
    }
  };

  const handleDashboardDispatch = (inc: Incident) => {
    setDispatchTarget(inc);
    setPage("resource-map");
  };

  const handleDashboardMarkInvalid = (inc: Incident, reason: string) => {
    updateIncident(inc.id, { status: "Invalid", invalidReason: reason });
    toast.show(`${inc.id} marked as invalid`);
  };

  const newCount    = incidents.filter(i => i.status === "New" || i.status === "Waiting").length;
  const activeCount = incidents.filter(i => ["In Progress","Dispatched"].includes(i.status)).length;

  const NAV: { id: NavPage; icon: string; label: string; badge?: number }[] = [
    { id: "dashboard",         icon: "D", label: "Dashboard" },
    { id: "resource-map",      icon: "M", label: "Resource Map",       badge: newCount || undefined },
    { id: "rescue-monitoring", icon: "R", label: "Rescue Monitoring",  badge: activeCount || undefined },
    { id: "incidents",         icon: "I", label: "Incidents" },
    { id: "resources",         icon: "U", label: "Resources" },
  ];

  return (
    <div className={`dp-page dp-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      {/* ── Sidebar ── */}
      <aside className="dp-sidebar">
        {/* Collapse toggle button */}
        <button
          className="dp-sidebar-toggle"
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>

        <div className="dp-sidebar-top">
          <div className="dp-sidebar-brand">
            <div className="dp-sidebar-brand-mark">D</div>
            <div>
              <div className="dp-sidebar-brand-name">Damayan</div>
              <div className="dp-sidebar-brand-role">Dispatcher</div>
            </div>
          </div>

          <div className="dp-status-pill">
            <div className="dp-status-row">
              <span className={`dp-status-dot ${status}`} />
              <span className={status === "active" ? "dp-status-active" : "dp-status-inactive"}>
                {status === "active" ? "Active / On Duty" : "Inactive"}
              </span>
            </div>
            <div className="dp-status-cluster">{MOCK_DISPATCHER.cluster}</div>
            <button
              className={`dp-status-toggle ${status === "active" ? "set-inactive" : "set-active"}`}
              onClick={() => setStatus(s => s === "active" ? "inactive" : "active")}
            >
              {status === "active" ? "Set Inactive" : "Set Active / On Duty"}
            </button>
          </div>
        </div>

        <nav className="dp-sidebar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              data-label={item.label}
              className={`dp-nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="dp-nav-icon">{item.icon}</span>
              {item.label}
              {item.badge != null && item.badge > 0 && <span className="dp-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="dp-sidebar-footer">
          <button
            data-label="My Profile"
            className={`dp-nav-item profile-item ${page === "profile" ? "active" : ""}`}
            onClick={() => setPage("profile")}
          >
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,var(--d-primary),var(--d-primary-deep))", display: "grid", placeItems: "center", fontSize: "0.65rem", fontWeight: 900, color: "#fff", flexShrink: 0 }}>DS</div>
            My Profile
          </button>
          <button data-label="Sign Out" className="dp-nav-item" onClick={() => onLogout()}>
            <span className="dp-nav-icon" style={{ opacity: 0.5 }}>→</span>
            <span style={{ color: "var(--d-text-sub)" }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="dp-main">
        {/* Topbar */}
        <header className="dp-topbar">
          <div className="dp-topbar-left">
            <span className={`dp-phase-badge ${status === "active" ? "active" : "inactive"}`}>
              {status === "active" ? "● Active Response" : "○ Inactive"}
            </span>
            <span className="dp-topbar-title">Sampaloc Command Center — {MOCK_DISPATCHER.cluster}</span>
          </div>
          <div className="dp-topbar-right">
            <span className="dp-clock">{clock}</span>
            <button className="dp-broadcast-btn" onClick={() => setBroadcastModal(true)}>⚠ Broadcast</button>
            <div ref={dropRef} style={{ position: "relative" }}>
              <div className="dp-avatar-btn" onClick={() => setDropdown(d => !d)}>DS</div>
              {dropdown && (
                <div className="dp-avatar-dropdown">
                  <div className="dp-avatar-dropdown-header">
                    <div className="dp-avatar-dropdown-name">{MOCK_DISPATCHER.name}</div>
                    <div className="dp-avatar-dropdown-role">{MOCK_DISPATCHER.rank}</div>
                  </div>
                  <button className="dp-avatar-dropdown-item" onClick={() => { setPage("profile"); setDropdown(false); }}>👤 View Profile</button>
                  <button className="dp-avatar-dropdown-item" onClick={() => { setPage("profile"); setDropdown(false); }}>✏️ Edit Profile</button>
                  <div className="dp-avatar-dropdown-divider" />
                  <button className="dp-avatar-dropdown-item danger" onClick={() => { setDropdown(false); onLogout(); }}>→ Sign Out</button>
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
            />
          )}
          {page === "resource-map" && (
            <ResourceMapPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
              dispatchTarget={dispatchTarget}
              onClearDispatchTarget={() => setDispatchTarget(null)}
            />
          )}
          {page === "rescue-monitoring" && (
            <RescueMonitoringPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
            />
          )}
          {page === "incidents" && (
            <IncidentsPage
              incidents={incidents}
              units={units}
              onUpdate={updateIncident}
            />
          )}
          {page === "resources" && (
            <ResourcesPage units={units} setUnits={setUnits} />
          )}
{page === "profile" && (
            <ProfilePage onLogout={onLogout} />
          )}
        </div>
      </div>

      {/* Broadcast modal */}
      {broadcastModal && (
        <Modal title="⚠ System-Wide Broadcast Alert" onClose={() => { setBroadcastModal(false); setBroadcastMsg(""); }} width={500}>
          <div className="dp-alert dp-alert-red" style={{ marginBottom: "1rem" }}>
            This message will be sent to all field responders and registered citizens in Metro Cluster 3 via push notification and SMS.
          </div>
          <label className="dp-label">Alert Message *</label>
          <textarea
            className="dp-textarea"
            rows={4}
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
            placeholder="Type your emergency broadcast message..."
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button className="dp-btn dp-btn-ghost" onClick={() => { setBroadcastModal(false); setBroadcastMsg(""); }}>Cancel</button>
            <button
              className="dp-btn dp-btn-red"
              disabled={!broadcastMsg.trim()}
              onClick={() => { toast.show("Broadcast sent to all units and citizens"); setBroadcastModal(false); setBroadcastMsg(""); }}
            >
              Send Broadcast Now
            </button>
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
  return (
    stage === "login"    ? <LoginPage    onLogin={() => setStage("portal")} onRegister={() => setStage("awaiting")} /> :
    stage === "awaiting" ? <AwaitingPage onProceed={() => setStage("portal")} /> :
    <Shell onLogout={() => { window.location.href = "/login"; }} />
  );
}
