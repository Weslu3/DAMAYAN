"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hasRole, loadSession, clearSession } from "../lib/session";
import {
  getDashboard,
  getDisasterEvents,
  updateAdminDisasterEvent,
  broadcastAdminWarning,
  getCitizens,
  getFamilies,
  getPendingApprovals,
  approvePendingUser,
  rejectPendingUser,
  getSystemHealth,
  type AdminApprovalRecord,
  type AdminSystemHealthRecord,
} from "../lib/api";
import { subscribeToLiveAlerts, type LiveAlertRecord } from "../lib/supabase";
import type { AuthSession, DashboardOverview, DisasterEvent as BackendDisasterEvent } from "../lib/types";
import { AppRole } from "../lib/types";
import "./AdminPortal.css";

//  Types 
type AdminPage =
  | "overview"
  | "approvals"
  | "people_records"
  | "after_calamity"
  | "disaster_monitoring"
  | "early_warning"
  | "system_health"
  | "profile";

type AccountStatus = "PENDING" | "APPROVED" | "REJECTED";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type CalamityPhase = "BEFORE" | "DURING" | "AFTER";
type WarningStep =
  | "monitor"
  | "forecast"
  | "identify"
  | "validate"
  | "configure"
  | "broadcast"
  | "monitor_response"
  | "calamity_check"
  | "risk_check"
  | "escalate"
  | "deescalate"
  | "notify_passed";
type CalamityState = "none" | "before" | "during" | "after";
type ServiceStatus = "OPERATIONAL" | "DEGRADED" | "DOWN";

interface FamilyMember {
  name: string;
  relation: string;
  age: number;
  gender: "M" | "F";
}

interface PendingAccount {
  id: string;
  name: string;
  role: string;
  area: string;
  email: string;
  submitted: string;
  docs: { name: string; type: string; status: "VERIFIED" | "PENDING" | "FAILED" }[];
  status: AccountStatus;
  rejectReason?: string;
  qrGenerated?: boolean;
  familyQrRequested?: boolean;
  familyQrGenerated?: boolean;
  familyMembers?: FamilyMember[];
}

interface QRRecord {
  id: string;
  name: string;
  type: "individual" | "family";
  area: string;
  issuedAt: string;
  familySize?: number;
  linkedAccountId?: string;
}

interface DisasterEvent {
  id: string;
  name: string;
  type: string;
  severity: string;
  phase: CalamityPhase;
  areas: string;
  affected: number;
  tickets: number;
  dispatchers: number;
  riskLevel: RiskLevel;
  notes?: string;
}

interface WarningConfig {
  type: string;
  areas: string[];
  severity: string;
  message: string;
  useSMS: boolean;
  usePush: boolean;
}

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latency: string;
  uptime: string;
  note?: string;
}

interface AdminProfile {
  name: string;
  initials: string;
  badge: string;
  station: string;
  email: string;
  phone: string;
  role: string;
}

interface ToastItem {
  id: number;
  type: "success" | "error" | "info" | "warning";
  title: string;
  sub?: string;
}

interface Notification {
  id: number;
  title: string;
  sub: string;
  time: string;
  type: "red" | "blue" | "green" | "amber";
  read: boolean;
}

function mapSeverityToNotificationType(severity?: string): Notification["type"] {
  const normalized = String(severity ?? "").toLowerCase();
  if (normalized === "critical" || normalized === "evacuation") return "red";
  if (normalized === "warning") return "amber";
  if (normalized === "info") return "blue";
  return "green";
}

function mapLiveAlertToNotification(alert: LiveAlertRecord): Notification {
  const target = alert.target ? `  ${alert.target}` : "";
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title: alert.title,
    sub: `${alert.severity.toUpperCase()}  ${alert.message}${target}`,
    time: alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
    type: mapSeverityToNotificationType(alert.severity),
    read: false,
  };
}

//  Color maps 
const RISK_CLASS: Record<RiskLevel, string> = {
  CRITICAL: "red",
  HIGH: "orange",
  MEDIUM: "amber",
  LOW: "green",
};

const PHASE_CLASS: Record<CalamityPhase, string> = {
  BEFORE: "before",
  DURING: "during",
  AFTER: "after",
};

const PHASE_LABEL: Record<CalamityPhase, string> = {
  BEFORE: " Before",
  DURING: " During",
  AFTER: " After",
};

const RISK_COLOR: Record<RiskLevel, string> = {
  CRITICAL: "var(--admin-red)",
  HIGH: "var(--admin-orange)",
  MEDIUM: "var(--admin-amber)",
  LOW: "var(--admin-green)",
};

const TOAST_ICONS = { success: "check_circle", error: "error", info: "info", warning: "warning" };

//  Toast container 
function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="admin-toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`admin-toast ${t.type}`}>
          <span className="admin-toast-ico material-symbols-outlined">{TOAST_ICONS[t.type]}</span>
          <div>
            <div className="admin-toast-title">{t.title}</div>
            {t.sub && <div className="admin-toast-sub">{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

//  Modal 
function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  narrow,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  narrow?: boolean;
}) {
  const cls = ["admin-modal", wide ? "wide" : "", narrow ? "narrow" : ""].filter(Boolean).join(" ");
  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cls}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{title}</div>
          <button className="admin-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>close</span>
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

//  Stepper 
function Stepper({ steps, current }: { steps: { id: string; label: string }[]; current: string }) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <div className="admin-stepper">
      {steps.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.id} className="admin-step-wrap">
            <div className="admin-step">
              <div className={`admin-step-circle ${isDone ? "done" : isActive ? "active" : "pending"}`}>
                {isDone ? <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>check</span> : i + 1}
              </div>
              <div className={`admin-step-label ${isDone ? "done" : isActive ? "active" : ""}`}>
                {step.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`admin-step-connector ${isDone ? "done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// 
//  LOGIN PAGE
// 
function AdminLoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loginError, setLoginError] = useState("");
  const [idFile, setIdFile] = useState(false);
  const [waitingVerification, setWaitingVerification] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");

  const handleLogin = () => {
    if (!username || !password) { setLoginError("Enter username and password."); return; }
    setLoginError(""); onLogin();
  };

  const handleRegister = () => {
    if (!registerName || !registerEmail || !password || !idFile) return;
    setWaitingVerification(true);
  };

  const handleSendOtp = () => {
    if (!forgotEmail) return;
    setOtpSent(true);
  };

  const handleVerifyOtp = () => {
    if (!otp) return;
    setForgotMode(false);
    setOtpSent(false);
    setOtp("");
    setForgotEmail("");
  };

  const features = [
    { icon: "how_to_reg", label: "Account Approvals", desc: "Review and validate role applications" },
    { icon: "groups", label: "Family Records", desc: "View and manage registered family groups" },
    { icon: "crisis_alert", label: "Disaster Monitoring", desc: "Live feeds, forecasts, risk areas" },
    { icon: "campaign", label: "Early Warning", desc: "Configure and broadcast alerts" },
    { icon: "monitor_heart", label: "System Health", desc: "Monitor all platform services" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#0b0e1f", fontFamily: "Public Sans, sans-serif" }}>
      {/* Left brand panel */}
      <div style={{
        width: "42%",
        background: "linear-gradient(155deg, #0f1a4a 0%, #1e3a8a 50%, #1e40af 100%)",
        padding: "3rem 3rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: 100, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(0,0,0,0.1)" }} />

        <div style={{ position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3rem" }}>
            <div style={{ width: "2.5rem", height: "2.5rem", background: "rgba(255,255,255,0.14)", borderRadius: "0.7rem", display: "grid", placeItems: "center", fontWeight: 900, fontSize: "1.2rem", color: "#fff" }}>D</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.2rem", color: "#fff", letterSpacing: "-0.02em" }}>Damayan</div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>Admin Console</div>
            </div>
          </div>

          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: "0.75rem" }}>
            Command  Control  Coordinate
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 3.5vw, 4rem)", fontWeight: 900, color: "#fff", lineHeight: 0.98, letterSpacing: "-0.04em", marginBottom: "1.2rem" }}>
            The Admin<br /><span style={{ color: "rgba(147,197,253,0.9)" }}>Command Center.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.62)", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: "28rem" }}>
            System-wide oversight for the DAMAYAN disaster response platform. Manage accounts, broadcast warnings, monitor disasters, and maintain platform health.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.75rem" }}>Platform Capabilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {features.map((f) => (
              <div key={f.label} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.85rem", padding: "0.85rem 1rem", display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.78rem", color: "#fff", marginBottom: "0.15rem" }}>{f.label}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, background: "#fff", padding: "3rem 3.5rem", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ maxWidth: "28rem", width: "100%" }}>

          {/* Waiting for verification */}
          {waitingVerification ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}></div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.6rem" }}>Awaiting Verification</h2>
              <p style={{ color: "#6b7494", fontSize: "0.88rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                Your Government ID has been submitted. An existing administrator will review and approve your account. You will be notified via email.
              </p>
              <button onClick={() => { setWaitingVerification(false); setMode("login"); }} style={{ padding: "0.75rem 1.5rem", background: "#f5f6f8", border: "1.5px solid #e8eaed", borderRadius: "0.65rem", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem", fontFamily: "Public Sans, sans-serif" }}>
                 Back to Login
              </button>
            </div>
          ) : forgotMode ? (
            /* Forgot password */
            <div>
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", borderRadius: "999px", background: "rgba(37,99,235,0.08)", color: "#1e40af", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.85rem" }}>Reset Password</div>
                <h2 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.5rem" }}>Reset Your Password</h2>
                <p style={{ color: "#6b7494", fontSize: "0.85rem", lineHeight: 1.65 }}>Enter your admin email to receive a one-time reset link via Email/SMS.</p>
              </div>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Admin Email</label>
                  <input className="admin-form-input" type="email" placeholder="admin@damayan.gov.ph" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
                {!otpSent ? (
                  <button className="admin-btn admin-btn-accent" style={{ width: "100%", justifyContent: "center", padding: "0.85rem" }} onClick={handleSendOtp}>
                     Send Reset Link via Email/SMS
                  </button>
                ) : (
                  <>
                    <div className="admin-alert info">
                      <span className="admin-alert-icon material-symbols-outlined">info</span>
                      <div>A 6-digit OTP has been sent to <strong>{forgotEmail}</strong>. Enter it below to create a new password.</div>
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">OTP Code</label>
                      <input className="admin-form-input" placeholder="6-digit code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">New Password</label>
                      <input className="admin-form-input" type="password" placeholder="" />
                    </div>
                    <button className="admin-btn admin-btn-accent" style={{ width: "100%", justifyContent: "center", padding: "0.85rem" }} onClick={handleVerifyOtp}>
                      Verify OTP & Update Password 
                    </button>
                  </>
                )}
                <button onClick={() => { setForgotMode(false); setOtpSent(false); }} style={{ background: "none", border: "none", color: "#6b7494", fontSize: "0.82rem", cursor: "pointer", fontFamily: "Public Sans, sans-serif", padding: 0, fontWeight: 600, textAlign: "left" }}>
                   Back to Login
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab switch */}
              <div style={{ display: "flex", background: "#f5f6f8", borderRadius: "0.75rem", padding: "3px", marginBottom: "1.5rem" }}>
                {(["login", "register"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "0.6rem", border: "none", borderRadius: "0.55rem", background: mode === m ? "#fff" : "transparent", fontWeight: mode === m ? 800 : 500, fontSize: "0.82rem", cursor: "pointer", color: mode === m ? "#1a1c2e" : "#6b7494", boxShadow: mode === m ? "0 2px 6px rgba(0,0,0,0.07)" : "none", fontFamily: "Public Sans, sans-serif", transition: "all 0.15s" }}>
                    {m === "login" ? "Login" : "Register"}
                  </button>
                ))}
              </div>

              {mode === "login" ? (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", borderRadius: "999px", background: "rgba(37,99,235,0.08)", color: "#1e40af", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.85rem" }}>Admin Login</div>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.4rem" }}>Admin Sign In</h2>
                    <p style={{ color: "#6b7494", fontSize: "0.85rem" }}>Access the DAMAYAN administration console.</p>
                  </div>

                  {loginError && (
                    <div className="admin-alert critical" style={{ marginBottom: "1rem" }}>
                      <span className="admin-alert-icon material-symbols-outlined">error</span>
                      <div>{loginError}</div>
                    </div>
                  )}

                  <div className="admin-form-grid">
                    <div className="admin-form-group">
                      <label className="admin-form-label">Username</label>
                      <input className="admin-form-input" placeholder="admin_username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                    </div>
                    <div className="admin-form-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
                        <label className="admin-form-label" style={{ marginBottom: 0 }}>Password</label>
                        <button onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700, fontFamily: "Public Sans, sans-serif", padding: 0 }}>
                          Forgot password?
                        </button>
                      </div>
                      <input className="admin-form-input" type="password" placeholder="" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                    </div>
                    <button className="admin-btn admin-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "0.9rem", fontSize: "0.92rem", borderRadius: "0.75rem", marginTop: "0.25rem" }} onClick={handleLogin}>
                      Sign In to Admin Console 
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", borderRadius: "999px", background: "rgba(37,99,235,0.08)", color: "#1e40af", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.85rem" }}>Register</div>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.4rem" }}>Create Admin Account</h2>
                    <p style={{ color: "#6b7494", fontSize: "0.85rem", lineHeight: 1.6 }}>Register with your credentials and government ID for admin verification.</p>
                  </div>
                  <div className="admin-form-grid">
                    <div className="admin-form-group">
                      <label className="admin-form-label">Full Name</label>
                      <input className="admin-form-input" placeholder="Juan dela Cruz" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Email Address</label>
                      <input className="admin-form-input" type="email" placeholder="admin@agency.gov.ph" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Password</label>
                      <input className="admin-form-input" type="password" placeholder="" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Upload Valid Government ID *</label>
                      <div
                        className={`admin-upload-zone ${idFile ? "active" : ""}`}
                        onClick={() => setIdFile(true)}
                      >
                        {idFile ? (
                          <div style={{ color: "var(--admin-green)", fontWeight: 700, fontSize: "0.88rem" }}> Government ID Uploaded</div>
                        ) : (
                          <>
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}></div>
                            <div style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", fontWeight: 600 }}>Click to upload Government ID</div>
                            <div style={{ fontSize: "0.72rem", color: "#bbb", marginTop: "0.25rem" }}>PNG, JPG, PDF accepted</div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      className="admin-btn admin-btn-primary"
                      style={{ width: "100%", justifyContent: "center", padding: "0.9rem", fontSize: "0.92rem", borderRadius: "0.75rem", opacity: registerName && registerEmail && password && idFile ? 1 : 0.5 }}
                      onClick={handleRegister}
                      disabled={!registerName || !registerEmail || !password || !idFile}
                    >
                      Submit Registration 
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 
//  DASHBOARD / OVERVIEW
// 
function OverviewPage({
  accounts,
  qrRecords,
  disasters,
  loading,
  activityLog,
  setPage,
  overview,
}: {
  accounts: PendingAccount[];
  qrRecords: QRRecord[];
  disasters: DisasterEvent[];
  loading: boolean;
  activityLog: { time: string; type: string; msg: string; col: string }[];
  setPage: (p: AdminPage) => void;
  overview: DashboardOverview | null;
}) {
  const pending = accounts.filter((a) => a.status === "PENDING").length;
  const activeDisasters = disasters.filter((d) => d.phase !== "AFTER").length;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>System Overview</h2>
          <p>Real-time platform status, pending actions, and key metrics</p>
        </div>
        <div className="admin-head-actions">
          <span className="admin-live"><span className="admin-live-dot" />LIVE</span>
        </div>
      </div>

      <div className="admin-stats-row admin-stats-5">
        <div className="admin-stat red">
          <div className="admin-stat-label">Active Disasters</div>
          <div className="admin-stat-value">{loading ? "..." : activeDisasters}</div>
          <div className="admin-stat-note">Require monitoring</div>
        </div>
        <div className="admin-stat orange">
          <div className="admin-stat-label">Pending Approvals</div>
          <div className="admin-stat-value">{loading ? "..." : pending}</div>
          <div className="admin-stat-note">Awaiting review</div>
        </div>
        <div className="admin-stat blue">
          <div className="admin-stat-label">QR Codes Issued</div>
          <div className="admin-stat-value">{loading ? "..." : qrRecords.length}</div>
          <div className="admin-stat-note">Total issued</div>
        </div>
        <div className="admin-stat green">
          <div className="admin-stat-label">Inventory Items</div>
          <div className="admin-stat-value">{loading ? "..." : (overview?.inventory?.totalItems ?? 0)}</div>
          <div className="admin-stat-note">Across all centers</div>
        </div>
        <div className="admin-stat violet">
          <div className="admin-stat-label">Incident Reports</div>
          <div className="admin-stat-value">{loading ? "..." : (overview?.incidentReports?.totalReports ?? 0)}</div>
          <div className="admin-stat-note">All events</div>
        </div>
      </div>

      <div className="admin-grid-56">
        {/* Disaster events */}
        <div>
          <div className="admin-card" style={{ marginBottom: "1rem" }}>
            <div className="admin-card-header">
              <div className="admin-card-title"> Active Disaster Events</div>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setPage("disaster_monitoring")}>View All</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Phase</th>
                    <th>Risk</th>
                    <th>Tickets</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && disasters.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--admin-text-soft)" }}>
                        Loading active disaster events...
                      </td>
                    </tr>
                  ) : disasters.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--admin-text-soft)" }}>
                        No active disaster events found.
                      </td>
                    </tr>
                  ) : (
                    disasters.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{d.name.charAt(0).toUpperCase() + d.name.slice(1)}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)" }}>{d.areas}</div>
                        </td>
                        <td><span className={`admin-calamity-pill ${PHASE_CLASS[d.phase]}`}>{PHASE_LABEL[d.phase]}</span></td>
                        <td><span className={`admin-badge ${RISK_CLASS[d.riskLevel]}`}>{d.riskLevel}</span></td>
                        <td style={{ fontWeight: 800 }}>{d.tickets}</td>
                        <td>
                          <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setPage("disaster_monitoring")}>Monitor</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity log */}
          {activityLog.length > 0 && (
            <div className="admin-card">
              <div className="admin-card-header"><div className="admin-card-title"> Recent Admin Activity</div></div>
              <div className="admin-card-body">
                <div className="admin-tl">
                  {activityLog.slice(0, 5).map((log, i) => (
                    <div key={i} className="admin-tl-item">
                      <div className="admin-tl-left">
                        <div className="admin-tl-dot" style={{ background: log.col + "18", borderColor: log.col, color: log.col, fontSize: "0.55rem" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "0.7rem" }}>
                            {log.type === "APPROVED" ? "check_circle" : log.type === "REJECTED" ? "cancel" : log.type === "QR" ? "qr_code_2" : "campaign"}
                          </span>
                        </div>
                        {i < Math.min(activityLog.length, 5) - 1 && <div className="admin-tl-line" />}
                      </div>
                      <div className="admin-tl-body">
                        <div className="admin-tl-title">{log.msg}</div>
                        <div className="admin-tl-time">{log.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions + Pending */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="admin-card">
            <div className="admin-card-header"><div className="admin-card-title"> Quick Actions</div></div>
            <div className="admin-card-body">
              {[
                { label: "Review Account Approvals", icon: "how_to_reg", count: pending, color: "var(--admin-orange)", page: "approvals" as AdminPage },
                { label: "People & Records", icon: "people", count: null, color: "var(--admin-blue)", page: "people_records" as AdminPage },
                { label: "After Calamity", icon: "assignment_turned_in", count: null, color: "var(--admin-violet)", page: "after_calamity" as AdminPage },
                { label: "Monitor Disasters", icon: "crisis_alert", count: activeDisasters, color: "var(--admin-red)", page: "disaster_monitoring" as AdminPage },
                { label: "Configure Early Warning", icon: "broadcast_on_home", count: null, color: "var(--admin-violet)", page: "early_warning" as AdminPage },
                { label: "System Health", icon: "monitor_heart", count: null, color: "var(--admin-green)", page: "system_health" as AdminPage },
              ].map((qa) => (
                <div
                  key={qa.label}
                  onClick={() => setPage(qa.page)}
                  style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.8rem 0.9rem", background: "var(--admin-surface-low)", borderRadius: "0.65rem", marginBottom: "0.5rem", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-surface-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--admin-surface-low)")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>{qa.icon}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: "0.82rem" }}>{qa.label}</span>
                  {qa.count != null && qa.count > 0 ? (
                    <span style={{ background: qa.color, color: "#fff", fontSize: "0.62rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px" }}>{qa.count}</span>
                  ) : (
                    <span style={{ color: "var(--admin-text-soft)", fontSize: "0.82rem" }}></span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pending accounts */}
          {pending > 0 && (
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title"> Pending Approvals</div>
                <button className="admin-btn admin-btn-accent admin-btn-sm" onClick={() => setPage("approvals")}>Review All</button>
              </div>
              <div className="admin-card-body" style={{ padding: "0.75rem" }}>
                {accounts
                  .filter((a) => a.status === "PENDING")
                  .slice(0, 3)
                  .map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", borderRadius: "0.65rem", marginBottom: "0.4rem", background: "var(--admin-surface-low)" }}>
                      <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: "0.75rem", flexShrink: 0 }}>
                        {a.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{a.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)" }}>{a.role}  {a.area}</div>
                      </div>
                      <span className="admin-badge amber">{a.submitted}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 
//  APPROVALS PAGE (Swimlane: Review Docs  Is Document Valid?  Approve/Reject)
// 
function ApprovalsPage({
  accounts,
  onApprove,
  onReject,
  addLog,
  showToast,
  dataStatus,
}: {
  accounts: PendingAccount[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  addLog: (type: string, msg: string, col: string) => void;
  showToast: (type: ToastItem["type"], title: string, sub?: string) => void;
  dataStatus: "live" | "unavailable";
}) {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectTarget, setRejectTarget] = useState<PendingAccount | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [docsTarget, setDocsTarget] = useState<PendingAccount | null>(null);

  const pending = accounts.filter((a) => a.status === "PENDING");
  const approved = accounts.filter((a) => a.status === "APPROVED");
  const rejected = accounts.filter((a) => a.status === "REJECTED");

  const handleReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    onReject(rejectTarget.id, rejectReason);
    showToast("error", "Account Rejected", `${rejectTarget.name}  ${rejectReason.slice(0, 60)}`);
    setRejectTarget(null);
    setRejectReason("");
  };

  const docStatusBadge = (s: "VERIFIED" | "PENDING" | "FAILED") => {
    if (s === "VERIFIED") return <span className="admin-badge green">Verified</span>;
    if (s === "FAILED") return <span className="admin-badge red">Failed</span>;
    return <span className="admin-badge amber">Pending</span>;
  };

  const renderAccount = (a: PendingAccount, showActions: boolean) => (
    <div key={a.id} className="admin-applicant-card" style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{ width: "2.8rem", height: "2.8rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent))", display: "grid", placeItems: "center", fontSize: "1rem", fontWeight: 900, color: "#fff", flexShrink: 0 }}>
          {a.name[0]}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{a.name}</span>
            <span className="admin-mono" style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)" }}>{a.id}</span>
            {a.status === "APPROVED" && <span className="admin-badge green">Approved</span>}
            {a.status === "REJECTED" && <span className="admin-badge red">Rejected</span>}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--admin-text-soft)", marginBottom: "0.5rem" }}>
            Role: <strong style={{ color: "var(--admin-text)" }}>{a.role}</strong>  {a.area}  {a.email}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#bbb", marginBottom: "0.6rem" }}>Submitted {a.submitted}</div>
          {/* Docs */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {a.docs.map((doc) => (
              <div key={doc.name} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.65rem", background: "var(--admin-surface-low)", borderRadius: "0.5rem", fontSize: "0.72rem" }}>
                 <span style={{ fontWeight: 600 }}>{doc.name}</span> ({doc.type})
                {docStatusBadge(doc.status)}
              </div>
            ))}
          </div>
          {a.rejectReason && (
            <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", background: "var(--admin-red-bg)", border: "1px solid var(--admin-red-border)", borderRadius: "0.5rem", fontSize: "0.75rem", color: "var(--admin-red)" }}>
              <strong>Rejection reason:</strong> {a.rejectReason}
            </div>
          )}
          {a.qrGenerated && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--admin-green)", fontWeight: 700 }}>
               Account approved
            </div>
          )}
        </div>
        {/* Actions */}
        {showActions && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDocsTarget(a)}>View Docs</button>
            <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => onApprove(a.id)}>Approve</button>
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setRejectTarget(a)}> Reject</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Account Approvals</h2>
          <p>Review documents, validate identity, and approve or reject role applications</p>
        </div>
        <div className="admin-head-actions">
          {dataStatus === "unavailable" && <span className="admin-badge amber">API unavailable</span>}
          {pending.length > 0 && <span className="admin-badge red">{pending.length} Pending</span>}
        </div>
      </div>

      {dataStatus === "unavailable" && (
        <div className="admin-alert warning" style={{ marginBottom: "1rem" }}>
          <span className="admin-alert-icon material-symbols-outlined">warning</span>
          <div>Approvals endpoint is not reachable. Showing live backend state only.</div>
        </div>
      )}

      {/* Process info */}
      <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
        <span className="admin-alert-icon material-symbols-outlined">info</span>
        <div>
          <strong>Approval Workflow:</strong> Review documents for approval  Validate document authenticity  Approve or Reject account
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          Pending ({pending.length})
        </button>
        <button className={`admin-tab ${tab === "approved" ? "active" : ""}`} onClick={() => setTab("approved")}>
          Approved ({approved.length})
        </button>
        <button className={`admin-tab ${tab === "rejected" ? "active" : ""}`} onClick={() => setTab("rejected")}>
          Rejected ({rejected.length})
        </button>
      </div>

      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="admin-card" style={{ padding: "3rem", textAlign: "center", color: "var(--admin-text-soft)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}></div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>All caught up  no pending applications.</div>
          </div>
        ) : pending.map((a) => renderAccount(a, true))
      )}
      {tab === "approved" && (approved.length === 0 ? <div className="admin-card" style={{ padding: "2rem", textAlign: "center", color: "var(--admin-text-soft)" }}>No approved accounts yet.</div> : approved.map((a) => renderAccount(a, false)))}
      {tab === "rejected" && (rejected.length === 0 ? <div className="admin-card" style={{ padding: "2rem", textAlign: "center", color: "var(--admin-text-soft)" }}>No rejected accounts.</div> : rejected.map((a) => renderAccount(a, false)))}

      {/* View Docs Modal */}
      {docsTarget && (
        <Modal
          title={`Documents  ${docsTarget.name}`}
          narrow
          onClose={() => setDocsTarget(null)}
          footer={
            <>
              <button className="admin-btn admin-btn-ghost" onClick={() => setDocsTarget(null)}>Close</button>
              {docsTarget.status === "PENDING" && (
                <button className="admin-btn admin-btn-success" onClick={() => { onApprove(docsTarget.id); setDocsTarget(null); }}>
                  Approve Account
                </button>
              )}
            </>
          }
        >
          <div style={{ padding: "0.75rem", background: "var(--admin-surface-low)", borderRadius: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{docsTarget.name}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--admin-text-soft)", marginTop: "0.2rem" }}>{docsTarget.role}  {docsTarget.area}  {docsTarget.id}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {docsTarget.docs.map((doc) => (
              <div key={doc.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", background: "var(--admin-surface-low)", border: "1px solid var(--admin-outline)", borderRadius: "0.65rem" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}> {doc.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)", marginTop: "0.15rem" }}>{doc.type}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {docStatusBadge(doc.status)}
                  <button className="admin-btn admin-btn-ghost admin-btn-xs">Preview</button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <Modal
          title={`Reject Application  ${rejectTarget.name}`}
          narrow
          onClose={() => { setRejectTarget(null); setRejectReason(""); }}
          footer={
            <>
              <button className="admin-btn admin-btn-ghost" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={handleReject} disabled={!rejectReason.trim()}>
                Confirm Rejection
              </button>
            </>
          }
        >
          <div className="admin-alert warning" style={{ marginBottom: "1rem" }}>
            <span className="admin-alert-icon material-symbols-outlined">warning</span>
            <div>Rejecting <strong>{rejectTarget.name}</strong>'s application for <strong>{rejectTarget.role}</strong>. The rejection reason will be sent to the applicant.</div>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Rejection Reason (required)</label>
            <select className="admin-form-select" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
              <option value="">Select a reason</option>
              <option value="Submitted ID is expired. Please resubmit with a valid document.">Expired government ID</option>
              <option value="Submitted document appears to be tampered or forged.">Document appears tampered</option>
              <option value="Required documents are incomplete. Please submit all required documents.">Incomplete documents</option>
              <option value="Duplicate account detected. An account with this information already exists.">Duplicate account</option>
              <option value="Document failed background screening validation.">Failed background screening</option>
            </select>
          </div>
          {rejectReason && (
            <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.85rem", background: "var(--admin-red-bg)", border: "1px solid var(--admin-red-border)", borderRadius: "0.65rem", fontSize: "0.8rem", color: "var(--admin-red)" }}>
              {rejectReason}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// 
//  PEOPLE & RECORDS PAGE  Individual + Family tabs
// 
function PeopleRecordsPage({ accounts }: { accounts: PendingAccount[] }) {
  const [tab, setTab] = useState<"individual" | "family">("individual");
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<PendingAccount | null>(null);

  const allApproved = accounts.filter((a) => a.status === "APPROVED");
  const familyAccounts = accounts.filter(
    (a) => a.status === "APPROVED" && a.familyMembers && a.familyMembers.length > 0
  );

  const filteredIndividual = allApproved.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.area.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFamily = familyAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.area.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor: Record<string, string> = {
    Dispatcher: "blue",
    "Site Manager": "green",
    Citizen: "violet",
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>People &amp; Records</h2>
          <p>Individual person records and family household records for all approved accounts</p>
        </div>
        <div className="admin-head-actions">
          <span className="admin-badge blue">{allApproved.length} Individuals</span>
          <span className="admin-badge green">{familyAccounts.length} Families</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", background: "var(--admin-surface)", border: "1px solid var(--admin-outline)", borderRadius: "0.65rem", padding: "0.3rem", width: "fit-content" }}>
        {([
          { id: "individual", icon: "person", label: "Individual Records" },
          { id: "family",     icon: "family_restroom", label: "Family Records" },
        ] as { id: "individual" | "family"; icon: string; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(""); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.45rem",
              padding: "0.5rem 1.1rem",
              border: "none", borderRadius: "0.45rem", cursor: "pointer",
              fontSize: "0.82rem", fontWeight: 800,
              fontFamily: "Public Sans, sans-serif",
              background: tab === t.id ? "var(--admin-accent)" : "transparent",
              color: tab === t.id ? "#fff" : "var(--admin-text-soft)",
              transition: "all 0.15s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1.25rem", maxWidth: "380px" }}>
        <span className="material-symbols-outlined" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "1rem", color: "var(--admin-text-soft)" }}>search</span>
        <input
          className="admin-form-input"
          placeholder={tab === "individual" ? "Search by name, role, area, or ID" : "Search by name or area"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: "2.25rem" }}
        />
      </div>

      {/*  Individual Records Tab  */}
      {tab === "individual" && (
        filteredIndividual.length === 0 ? (
          <div className="admin-card" style={{ padding: "3rem", textAlign: "center", color: "var(--admin-text-soft)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.75rem" }}>person_search</span>
            <div style={{ fontWeight: 700 }}>No records found.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {filteredIndividual.map((a) => (
              <div key={a.id} className="admin-card" style={{ padding: "1.1rem 1.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {/* Avatar */}
                  <div style={{
                    width: "2.8rem", height: "2.8rem", borderRadius: "0.75rem",
                    background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent-deep))",
                    display: "grid", placeItems: "center",
                    fontSize: "1.05rem", fontWeight: 900, color: "#fff", flexShrink: 0,
                  }}>
                    {a.name[0]}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.93rem" }}>{a.name}</span>
                      <span className={`admin-badge ${roleColor[a.role] || "blue"}`}>{a.role}</span>
                      <span className="admin-mono" style={{ fontSize: "0.68rem", color: "var(--admin-text-soft)" }}>{a.id}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--admin-text-soft)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>location_on</span>
                        {a.area}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>mail</span>
                        {a.email}
                      </span>
                      {a.familyMembers && a.familyMembers.length > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--admin-accent)" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>family_restroom</span>
                          {a.familyMembers.length + 1} household members
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Docs summary */}
                  <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexShrink: 0 }}>
                    {a.docs.map((d, i) => (
                      <span
                        key={i}
                        className={`admin-badge ${d.status === "VERIFIED" ? "green" : d.status === "FAILED" ? "red" : "amber"}`}
                        style={{ fontSize: "0.62rem" }}
                        title={d.name}
                      >
                        {d.type}
                      </span>
                    ))}
                  </div>

                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => setSelectedAccount(a)}
                    style={{ flexShrink: 0 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>open_in_new</span>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/*  Family Records Tab  */}
      {tab === "family" && (
        filteredFamily.length === 0 ? (
          <div className="admin-card" style={{ padding: "3rem", textAlign: "center", color: "var(--admin-text-soft)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.75rem" }}>family_restroom</span>
            <div style={{ fontWeight: 700 }}>No family records found.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {filteredFamily.map((a) => (
              <div key={a.id} className="admin-card" style={{ padding: "1.1rem 1.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{
                    width: "2.8rem", height: "2.8rem", borderRadius: "0.75rem",
                    background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent-deep))",
                    display: "grid", placeItems: "center",
                    fontSize: "1.05rem", fontWeight: 900, color: "#fff", flexShrink: 0,
                  }}>
                    {a.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.2rem" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.93rem" }}>{a.name}</span>
                      <span className="admin-badge green">Head of Household</span>
                      <span className="admin-mono" style={{ fontSize: "0.68rem", color: "var(--admin-text-soft)" }}>{a.id}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--admin-text-soft)" }}>
                      {a.area}  {a.email} {" "}
                      <strong style={{ color: "var(--admin-text)" }}>
                        {(a.familyMembers?.length || 0) + 1} members
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end", flexShrink: 0 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--admin-text-soft)" }}>
                      {a.familyMembers?.map((m) => m.name).join(", ")}
                    </div>
                  </div>
                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => setSelectedAccount(a)}
                    style={{ flexShrink: 0 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>group</span>
                    View Family
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/*  Detail Modal  */}
      {selectedAccount && (
        <Modal
          title={tab === "family" ? `Family Record  ${selectedAccount.name}` : `Person Record  ${selectedAccount.name}`}
          onClose={() => setSelectedAccount(null)}
          footer={<button className="admin-btn admin-btn-ghost" onClick={() => setSelectedAccount(null)}>Close</button>}
        >
          {/* Person info card */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.9rem 1rem", background: "var(--admin-surface-low)", borderRadius: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{
              width: "3rem", height: "3rem", borderRadius: "0.75rem",
              background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent-deep))",
              display: "grid", placeItems: "center",
              fontSize: "1.15rem", fontWeight: 900, color: "#fff", flexShrink: 0,
            }}>
              {selectedAccount.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: "1rem", marginBottom: "0.2rem" }}>{selectedAccount.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--admin-text-soft)" }}>
                {selectedAccount.role}  {selectedAccount.area}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)", marginTop: "0.15rem" }}>
                {selectedAccount.email}  <span className="admin-mono">{selectedAccount.id}</span>
              </div>
            </div>
            <span className={`admin-badge ${roleColor[selectedAccount.role] || "blue"}`}>{selectedAccount.role}</span>
          </div>

          {/* Documents */}
          <div style={{ marginBottom: "0.65rem", fontWeight: 700, fontSize: "0.78rem", color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>folder</span>
            Submitted Documents ({selectedAccount.docs.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem" }}>
            {selectedAccount.docs.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.9rem", background: "var(--admin-surface-low)", border: "1px solid var(--admin-outline)", borderRadius: "0.55rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: d.status === "VERIFIED" ? "var(--admin-green)" : d.status === "FAILED" ? "var(--admin-red)" : "var(--admin-amber)" }}>
                  {d.status === "VERIFIED" ? "verified" : d.status === "FAILED" ? "cancel" : "pending"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{d.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)" }}>{d.type}</div>
                </div>
                <span className={`admin-badge ${d.status === "VERIFIED" ? "green" : d.status === "FAILED" ? "red" : "amber"}`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>

          {/* Family Members (if any) */}
          {selectedAccount.familyMembers && selectedAccount.familyMembers.length > 0 && (
            <>
              <div style={{ marginBottom: "0.65rem", fontWeight: 700, fontSize: "0.78rem", color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>family_restroom</span>
                Household Members ({selectedAccount.familyMembers.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedAccount.familyMembers.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.9rem", background: "var(--admin-surface-low)", border: "1px solid var(--admin-outline)", borderRadius: "0.55rem" }}>
                    <div style={{
                      width: "2rem", height: "2rem", borderRadius: "50%",
                      background: m.gender === "F" ? "var(--admin-violet)" : "var(--admin-blue)",
                      display: "grid", placeItems: "center",
                      fontSize: "0.7rem", fontWeight: 900, color: "#fff",
                    }}>
                      {m.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{m.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--admin-text-soft)" }}>
                        {m.relation}  Age {m.age}  {m.gender === "F" ? "Female" : "Male"}
                      </div>
                    </div>
                    <span className="admin-badge" style={{
                      background: m.gender === "F" ? "rgba(124,58,237,0.1)" : "rgba(37,99,235,0.1)",
                      color: m.gender === "F" ? "var(--admin-violet)" : "var(--admin-blue)",
                    }}>
                      {m.relation}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// 
//  AFTER CALAMITY (Admin Swimlane  starts at Analyze Evacuation Occupancy Data)
// 
function AfterCalamityPage({
  showToast,
  addLog,
}: {
  showToast: (type: ToastItem["type"], title: string, sub?: string) => void;
  addLog: (type: string, msg: string, col: string) => void;
}) {
  type AfterStep =
    | "analyze_occupancy"
    | "calculate_relief"
    | "approve_deployment"
    | "broadcast_safe"
    | "archive_event"
    | "review_statistics"
    | "create_report"
    | "done";

  const [step, setStep] = useState<AfterStep>("analyze_occupancy");
  const [reportGenerated, setReportGenerated] = useState(false);
  const resetCycle = () => { setStep("analyze_occupancy"); setReportGenerated(false); };

  const STEPS: AfterStep[] = [
    "analyze_occupancy",
    "calculate_relief",
    "approve_deployment",
    "broadcast_safe",
    "archive_event",
    "review_statistics",
    "create_report",
  ];

  const STEP_LABELS: Record<AfterStep, string> = {
    analyze_occupancy:  "Analyze Occupancy Data",
    calculate_relief:   "Calculate Relief Requirements",
    approve_deployment: "Approve & Route Deployment",
    broadcast_safe:     "Broadcast Safe to Return",
    archive_event:      "Archive Event",
    review_statistics:  "Review Incident Statistics",
    create_report:      "Create Report",
    done:               "Complete",
  };

  const currentIdx = STEPS.indexOf(step);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>After Calamity Workflow</h2>
          <p>
            Continues from Early Warning  post-disaster relief deployment,
            archiving, and incident reporting
          </p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={resetCycle}>
            Reset Cycle
          </button>
        </div>
      </div>

      {/* Progress tracker */}
      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Workflow Progress</div>
        </div>
        <div className="admin-card-body">
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
            {STEPS.map((s, i) => {
              const done = currentIdx > i;
              const active = step === s;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <div
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "999px",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      background: done
                        ? "var(--admin-green)"
                        : active
                        ? "var(--admin-accent)"
                        : "var(--admin-surface-low)",
                      color: done || active ? "#fff" : "var(--admin-text-soft)",
                      border:
                        done || active
                          ? "none"
                          : "1px solid var(--admin-outline)",
                      transition: "all 0.2s",
                    }}
                  >
                    {i + 1}. {STEP_LABELS[s]}
                  </div>
                  {i < STEPS.length - 1 && (
                    <span style={{ color: "var(--admin-text-soft)", fontSize: "0.65rem" }}></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">{STEP_LABELS[step]}</div>
          {step !== "done" && (
            <div className="admin-mono" style={{ fontSize: "0.72rem", color: "var(--admin-text-soft)" }}>
              Step {currentIdx + 1} of {STEPS.length}
            </div>
          )}
        </div>
        <div className="admin-card-body">

          {/*  Step 1: Analyze Evacuation Occupancy  */}
          {step === "analyze_occupancy" && (
            <div>
              <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">bar_chart</span>
                <div>
                  Review current shelter occupancy data to determine the scale
                  of relief operations required.
                </div>
              </div>
              <div
                className="admin-stats-row admin-stats-3"
                style={{ marginBottom: "1.25rem" }}
              >
                <div className="admin-stat blue">
                  <div className="admin-stat-label">Total Evacuees</div>
                  <div className="admin-stat-value">18,432</div>
                </div>
                <div className="admin-stat green">
                  <div className="admin-stat-label">Shelters Active</div>
                  <div className="admin-stat-value">14</div>
                </div>
                <div className="admin-stat orange">
                  <div className="admin-stat-label">Families Registered</div>
                  <div className="admin-stat-value">4,210</div>
                </div>
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
                  {
                    site: "Evacuation Center A",
                    evacuees: "3,240",
                    capacity: "90%",
                    status: "Near Full",
                    cls: "amber",
                  },
                  {
                    site: "Barangay Gym B4",
                    evacuees: "1,800",
                    capacity: "72%",
                    status: "Stable",
                    cls: "blue",
                  },
                  {
                    site: "Community Hall C7",
                    evacuees: "920",
                    capacity: "46%",
                    status: "Available",
                    cls: "green",
                  },
                  {
                    site: "Covered Court D2",
                    evacuees: "2,110",
                    capacity: "83%",
                    status: "Near Full",
                    cls: "amber",
                  },
                ].map((s) => (
                  <div
                    key={s.site}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "var(--admin-surface-low)",
                      borderRadius: "0.65rem",
                      border: "1px solid var(--admin-outline)",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {s.site}
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--admin-text-soft)",
                      }}
                    >
                      {s.evacuees} evacuees  {s.capacity} capacity
                    </span>
                    <span className={`admin-badge ${s.cls}`}>{s.status}</span>
                  </div>
                ))}
              </div>
              <button
                className="admin-btn admin-btn-accent"
                onClick={() => {
                  setStep("calculate_relief");
                  showToast(
                    "info",
                    "Occupancy Analyzed",
                    "Proceeding to relief calculation"
                  );
                  addLog(
                    "APPROVED",
                    "Evacuation occupancy data analyzed",
                    "var(--admin-blue)"
                  );
                }}
              >
                 Calculate Relief Requirements
              </button>
            </div>
          )}

          {/*  Step 2: Calculate Relief  */}
          {step === "calculate_relief" && (
            <div>
              <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">calculate</span>
                <div>
                  Determine the volume of relief goods needed based on evacuee
                  count and shelter data.
                </div>
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
                  {
                    item: "Food Packs",
                    required: "18,432 units",
                    available: "16,000 units",
                    status: "Shortage",
                    cls: "amber",
                  },
                  {
                    item: "Drinking Water",
                    required: "55,296 L",
                    available: "60,000 L",
                    status: "Sufficient",
                    cls: "green",
                  },
                  {
                    item: "Medical Kits",
                    required: "1,200 kits",
                    available: "980 kits",
                    status: "Shortage",
                    cls: "amber",
                  },
                  {
                    item: "Hygiene Kits",
                    required: "4,210 kits",
                    available: "5,000 kits",
                    status: "Sufficient",
                    cls: "green",
                  },
                  {
                    item: "Blankets & Mats",
                    required: "4,210 sets",
                    available: "3,800 sets",
                    status: "Shortage",
                    cls: "amber",
                  },
                ].map((r) => (
                  <div
                    key={r.item}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "var(--admin-surface-low)",
                      borderRadius: "0.65rem",
                      border: "1px solid var(--admin-outline)",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {r.item}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--admin-text-soft)",
                      }}
                    >
                      Need: {r.required}  Have: {r.available}
                    </span>
                    <span className={`admin-badge ${r.cls}`}>{r.status}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setStep("analyze_occupancy")}
                >
                   Back
                </button>
                <button
                  className="admin-btn admin-btn-accent"
                  onClick={() => {
                    setStep("approve_deployment");
                    showToast(
                      "info",
                      "Requirements Calculated",
                      "Ready for deployment approval"
                    );
                    addLog(
                      "APPROVED",
                      "Relief requirements calculated",
                      "var(--admin-blue)"
                    );
                  }}
                >
                   Approve & Route Deployment
                </button>
              </div>
            </div>
          )}

          {/*  Step 3: Approve & Route Deployment  */}
          {step === "approve_deployment" && (
            <div>
              <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">cell_tower</span>
                <div>
                  <strong>Connected to Teresa Logistics System</strong> 
                  Deployment order will be routed automatically upon approval.
                </div>
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
                  {
                    route: "Route Alpha  Evacuation Center A",
                    items: "2,432 food packs  220 medical kits",
                    eta: "45 min",
                    vehicle: "3 trucks",
                  },
                  {
                    route: "Route Bravo  Barangay Gym B4",
                    items: "1,800 food packs  180 hygiene kits",
                    eta: "30 min",
                    vehicle: "2 trucks",
                  },
                  {
                    route: "Route Charlie  Community Hall C7",
                    items: "920 food packs  90 kits",
                    eta: "60 min",
                    vehicle: "1 truck",
                  },
                  {
                    route: "Route Delta  Covered Court D2",
                    items: "2,110 food packs  200 blankets",
                    eta: "50 min",
                    vehicle: "2 trucks",
                  },
                ].map((r) => (
                  <div
                    key={r.route}
                    style={{
                      padding: "0.85rem 1rem",
                      background: "var(--admin-surface-low)",
                      borderRadius: "0.65rem",
                      border: "1px solid var(--admin-outline)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "0.88rem",
                        marginBottom: "0.3rem",
                      }}
                    >
                      {r.route}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--admin-text-soft)",
                      }}
                    >
                      {r.items}  ETA: {r.eta}  {r.vehicle}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setStep("calculate_relief")}
                >
                   Back
                </button>
                <button
                  className="admin-btn admin-btn-success"
                  style={{ flex: 1, justifyContent: "center", padding: "0.85rem" }}
                  onClick={() => {
                    setStep("broadcast_safe");
                    showToast(
                      "success",
                      "Deployment Approved",
                      "Routes dispatched via Teresa Logistics"
                    );
                    addLog(
                      "APPROVED",
                      "Relief deployment order approved and routed via Teresa Logistics",
                      "var(--admin-green)"
                    );
                  }}
                >
                  Approve & Route Deployment Order
                </button>
              </div>
            </div>
          )}

          {/*  Step 4: Broadcast Safe to Return  */}
          {step === "broadcast_safe" && (
            <div>
              <div className="admin-alert success" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">check_circle</span>
                <div>
                  Relief deployment approved. Broadcast to citizens that the
                  calamity has ended and it is safe to return home.
                </div>
              </div>
              <div
                style={{
                  background: "var(--admin-green-bg)",
                  border: "1px solid var(--admin-green)",
                  borderRadius: "0.85rem",
                  padding: "1.1rem 1.25rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    color: "var(--admin-green)",
                    marginBottom: "0.6rem",
                  }}
                >
                  All-Clear Broadcast Message Preview
                </div>
                <p
                  style={{
                    fontSize: "0.83rem",
                    color: "var(--admin-text-muted)",
                    fontStyle: "italic",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  "The calamity event has ended and it is now safe to return to
                  your homes. Evacuation corridors are open. Relief distribution
                  is ongoing at designated centers. Please proceed in an orderly
                  manner and follow guidance from local authorities."
                </p>
              </div>
              <div className="admin-stats-row admin-stats-3" style={{ marginBottom: "1.25rem" }}>
                <div className="admin-stat green">
                  <div className="admin-stat-label">Citizens to Notify</div>
                  <div className="admin-stat-value">18K+</div>
                </div>
                <div className="admin-stat blue">
                  <div className="admin-stat-label">Channels</div>
                  <div className="admin-stat-value">SMS + Push</div>
                </div>
                <div className="admin-stat violet">
                  <div className="admin-stat-label">Units Notified</div>
                  <div className="admin-stat-value">All</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("approve_deployment")}>
                   Back
                </button>
                <button
                  className="admin-btn admin-btn-success"
                  style={{ flex: 1, justifyContent: "center", padding: "0.85rem" }}
                  onClick={() => {
                    setStep("archive_event");
                    showToast("success", "Broadcast Sent", "All-clear notification delivered to 18K+ citizens");
                    addLog("BROADCAST", "All-clear broadcast sent - calamity ended, safe to return", "var(--admin-green)");
                  }}
                >
                  Send All-Clear Broadcast
                </button>
              </div>
            </div>
          )}

          {step === "archive_event" && (
            <div>
              <div className="admin-alert success" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">check_circle</span>
                <div>
                  Broadcast sent successfully. Close the active disaster event and move it to the historical archive.
                </div>
              </div>
              <div className="admin-stats-row admin-stats-3" style={{ marginBottom: "1.25rem" }}>
                <div className="admin-stat blue">
                  <div className="admin-stat-label">Total Affected</div>
                  <div className="admin-stat-value">18,432</div>
                </div>
                <div className="admin-stat green">
                  <div className="admin-stat-label">Tickets Resolved</div>
                  <div className="admin-stat-value">142</div>
                </div>
                <div className="admin-stat amber">
                  <div className="admin-stat-label">Event Duration</div>
                  <div className="admin-stat-value">72 hrs</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("broadcast_safe")}>
                   Back
                </button>
                <button
                  className="admin-btn admin-btn-accent"
                  onClick={() => {
                    setStep("review_statistics");
                    showToast("info", "Event Archived", "Disaster event moved to archive");
                    addLog("APPROVED", "Disaster event archived successfully", "var(--admin-blue)");
                  }}
                >
                  Archive Event & Proceed
                </button>
              </div>
            </div>
          )}

          {step === "review_statistics" && (
            <div>
              <div className="admin-stats-row admin-stats-4" style={{ marginBottom: "1.25rem" }}>
                <div className="admin-stat blue"><div className="admin-stat-label">Total Evacuees</div><div className="admin-stat-value">18,432</div></div>
                <div className="admin-stat green"><div className="admin-stat-label">Tickets Resolved</div><div className="admin-stat-value">142</div></div>
                <div className="admin-stat orange"><div className="admin-stat-label">Dispatchers</div><div className="admin-stat-value">4</div></div>
                <div className="admin-stat violet"><div className="admin-stat-label">Routes Deployed</div><div className="admin-stat-value">4</div></div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("archive_event")}>
                   Back
                </button>
                <button className="admin-btn admin-btn-accent" onClick={() => setStep("create_report")}>
                   Create Final Report
                </button>
              </div>
            </div>
          )}

          {step === "create_report" && (
            <div>
              {!reportGenerated ? (
                <>
                  <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
                    <span className="admin-alert-icon material-symbols-outlined">description</span>
                    <div>Generate the official post-calamity incident report for NDRRMC submission.</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={() => setStep("review_statistics")}>
                       Back
                    </button>
                    <button
                      className="admin-btn admin-btn-accent"
                      style={{ flex: 1, justifyContent: "center", padding: "0.85rem" }}
                      onClick={() => {
                        setReportGenerated(true);
                        showToast("success", "Report Generated", "Post-calamity incident report created and submitted");
                        addLog("APPROVED", "Post-calamity report generated and submitted to NDRRMC", "var(--admin-green)");
                      }}
                    >
                      Generate & Submit Report
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                    Workflow Complete
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--admin-text-soft)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                    The post-calamity incident report has been submitted to NDRRMC.
                  </p>
                  <button className="admin-btn admin-btn-ghost" onClick={resetCycle}>
                    Start New Post-Calamity Cycle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 
//  DISASTER MONITORING
// 
function DisasterMonitoringPage({
  disasters,
  loading,
  setDisasters,
  showToast,
  authToken,
}: {
  disasters: DisasterEvent[];
  loading: boolean;
  setDisasters: React.Dispatch<React.SetStateAction<DisasterEvent[]>>;
  showToast: (type: ToastItem["type"], title: string, sub?: string) => void;
  authToken?: string;
}) {
  const [selected, setSelected] = useState<DisasterEvent | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const liveFeeds = disasters.slice(0, 6).map((event) => ({
    src: (event.type?.charAt(0).toUpperCase() + event.type?.slice(1)) || "Disaster Event",
    status: event.phase === "DURING" ? "LIVE" : event.phase === "AFTER" ? "RESOLVED" : "MONITORING",
    data: `${event.name.charAt(0).toUpperCase() + event.name.slice(1)} in ${event.areas}  ${event.severity} severity  ${event.affected.toLocaleString()} affected  ${event.tickets} open ticket(s)`,
  }));
  const forecastRows = disasters.map((event) => ({
    id: event.id,
    area: event.areas,
    risk: event.riskLevel,
    phase: event.phase,
    tickets: event.tickets,
    action:
      event.riskLevel === "CRITICAL"
        ? "Immediate evacuation and full resource mobilization"
        : event.riskLevel === "HIGH"
          ? "Pre-position responders and prepare evacuation assets"
          : event.riskLevel === "MEDIUM"
            ? "Heightened monitoring and standby responders"
            : "Routine monitoring and periodic situation checks",
  }));

  const phaseToStatus = (phase: CalamityPhase) => {
    if (phase === "DURING") {
      return "active";
    }
    if (phase === "AFTER") {
      return "resolved";
    }
    return "monitoring";
  };

  const updatePhase = (id: string, phase: CalamityPhase) => {
    const previous = disasters;
    setDisasters((p) => p.map((d) => d.id === id ? { ...d, phase } : d));

    if (!authToken) {
      showToast("warning", "Session Required", "Please sign in again to sync disaster phase updates.");
      return;
    }

    void updateAdminDisasterEvent(authToken, id, { status: phaseToStatus(phase) })
      .then(() => {
        showToast("info", "Phase Updated", `Disaster event updated to ${phase}`);
      })
      .catch(() => {
        setDisasters(previous);
        showToast("error", "Update Failed", "Unable to sync disaster phase. Reverted local changes.");
      });
  };

  const saveNotes = () => {
    if (!selected) {
      return;
    }

    const previous = disasters;
    const updatedNotes = editNotes.trim();
    setDisasters((p) => p.map((d) => d.id === selected.id ? { ...d, notes: updatedNotes } : d));

    if (!authToken) {
      showToast("warning", "Session Required", "Please sign in again to sync disaster notes.");
      setSelected(null);
      return;
    }

    void updateAdminDisasterEvent(authToken, selected.id, { notes: updatedNotes })
      .then(() => {
        showToast("success", "Notes saved", selected.name);
        setSelected(null);
      })
      .catch(() => {
        setDisasters(previous);
        showToast("error", "Save Failed", "Unable to persist disaster notes. Reverted local changes.");
      });
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Disaster Monitoring</h2>
          <p>Monitor incoming disaster data, manage active events, and track response</p>
        </div>
        <div className="admin-head-actions">
          <span className="admin-live"><span className="admin-live-dot" />LIVE FEEDS</span>
        </div>
      </div>

      {loading && disasters.length === 0 && (
        <div className="admin-card" style={{ marginBottom: "1rem" }}>
          <div className="admin-card-body" style={{ color: "var(--admin-text-soft)", fontSize: "0.82rem" }}>
            Loading latest disaster data from the backend...
          </div>
        </div>
      )}

      {/* Live feeds */}
      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-card-header">
          <div className="admin-card-title"> Incoming Disaster Data Feeds</div>
          <span className="admin-live"><span className="admin-live-dot" />Real-time</span>
        </div>
        <div className="admin-card-body">
          <div className="admin-grid-2" style={{ marginBottom: "1rem" }}>
            {liveFeeds.map((f) => (
              <div key={f.src} style={{
                padding: "1rem 1.1rem",
                background: "var(--admin-surface-low)",
                border: "1px solid var(--admin-outline)",
                borderRadius: "0.85rem",
                borderLeft: "3px solid var(--admin-accent)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.82rem" }}>{f.src.charAt(0).toUpperCase() + f.src.slice(1)}</span>
                  <span className={`admin-badge ${f.status === "LIVE" ? "green" : f.status === "RESOLVED" ? "gray" : "amber"}`} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
                    {f.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--admin-text-muted)" }}>{f.data}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disaster event cards */}
      <div className="admin-stats-row admin-stats-3" style={{ marginBottom: "2rem", gap: "1rem" }}>
        {disasters.map((d) => (
          <div key={d.id} className="admin-disaster-card">
            <div className="admin-disaster-card-top" style={{ background: RISK_COLOR[d.riskLevel] }} />
            <div style={{ padding: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
                <span className={`admin-calamity-pill ${PHASE_CLASS[d.phase]}`}>{PHASE_LABEL[d.phase]}</span>
                <span className={`admin-badge ${RISK_CLASS[d.riskLevel]}`}>{d.riskLevel}</span>
              </div>
              <div style={{ fontWeight: 900, fontSize: "1rem", letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>{d.name.charAt(0).toUpperCase() + d.name.slice(1)}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)", marginBottom: "1rem", lineHeight: 1.5 }}>{d.areas}  •  {d.type.charAt(0).toUpperCase() + d.type.slice(1)}  •  {d.severity}</div>

              <div className="admin-grid-2" style={{ gap: "0.65rem", marginBottom: "1rem" }}>
                <div style={{ background: "var(--admin-surface-low)", borderRadius: "0.55rem", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>Affected</div>
                  <div style={{ fontWeight: 900, fontSize: "1.1rem", color: RISK_COLOR[d.riskLevel] }}>{d.affected.toLocaleString()}</div>
                </div>
                <div style={{ background: "var(--admin-surface-low)", borderRadius: "0.55rem", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>Tickets</div>
                  <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--admin-blue)" }}>{d.tickets}</div>
                </div>
              </div>

              <div style={{ fontSize: "0.72rem", color: "var(--admin-text-soft)", marginBottom: "0.85rem" }}>
                {d.dispatchers} dispatcher(s) active
              </div>

              {/* Phase controls */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {(["BEFORE", "DURING", "AFTER"] as CalamityPhase[]).map((ph) => (
                  <button
                    key={ph}
                    className={`admin-btn admin-btn-ghost admin-btn-xs`}
                    style={{ background: d.phase === ph ? RISK_COLOR[d.riskLevel] + "18" : undefined, fontWeight: d.phase === ph ? 800 : 600 }}
                    onClick={() => updatePhase(d.id, ph)}
                  >
                    {ph === "BEFORE" ? "" : ph === "DURING" ? "" : ""} {ph}
                  </button>
                ))}
                <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => { setSelected(d); setEditNotes(d.notes || ""); }}>Notes</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Forecast table */}
      <div className="admin-card" style={{ marginTop: "2rem" }}>
        <div className="admin-card-header">
          <div className="admin-card-title"> Forecast & Predictive Risk Analysis</div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--admin-outline)" }}>
                <th style={{ padding: "0.9rem 1.1rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem" }}>Area</th>
                <th style={{ padding: "0.9rem 1.1rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem" }}>Risk Level</th>
                <th style={{ padding: "0.9rem 1.1rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem" }}>Current Phase</th>
                <th style={{ padding: "0.9rem 1.1rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem" }}>Open Tickets</th>
                <th style={{ padding: "0.9rem 1.1rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem" }}>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.map((f, idx) => (
                <tr key={f.id} style={{ borderBottom: idx < forecastRows.length - 1 ? "1px solid var(--admin-outline)" : "none" }}>
                  <td style={{ padding: "1rem 1.1rem", fontWeight: 700, fontSize: "0.82rem" }}>{f.area}</td>
                  <td style={{ padding: "1rem 1.1rem" }}><span className={`admin-badge ${RISK_CLASS[f.risk]}`}>{f.risk}</span></td>
                  <td style={{ padding: "1rem 1.1rem", fontSize: "0.82rem" }}>{f.phase}</td>
                  <td style={{ padding: "1rem 1.1rem", fontSize: "0.82rem", fontWeight: 700 }}>{f.tickets}</td>
                  <td style={{ padding: "1rem 1.1rem", fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>{f.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes modal */}
      {selected && (
        <Modal
          title={`Notes  ${selected.name}`}
          narrow
          onClose={() => setSelected(null)}
          footer={
            <>
              <button className="admin-btn admin-btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
              <button className="admin-btn admin-btn-accent" onClick={saveNotes}>
                Save Notes
              </button>
            </>
          }
        >
          <div className="admin-form-group">
            <label className="admin-form-label">Event Notes</label>
            <textarea className="admin-form-textarea" rows={5} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Add operational notes for this disaster event" />
          </div>
        </Modal>
      )}
    </div>
  );
}

// 
//  EARLY WARNING SYSTEM  BEFORE CALAMITY (redesigned)
// 
function EarlyWarningPage({
  disasters,
  showToast,
  addLog,
  setPage,
  authToken,
}: {
  disasters: DisasterEvent[];
  showToast: (type: ToastItem["type"], title: string, sub?: string) => void;
  addLog: (type: string, msg: string, col: string) => void;
  setPage: (p: AdminPage) => void;
  authToken?: string;
}) {
  const [step, setStep] = useState<WarningStep>("monitor");
  const [warningRequired, setWarningRequired] = useState<boolean | null>(null);
  const [config, setConfig] = useState<WarningConfig>({ type: "Typhoon", areas: [], severity: "HIGH", message: "", useSMS: true, usePush: true });
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [calamityEnded, setCalamityEnded] = useState<boolean | null>(null);
  const [riskIncreased, setRiskIncreased] = useState<boolean | null>(null);

  const STEPS = [
    { id: "monitor",          label: "Monitor Data",       icon: "sensors" },
    { id: "forecast",         label: "Forecasts",          icon: "thunderstorm" },
    { id: "identify",         label: "Risk Areas",         icon: "location_on" },
    { id: "validate",         label: "Validate Alert",     icon: "fact_check" },
    { id: "configure",        label: "Configure Warning",  icon: "tune" },
    { id: "broadcast",        label: "Broadcast",          icon: "campaign" },
    { id: "monitor_response", label: "Monitor Response",   icon: "monitoring" },
  ];

  const resetCycle = () => {
    setStep("monitor");
    setWarningRequired(null);
    setBroadcastSent(false);
    setCalamityEnded(null);
    setRiskIncreased(null);
    setConfig({ type: "Typhoon", areas: [], severity: "HIGH", message: "", useSMS: true, usePush: true });
  };

  const sendBroadcast = async () => {
    if (!authToken) {
      showToast("error", "Broadcast Failed", "Session expired. Please log in again.");
      return;
    }

    if (!config.message.trim() || config.areas.length === 0) {
      showToast("error", "Broadcast Failed", "Add message and at least one target area.");
      return;
    }

    try {
      setBroadcasting(true);
      const result = await broadcastAdminWarning(authToken, {
        type: config.type,
        severity: config.severity,
        areas: config.areas,
        message: config.message,
        useSMS: config.useSMS,
        usePush: config.usePush,
      });
      setBroadcastSent(true);
      addLog(
        "BROADCAST",
        `Early warning broadcast sent: ${config.type}  ${config.severity}  ${config.areas.join(", ")}  delivered ${result.delivered}/${result.attempted}`,
        "var(--admin-red)",
      );
      showToast(
        "warning",
        "Early Warning Broadcast Sent",
        `${result.delivered}/${result.attempted} notifications delivered`,
      );
    } catch {
      showToast("error", "Broadcast Failed", "Unable to deliver warning broadcast right now.");
    } finally {
      setBroadcasting(false);
    }
  };

  const liveFeeds = disasters.slice(0, 6).map((event) => ({
    src: (event.type?.charAt(0).toUpperCase() + event.type?.slice(1)) || "Disaster Event",
    status: event.phase === "DURING" ? "LIVE" : event.phase === "AFTER" ? "RESOLVED" : "MONITORING",
    data: `${event.name.charAt(0).toUpperCase() + event.name.slice(1)} in ${event.areas}  ${event.severity} severity  ${event.affected.toLocaleString()} affected`,
  }));
  const forecastRows = disasters.map((event) => ({
    area: event.areas,
    risk: event.riskLevel,
    rainfall: event.phase === "DURING" ? "Heavy" : event.phase === "BEFORE" ? "Moderate to heavy" : "Light to moderate",
    wind: event.severity,
    action:
      event.riskLevel === "CRITICAL"
        ? "Immediate evacuation recommended"
        : event.riskLevel === "HIGH"
          ? "Pre-position resources and monitor closely"
          : event.riskLevel === "MEDIUM"
            ? "Heightened monitoring"
            : "Standard monitoring",
  }));
  const allAreas = Array.from(
    new Set(
      disasters.flatMap((event) =>
        String(event.areas ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ),
  );
  const currentIdx = STEPS.findIndex((s) => s.id === step);
  const currentStep = STEPS[Math.max(0, currentIdx)];

  return (
    <div className="admin-page">
      {/*  Page Header  */}
      <div className="admin-page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            width: "3.25rem", height: "3.25rem", borderRadius: "1rem",
            background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent-deep))",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: "1.5rem" }}>broadcast_on_home</span>
          </div>
          <div>
            <h2 style={{ marginBottom: "0.2rem" }}>Early Warning System</h2>
            <p>Before Calamity  Monitor, configure and broadcast warnings to at-risk communities</p>
          </div>
        </div>
        {broadcastSent && (
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={resetCycle}>
            <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.3rem", verticalAlign: "middle" }}>refresh</span>
            New Warning Cycle
          </button>
        )}
      </div>

      {/*  Horizontal Step Rail  */}
      <div className="admin-card" style={{ marginBottom: "1.5rem", overflow: "visible" }}>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {STEPS.map((s, i) => {
              const done = currentIdx > i;
              const active = step === s.id;
              const last = i === STEPS.length - 1;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", flex: last ? "0 0 auto" : 1 }}>
                  {/* Step node */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem", minWidth: "4.5rem" }}>
                    <div style={{
                      width: "2.5rem", height: "2.5rem", borderRadius: "50%",
                      display: "grid", placeItems: "center",
                      background: done ? "var(--admin-accent)" : active ? "var(--admin-accent)" : "var(--admin-surface-low)",
                      border: done || active ? "none" : "2px solid var(--admin-outline)",
                      transition: "all 0.2s",
                      boxShadow: active ? "0 0 0 4px var(--admin-accent-light)" : "none",
                    }}>
                      {done ? (
                        <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: "1rem" }}>check</span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ color: active ? "#fff" : "var(--admin-text-soft)", fontSize: "1rem" }}>{s.icon}</span>
                      )}
                    </div>
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 800, textAlign: "center",
                      color: active ? "var(--admin-accent)" : done ? "var(--admin-text)" : "var(--admin-text-soft)",
                      lineHeight: 1.3, maxWidth: "4.5rem",
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {!last && (
                    <div style={{
                      flex: 1, height: "2px", margin: "0 0.25rem",
                      marginBottom: "1.4rem",
                      background: done ? "var(--admin-accent)" : "var(--admin-outline)",
                      transition: "background 0.3s",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/*  Step Content  */}
      <div className="admin-card">
        {/* Step header strip */}
        <div style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--admin-outline)",
          background: "var(--admin-surface-low)",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <div style={{
            width: "2rem", height: "2rem", borderRadius: "0.5rem",
            background: "var(--admin-accent)", display: "grid", placeItems: "center",
          }}>
            <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: "1rem" }}>
              {currentStep?.icon || "info"}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>
              Step {Math.max(1, currentIdx + 1)} of {STEPS.length}  {currentStep?.label}
            </div>
          </div>
        </div>

        <div className="admin-card-body">

          {/*  Step 1: Monitor  */}
          {step === "monitor" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Monitor Incoming Disaster Data</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Review real-time feeds from PAGASA, NDRRMC, rainfall sensors, and river level monitors.</p>
              <div className="admin-grid-2" style={{ marginBottom: "1.25rem" }}>
                {liveFeeds.map((f) => (
                  <div key={f.src} style={{
                    padding: "1rem 1.1rem",
                    background: "var(--admin-surface-low)",
                    border: "1px solid var(--admin-outline)",
                    borderRadius: "0.85rem",
                    borderLeft: "3px solid var(--admin-accent)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.82rem" }}>{f.src.charAt(0).toUpperCase() + f.src.slice(1)}</span>
                      <span className={`admin-badge ${f.status === "LIVE" ? "green" : f.status === "RESOLVED" ? "gray" : "amber"}`} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
                        {f.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--admin-text-muted)" }}>{f.data}</div>
                  </div>
                ))}
              </div>
              <button className="admin-btn admin-btn-accent" onClick={() => setStep("forecast")}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.35rem" }}>arrow_forward</span>
                Proceed to Forecast Analysis
              </button>
            </div>
          )}

          {/*  Step 2: Forecast  */}
          {step === "forecast" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Review Forecasts &amp; Predictive Analysis</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Analyze forecast models and predicted impact zones.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.25rem" }}>
                {forecastRows.map((f) => (
                  <div key={f.area} style={{
                    padding: "1rem 1.1rem",
                    background: RISK_COLOR[f.risk] + "0d",
                    border: `1px solid ${RISK_COLOR[f.risk]}30`,
                    borderLeft: `3px solid ${RISK_COLOR[f.risk]}`,
                    borderRadius: "0.85rem",
                    display: "flex", alignItems: "center", gap: "1rem",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.3rem", color: RISK_COLOR[f.risk], flexShrink: 0 }}>
                      {f.risk === "CRITICAL" ? "emergency" : f.risk === "HIGH" ? "warning" : "info"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.88rem" }}>{f.area}</span>
                        <span className={`admin-badge ${RISK_CLASS[f.risk]}`}>{f.risk}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)" }}>
                        Rainfall: {f.rainfall}  Wind: {f.wind}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: "0.15rem", fontStyle: "italic" }}>{f.action}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("monitor")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.25rem" }}>arrow_back</span>Back
                </button>
                <button className="admin-btn admin-btn-accent" onClick={() => setStep("identify")}>
                  Identify High Risk Areas<span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginLeft: "0.35rem" }}>arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/*  Step 3: Identify  */}
          {step === "identify" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Identify High Risk Areas</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Areas classified as HIGH or CRITICAL based on forecast analysis.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginBottom: "1.25rem" }}>
                {forecastRows.filter((f) => f.risk === "CRITICAL" || f.risk === "HIGH").map((f) => (
                  <div key={f.area} style={{
                    display: "flex", alignItems: "center", gap: "0.85rem",
                    padding: "1rem 1.1rem",
                    background: RISK_COLOR[f.risk] + "0d",
                    border: `1px solid ${RISK_COLOR[f.risk]}30`,
                    borderRadius: "0.85rem",
                  }}>
                    <div style={{
                      width: "2.5rem", height: "2.5rem", borderRadius: "0.6rem",
                      background: RISK_COLOR[f.risk] + "20",
                      display: "grid", placeItems: "center", flexShrink: 0,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", color: RISK_COLOR[f.risk] }}>
                        {f.risk === "CRITICAL" ? "emergency" : "warning"}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "0.2rem" }}>{f.area}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)" }}>{f.action}</div>
                    </div>
                    <span className={`admin-badge ${RISK_CLASS[f.risk]}`}>{f.risk}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("forecast")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.25rem" }}>arrow_back</span>Back
                </button>
                <button className="admin-btn admin-btn-accent" onClick={() => setStep("validate")}>
                  Validate Alert Necessity<span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginLeft: "0.35rem" }}>arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/*  Step 4: Validate  */}
          {step === "validate" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Validate Alert Necessity</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Based on all data  is a warning broadcast required at this time?</p>
              <div style={{
                background: "var(--admin-surface-low)", border: "1px solid var(--admin-outline)",
                borderRadius: "0.85rem", padding: "1.1rem 1.2rem", marginBottom: "1.25rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--admin-accent)", fontSize: "1.1rem" }}>summarize</span>
                  <span style={{ fontWeight: 900, fontSize: "0.9rem" }}>Assessment Summary</span>
                </div>
                {[
                  "2 CRITICAL risk areas identified: Metro Manila, Laguna Basin",
                  "Typhoon Kristine landfall expected within 5 hours",
                  "Marikina River at Alert Level 2  18.6m (threshold: 20m)",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem", color: "var(--admin-text-muted)", marginBottom: "0.35rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", color: "var(--admin-amber)", marginTop: "0.05rem", flexShrink: 0 }}>chevron_right</span>
                    {item}
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", color: "var(--admin-red)", flexShrink: 0 }}>emergency</span>
                  Early warning threshold: <strong style={{ color: "var(--admin-red)", marginLeft: "0.25rem" }}>EXCEEDED</strong>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.85rem" }}>Is a warning broadcast required?</div>
              <div className="admin-grid-2" style={{ gap: "0.65rem", marginBottom: "1rem" }}>
                <button
                  onClick={() => { setWarningRequired(true); setStep("configure"); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem",
                    padding: "1.25rem", border: "1.5px solid var(--admin-red-border)",
                    borderRadius: "0.85rem", cursor: "pointer", background: "var(--admin-red-bg)",
                    color: "var(--admin-red)", fontFamily: "Public Sans, sans-serif",
                    fontWeight: 800, fontSize: "0.88rem", transition: "all 0.15s",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>emergency</span>
                  Yes  Configure &amp; Broadcast Warning
                </button>
                <button
                  onClick={() => { setWarningRequired(false); showToast("info", "Monitoring Continues", "No warning broadcast at this time"); setStep("monitor"); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem",
                    padding: "1.25rem", border: "1.5px solid var(--admin-green-border)",
                    borderRadius: "0.85rem", cursor: "pointer", background: "var(--admin-green-bg)",
                    color: "var(--admin-green)", fontFamily: "Public Sans, sans-serif",
                    fontWeight: 800, fontSize: "0.88rem", transition: "all 0.15s",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>check_circle</span>
                  No  Continue Monitoring Only
                </button>
              </div>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setStep("identify")}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>arrow_back</span>Back
              </button>
            </div>
          )}

          {/*  Step 5: Configure  */}
          {step === "configure" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Configure Warning Parameters</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Set all parameters before sending the early warning broadcast.</p>
              <div className="admin-form-grid">
                <div className="admin-form-grid admin-form-grid-2">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle", marginRight: "0.25rem" }}>storm</span>
                      Warning Type
                    </label>
                    <select className="admin-form-select" value={config.type} onChange={(e) => setConfig((p) => ({ ...p, type: e.target.value }))}>
                      <option>Typhoon</option>
                      <option>Flood</option>
                      <option>Landslide</option>
                      <option>Earthquake</option>
                      <option>Tsunami</option>
                      <option>Storm Surge</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle", marginRight: "0.25rem" }}>signal_cellular_alt</span>
                      Severity Level
                    </label>
                    <select className="admin-form-select" value={config.severity} onChange={(e) => setConfig((p) => ({ ...p, severity: e.target.value }))}>
                      <option>LOW</option>
                      <option>MEDIUM</option>
                      <option>HIGH</option>
                      <option>CRITICAL</option>
                    </select>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle", marginRight: "0.25rem" }}>location_on</span>
                    Target Areas
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {allAreas.map((area) => {
                      const sel = config.areas.includes(area);
                      return (
                        <button
                          key={area}
                          onClick={() => setConfig((p) => ({ ...p, areas: sel ? p.areas.filter((a) => a !== area) : [...p.areas, area] }))}
                          style={{
                            padding: "0.4rem 0.85rem",
                            border: `1.5px solid ${sel ? "var(--admin-accent)" : "var(--admin-outline)"}`,
                            borderRadius: "999px",
                            background: sel ? "var(--admin-accent-light)" : "var(--admin-surface)",
                            color: sel ? "var(--admin-accent)" : "var(--admin-text-soft)",
                            fontSize: "0.75rem", fontWeight: sel ? 800 : 600,
                            cursor: "pointer", fontFamily: "Public Sans, sans-serif",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: "0.3rem",
                          }}
                        >
                          {sel && <span className="material-symbols-outlined" style={{ fontSize: "0.8rem" }}>check</span>}
                          {area}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle", marginRight: "0.25rem" }}>edit_note</span>
                    Warning Message
                  </label>
                  <textarea
                    className="admin-form-textarea"
                    rows={4}
                    placeholder="EARLY WARNING: Typhoon Kristine is expected to make landfall within 5 hours. Residents in low-lying areas are advised to evacuate immediately to the nearest designated evacuation center"
                    value={config.message}
                    onChange={(e) => setConfig((p) => ({ ...p, message: e.target.value }))}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle", marginRight: "0.25rem" }}>send</span>
                    Broadcast Channels
                  </label>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    {[
                      { id: "useSMS", icon: "sms", label: "SMS Broadcast" },
                      { id: "usePush", icon: "notifications", label: "Push Notification" },
                    ].map((c) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", cursor: "pointer", fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={config[c.id as "useSMS" | "usePush"]}
                          onChange={(e) => setConfig((p) => ({ ...p, [c.id]: e.target.checked }))}
                          style={{ accentColor: "var(--admin-accent)", width: "1rem", height: "1rem" }}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", color: "var(--admin-accent)" }}>{c.icon}</span>
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button className="admin-btn admin-btn-ghost" onClick={() => setStep("validate")}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.25rem" }}>arrow_back</span>Back
                  </button>
                  <button
                    className="admin-btn admin-btn-broadcast"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={!config.message || config.areas.length === 0}
                    onClick={() => setStep("broadcast")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem", marginRight: "0.35rem" }}>preview</span>
                    Review &amp; Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}

          {/*  Step 6: Broadcast  */}
          {step === "broadcast" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Broadcast Early Warning</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Review the warning summary and confirm broadcast to all target recipients.</p>

              {!broadcastSent ? (
                <>
                  <div style={{
                    background: "var(--admin-red-bg)", border: "1px solid var(--admin-red-border)",
                    borderRadius: "0.85rem", padding: "1.25rem", marginBottom: "1.25rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--admin-red)", fontSize: "1.25rem" }}>emergency</span>
                      <span style={{ fontWeight: 900, fontSize: "0.95rem", color: "var(--admin-red)" }}>Warning Broadcast Summary</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem", fontSize: "0.82rem", marginBottom: "0.85rem" }}>
                      {[
                        { label: "Type", val: config.type },
                        { label: "Severity", val: config.severity },
                        { label: "Target Areas", val: config.areas.join(", ") || "None selected" },
                        { label: "Channels", val: [config.useSMS ? "SMS" : "", config.usePush ? "Push" : ""].filter(Boolean).join(", ") },
                      ].map((item) => (
                        <div key={item.label}>
                          <span style={{ color: "var(--admin-text-soft)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
                          <div style={{ fontWeight: 800, marginTop: "0.1rem" }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      padding: "0.85rem 1rem",
                      background: "rgba(255,255,255,0.65)",
                      borderRadius: "0.6rem",
                      fontSize: "0.8rem", fontStyle: "italic",
                      lineHeight: 1.7, color: "var(--admin-text-muted)",
                    }}>
                      "{config.message}"
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={() => setStep("configure")}>
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>arrow_back</span>Back to Configure
                    </button>
                    <button
                      className="admin-btn admin-btn-broadcast"
                      style={{ flex: 1, justifyContent: "center", padding: "0.85rem" }}
                      disabled={broadcasting}
                      onClick={sendBroadcast}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", marginRight: "0.4rem" }}>cell_tower</span>
                      {broadcasting ? "Sending Broadcast..." : "Send Early Warning Broadcast Now"}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "1.5rem 1rem" }}>
                  <div style={{
                    width: "4.5rem", height: "4.5rem", borderRadius: "50%",
                    background: "var(--admin-green-bg)", border: "2px solid var(--admin-green)",
                    display: "grid", placeItems: "center", margin: "0 auto 1rem",
                  }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--admin-green)", fontSize: "2rem" }}>cell_tower</span>
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: "1.2rem", marginBottom: "0.5rem" }}>Early Warning Broadcast Sent!</h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>
                    All registered citizens and response units in target areas have been notified.
                  </p>
                  <button className="admin-btn admin-btn-accent" onClick={() => setStep("monitor_response")}>
                    Monitor System Response<span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginLeft: "0.35rem" }}>arrow_forward</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/*  Step 7: Monitor Response  */}
          {step === "monitor_response" && (
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.3rem" }}>Monitor System Response</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--admin-text-soft)", marginBottom: "1.25rem" }}>Track broadcast delivery, notify response units, then assess calamity state.</p>

              <div className="admin-stats-row admin-stats-3" style={{ marginBottom: "1.25rem" }}>
                {[
                  { label: "Notifications Sent", val: "18,432", icon: "smartphone", col: "blue" as const },
                  { label: "Delivery Rate",      val: "98.7%",  icon: "check_circle", col: "green" as const },
                  { label: "Units Notified",     val: "14",     icon: "emergency_home", col: "orange" as const },
                ].map((m) => (
                  <div key={m.label} className={`admin-stat ${m.col}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.3rem", marginBottom: "0.35rem", display: "block" }}>{m.icon}</span>
                    <div className="admin-stat-label">{m.label}</div>
                    <div className="admin-stat-value">{m.val}</div>
                  </div>
                ))}
              </div>

              <div className="admin-alert success" style={{ marginBottom: "1.5rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">check_circle</span>
                <div>All dispatchers, site managers, and field response units have been alerted. Teams are mobilizing.</div>
              </div>

              <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.85rem" }}>Calamity Status Assessment</div>

              <div className="admin-grid-2" style={{ gap: "0.85rem" }}>
                <div style={{
                  padding: "1.25rem", background: "var(--admin-surface-low)",
                  border: "1px solid var(--admin-outline)", borderRadius: "0.85rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--admin-green)", fontSize: "1.1rem" }}>check_circle</span>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem" }}>Has the calamity ended?</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="admin-btn admin-btn-success"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => { setCalamityEnded(true); setStep("notify_passed"); showToast("success", "All-Clear Initiated", "Calamity end notification in progress"); addLog("BROADCAST", "Calamity ended  All-clear notification sent", "var(--admin-green)"); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.3rem" }}>check</span>
                      Yes  All-Clear
                    </button>
                    <button
                      className="admin-btn admin-btn-ghost"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => setStep("risk_check")}
                    >
                      No  Assess Risk
                    </button>
                  </div>
                </div>
                <div style={{
                  padding: "1.25rem", background: "var(--admin-surface-low)",
                  border: "1px solid var(--admin-outline)", borderRadius: "0.85rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--admin-red)", fontSize: "1.1rem" }}>trending_up</span>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem" }}>Has risk level increased?</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="admin-btn admin-btn-danger"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => { setRiskIncreased(true); setStep("escalate"); showToast("error", "Warnings Escalated", "Risk level has increased"); addLog("BROADCAST", "Warnings escalated  risk level increased", "var(--admin-red)"); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.3rem" }}>trending_up</span>
                      Escalate
                    </button>
                    <button
                      className="admin-btn admin-btn-ghost"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => { setRiskIncreased(false); setStep("deescalate"); showToast("info", "Warnings De-escalated", "Situation stabilizing"); addLog("BROADCAST", "Warnings de-escalated / maintained", "var(--admin-blue)"); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.3rem" }}>trending_down</span>
                      De-Escalate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/*  Escalate  */}
          {step === "escalate" && (
            <div>
              <div className="admin-alert critical" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">emergency</span>
                <div><strong>Warnings Escalated</strong>  Risk level has increased. Enhanced response protocols are now active. All units and dispatchers have been re-notified.</div>
              </div>
              <div className="admin-stats-row admin-stats-2" style={{ marginBottom: "1.25rem" }}>
                <div className="admin-stat red">
                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", display: "block", marginBottom: "0.35rem" }}>emergency</span>
                  <div className="admin-stat-label">Warning Level</div>
                  <div className="admin-stat-value">CRITICAL</div>
                </div>
                <div className="admin-stat orange">
                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", display: "block", marginBottom: "0.35rem" }}>emergency_home</span>
                  <div className="admin-stat-label">Units on Alert</div>
                  <div className="admin-stat-value">22</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("monitor_response")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>arrow_back</span>Back
                </button>
                <button className="admin-btn admin-btn-accent" onClick={() => setStep("notify_passed")}>Mark Calamity Ended</button>
                <button className="admin-btn admin-btn-ghost" onClick={resetCycle}>New Cycle</button>
              </div>
            </div>
          )}

          {/*  De-escalate  */}
          {step === "deescalate" && (
            <div>
              <div className="admin-alert info" style={{ marginBottom: "1.25rem" }}>
                <span className="admin-alert-icon material-symbols-outlined">trending_down</span>
                <div><strong>Warnings De-escalated / Maintained</strong>  Situation is stabilizing. Monitoring continues. Response units remain on standby.</div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setStep("monitor_response")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.25rem" }}>arrow_back</span>Back
                </button>
                <button className="admin-btn admin-btn-success" onClick={() => setStep("notify_passed")}>Calamity Has Ended</button>
                <button className="admin-btn admin-btn-ghost" onClick={resetCycle}>New Cycle</button>
              </div>
            </div>
          )}

          {/*  Notify Passed  */}
          {step === "notify_passed" && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{
                width: "5rem", height: "5rem", borderRadius: "50%",
                background: "var(--admin-green-bg)",
                border: "3px solid var(--admin-green)",
                display: "grid", placeItems: "center",
                margin: "0 auto 1.25rem",
                boxShadow: "0 0 0 8px var(--admin-accent-light)",
              }}>
                <span className="material-symbols-outlined" style={{ color: "var(--admin-green)", fontSize: "2.25rem" }}>check_circle</span>
              </div>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.5rem" }}>Calamity Has Passed</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--admin-text-soft)", lineHeight: 1.7, marginBottom: "1.5rem", maxWidth: "28rem", margin: "0 auto 1.5rem" }}>
                An all-clear notification has been sent to all registered citizens and response units. The calamity event has been marked as resolved.
              </p>
              <div className="admin-stats-row admin-stats-3" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
                <div className="admin-stat green">
                  <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", display: "block", marginBottom: "0.3rem" }}>check_circle</span>
                  <div className="admin-stat-label">All-Clear Sent</div>
                  <div className="admin-stat-value" style={{ fontSize: "1.3rem" }}>Yes</div>
                </div>
                <div className="admin-stat blue">
                  <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", display: "block", marginBottom: "0.3rem" }}>people</span>
                  <div className="admin-stat-label">Citizens Notified</div>
                  <div className="admin-stat-value" style={{ fontSize: "1.3rem" }}>18K+</div>
                </div>
                <div className="admin-stat green">
                  <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", display: "block", marginBottom: "0.3rem" }}>task_alt</span>
                  <div className="admin-stat-label">Status</div>
                  <div className="admin-stat-value" style={{ fontSize: "1.1rem" }}>Resolved</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button className="admin-btn admin-btn-ghost" onClick={resetCycle}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.3rem" }}>refresh</span>
                  New Warning Cycle
                </button>
                <button className="admin-btn admin-btn-accent" onClick={() => setPage("after_calamity")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", marginRight: "0.3rem" }}>arrow_forward</span>
                  Proceed to After Calamity Workflow
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// 
//  SYSTEM HEALTH
// 
function SystemHealthPage({
  showToast,
  services,
  refreshing,
  onRefresh,
}: {
  showToast: (type: ToastItem["type"], title: string, sub?: string) => void;
  services: ServiceHealth[];
  refreshing: boolean;
  onRefresh: () => Promise<boolean>;
}) {
  const degraded = services.filter((s) => s.status !== "OPERATIONAL");

  const handleRecheck = () => {
    void onRefresh().then((ok) => {
      if (!ok) {
        showToast("error", "Health Recheck Failed", "Could not reach backend health endpoint");
        return;
      }
      showToast("success", "Health Rechecked", "Service statuses were refreshed from backend");
    });
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>System Health Monitor</h2>
          <p>Live status of all DAMAYAN platform services and components</p>
        </div>
        <div className="admin-head-actions">
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleRecheck} disabled={refreshing}>
            {refreshing ? "Checking..." : "Recheck Health"}
          </button>
          {degraded.length === 0
            ? <span className="admin-badge green"> All Systems Operational</span>
            : <span className="admin-badge amber"> {degraded.length} Service(s) Degraded</span>
          }
        </div>
      </div>

      {degraded.length > 0 && (
        <div className="admin-alert warning" style={{ marginBottom: "1.25rem" }}>
          <span className="admin-alert-icon material-symbols-outlined">warning</span>
          <div>
            <strong>{degraded.length} service(s) are not fully operational:</strong>{" "}
            {degraded.map((s) => s.name).join(", ")}.
            Engineering team has been notified.
            <button className="admin-btn admin-btn-danger admin-btn-xs" style={{ marginLeft: "0.75rem" }} onClick={() => showToast("warning", "Issue Escalated", "Engineering team notified via PagerDuty")}>
              Escalate Issue
            </button>
          </div>
        </div>
      )}

      {services.length === 0 && (
        <div className="admin-alert warning" style={{ marginBottom: "1.25rem" }}>
          <span className="admin-alert-icon material-symbols-outlined">warning</span>
          <div>System health endpoint is unavailable. Showing live backend state only.</div>
        </div>
      )}

      <div className="admin-stats-row admin-stats-4">
        <div className="admin-stat green"><div className="admin-stat-label">Operational</div><div className="admin-stat-value">{services.filter((s) => s.status === "OPERATIONAL").length}</div></div>
        <div className="admin-stat amber"><div className="admin-stat-label">Degraded</div><div className="admin-stat-value">{services.filter((s) => s.status === "DEGRADED").length}</div></div>
        <div className="admin-stat red"><div className="admin-stat-label">Down</div><div className="admin-stat-value">{services.filter((s) => s.status === "DOWN").length}</div></div>
        <div className="admin-stat blue"><div className="admin-stat-label">Total Services</div><div className="admin-stat-value">{services.length}</div></div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">Service Status</div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Uptime (30d)</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div className={`admin-health-dot ${svc.status === "OPERATIONAL" ? "ok" : svc.status === "DEGRADED" ? "degraded" : "down"}`} />
                      <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{svc.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${svc.status === "OPERATIONAL" ? "green" : svc.status === "DEGRADED" ? "amber" : "red"}`}>
                      {svc.status === "OPERATIONAL" ? " Operational" : svc.status === "DEGRADED" ? " Degraded" : " Down"}
                    </span>
                  </td>
                  <td><span className="admin-mono">{svc.latency}</span></td>
                  <td><span style={{ fontWeight: 700, color: parseFloat(svc.uptime) > 99.5 ? "var(--admin-green)" : "var(--admin-amber)" }}>{svc.uptime}</span></td>
                  <td style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)", maxWidth: "14rem" }}>{svc.note || ""}</td>
                  <td>
                    {svc.status !== "OPERATIONAL" && (
                      <button className="admin-btn admin-btn-success admin-btn-xs" onClick={handleRecheck} disabled={refreshing}>
                        {refreshing ? "Checking..." : "Recheck"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 
//  PROFILE PAGE
// 
function ProfilePage({ profile, onSave, showToast }: { profile: AdminProfile; onSave: (p: AdminProfile) => void; showToast: (type: ToastItem["type"], title: string, sub?: string) => void }) {
  const [form, setForm] = useState(profile);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const handleSave = () => { onSave(form); showToast("success", "Profile Updated", "Changes saved successfully"); };
  const handleOtp = () => { setOtpSent(true); showToast("info", "OTP Sent", `Code sent to ${form.email}`); };
  const handlePwdChange = () => {
    if (!otp || pwd.next !== pwd.confirm) { showToast("error", "Password Error", "OTP or password mismatch"); return; }
    showToast("success", "Password Changed", "Your password has been updated");
    setOtpSent(false); setOtp(""); setPwd({ current: "", next: "", confirm: "" });
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div><h2>My Profile</h2><p>View and manage your administrator account information</p></div>
      </div>
      <div className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-header"><div className="admin-card-title"> Account Information</div></div>
          <div className="admin-card-body">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "var(--admin-surface-low)", borderRadius: "0.85rem", marginBottom: "1.25rem", border: "1px solid var(--admin-outline)" }}>
              <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "0.85rem", background: "linear-gradient(135deg, var(--admin-accent-mid), var(--admin-accent))", display: "grid", placeItems: "center", fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}>{profile.initials}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.05rem", letterSpacing: "-0.03em" }}>{form.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-soft)", marginTop: "0.15rem" }}>{form.badge}  {form.role}</div>
                <span className="admin-badge blue" style={{ marginTop: "0.4rem" }}>System Administrator</span>
              </div>
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group"><label className="admin-form-label">Full Name</label><input className="admin-form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div className="admin-form-group"><label className="admin-form-label">Badge Number</label><input className="admin-form-input" value={form.badge} disabled style={{ background: "var(--admin-surface-low)", color: "var(--admin-text-soft)" }} /></div>
              <div className="admin-form-group"><label className="admin-form-label">Email</label><input className="admin-form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div className="admin-form-group"><label className="admin-form-label">Phone</label><input className="admin-form-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div className="admin-form-group"><label className="admin-form-label">Station / Office</label><input className="admin-form-input" value={form.station} onChange={(e) => setForm((p) => ({ ...p, station: e.target.value }))} /></div>
              <button className="admin-btn admin-btn-accent" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header"><div className="admin-card-title"> Change Password</div></div>
          <div className="admin-card-body">
            <div className="admin-alert info" style={{ marginBottom: "1rem" }}>
              <span className="admin-alert-icon material-symbols-outlined">info</span>
              <div>Password changes require OTP verification sent to your registered email address.</div>
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group"><label className="admin-form-label">Current Password</label><input className="admin-form-input" type="password" placeholder="" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} /></div>
              {!otpSent ? (
                <button className="admin-btn admin-btn-ghost" onClick={handleOtp}> Send OTP to {form.email}</button>
              ) : (
                <>
                  <div className="admin-form-group"><label className="admin-form-label">OTP Code</label><input className="admin-form-input" placeholder="6-digit code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} /></div>
                  <div className="admin-form-group"><label className="admin-form-label">New Password</label><input className="admin-form-input" type="password" placeholder="" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} /></div>
                  <div className="admin-form-group"><label className="admin-form-label">Confirm New Password</label><input className="admin-form-input" type="password" placeholder="" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} /></div>
                  <button className="admin-btn admin-btn-accent" onClick={handlePwdChange}>Update Password</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

//  Backend data mapper 
function mapBackendDisaster(d: BackendDisasterEvent & { ticketCount?: number }): DisasterEvent {
  const statusToPhase = (s: string): CalamityPhase => {
    if (s === "active") return "DURING";
    if (s === "resolved" || s === "ended") return "AFTER";
    return "BEFORE";
  };
  const levelToRisk = (s: string): RiskLevel => {
    const sl = s.toLowerCase();
    if (sl === "critical" || sl === "catastrophic") return "CRITICAL";
    if (sl === "high" || sl === "severe") return "HIGH";
    if (sl === "medium" || sl === "moderate") return "MEDIUM";
    return "LOW";
  };
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    severity: d.severityLevel,
    phase: statusToPhase(d.status),
    areas: d.affectedAreas.length > 0 ? d.affectedAreas.join(", ") : d.province,
    affected: 0,
    tickets: d.ticketCount ?? 0,
    dispatchers: 0,
    riskLevel: levelToRisk(d.severityLevel),
    notes: d.notes,
  };
}

function mapApprovalToAccount(record: AdminApprovalRecord): PendingAccount {
  const firstName = record.firstName ?? record.first_name ?? "";
  const lastName = record.lastName ?? record.last_name ?? "";
  const name = `${firstName} ${lastName}`.trim() || record.email || "Unknown User";
  const submittedAt = record.createdAt ?? record.created_at;
  const status = String(record.status ?? "pending").toLowerCase();
  const normalizedStatus: AccountStatus =
    status === "active" ? "APPROVED" : status === "rejected" ? "REJECTED" : "PENDING";
  const role = String(record.role ?? "dispatcher").toLowerCase();
  const labelRole = role === "line_manager" ? "Site Manager" : "Dispatcher";

  return {
    id: record.id,
    name,
    role: labelRole,
    area: "Unassigned",
    email: record.email ?? "No email",
    submitted: submittedAt ? new Date(submittedAt).toLocaleDateString("en-PH") : "Unknown",
    docs: [],
    status: normalizedStatus,
    rejectReason: record.rejectReason ?? record.reject_reason ?? undefined,
  };
}

function normalizeHealthStatus(status?: string): ServiceStatus {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "OPERATIONAL" || normalized === "DEGRADED" || normalized === "DOWN") {
    return normalized;
  }
  return "DOWN";
}

function mapSystemHealthRecord(svc: AdminSystemHealthRecord): ServiceHealth {
  return {
    name: svc.name,
    status: normalizeHealthStatus(svc.status),
    latency: svc.latency ?? `${svc.latencyMs ?? 0}ms`,
    uptime: svc.uptime ?? "",
    note: svc.note,
  };
}

// 
//  ROOT ADMIN PORTAL
// 
export default function AdminPortal() {
  const router = useRouter();
  const [page, setPage] = useState<AdminPage>("overview");
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [qrRecords, setQRRecords] = useState<QRRecord[]>([]);
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [disastersLoading, setDisastersLoading] = useState(true);
  const [profile, setProfile] = useState<AdminProfile>({
    name: "",
    initials: "AD",
    badge: "",
    station: "",
    email: "",
    phone: "",
    role: "System Administrator",
  });
  const [activityLog, setActivityLog] = useState<{ time: string; type: string; msg: string; col: string }[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [systemHealth, setSystemHealth] = useState<ServiceHealth[]>([]);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [initialHydrating, setInitialHydrating] = useState(true);
  const [approvalsDataStatus, setApprovalsDataStatus] = useState<"live" | "unavailable">("unavailable");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef(0);

  const refreshSystemHealth = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? loadSession()?.accessToken;
    if (!token) {
      setSystemHealth([]);
      return false;
    }

    setHealthRefreshing(true);
    try {
      const health = await getSystemHealth(token);
      if (health.length > 0) {
        setSystemHealth(health.map(mapSystemHealthRecord));
      } else {
        setSystemHealth([]);
      }
      return true;
    } catch {
      setSystemHealth([]);
      return false;
    } finally {
      setHealthRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const stored = loadSession();
    if (!hasRole(stored, AppRole.ADMIN)) {
      router.replace("/login");
      return;
    }
    setSession(stored);
    // Populate profile from the real logged-in session
    const u = stored!.user;
    const initials = ((u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "")).toUpperCase() || "AD";
    setProfile({
      name: u.name || u.email,
      initials,
      badge: `ADM-${u.id.slice(0, 8).toUpperCase()}`,
      station: "Damayan National Operations Center",
      email: u.email,
      phone: u.phone || "",
      role: "System Administrator",
    });
    // Hydrate dashboard and disaster data from the backend
    async function hydrate() {
      const token = stored!.accessToken;
      setInitialHydrating(true);
      setDisastersLoading(true);

      const dashboardPromise = getDashboard("admin", token)
        .then((result) => {
          setOverview(result);
        })
        .catch(() => {
          setOverview(null);
        });

      const disasterPromise = getDisasterEvents("admin", token)
        .then((payload) => {
          const eventList = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as { disasterEvents?: (BackendDisasterEvent & { ticketCount?: number })[] }).disasterEvents)
              ? (payload as { disasterEvents: (BackendDisasterEvent & { ticketCount?: number })[] }).disasterEvents
              : [];
          setDisasters(eventList.map(mapBackendDisaster));
        })
        .catch(() => {
          setDisasters([]);
        })
        .finally(() => {
          setDisastersLoading(false);
        });

      const citizenPromise = getCitizens(token).catch(() => [] as Awaited<ReturnType<typeof getCitizens>>);
      const familyPromise = getFamilies(token).catch(() => [] as Awaited<ReturnType<typeof getFamilies>>);

      const qrPromise = Promise.all([citizenPromise, familyPromise]).then(([citizens, families]) => {
        const qrList: QRRecord[] = [];

        for (const c of citizens) {
          const qrId = c.qrCodeId ?? c.qr_code_id;
          if (!qrId) continue;
          const area = [c.barangay, c.municipality].filter(Boolean).join(", ") || "";
          qrList.push({
            id: qrId,
            name: c.fullName ?? c.full_name ?? "Unknown",
            type: "individual",
            area,
            issuedAt: new Date(c.createdAt ?? c.created_at ?? Date.now()).toLocaleDateString("en-PH"),
            linkedAccountId: c.userId ?? c.user_id,
          });
        }

        for (const f of families) {
          const qrId = f.qrCodeId ?? f.qr_code_id;
          if (!qrId) continue;
          const area = [f.barangay, f.municipality].filter(Boolean).join(", ") || "";
          const familyName = f.headFullName ?? f.head_full_name;
          qrList.push({
            id: qrId,
            name: familyName ? `${familyName} Family` : "Unknown Family",
            type: "family",
            area,
            issuedAt: new Date(f.createdAt ?? f.created_at ?? Date.now()).toLocaleDateString("en-PH"),
            familySize: f.members?.length || f.family_member_count || undefined,
          });
        }

        setQRRecords(qrList);
      });

      const approvalsPromise = getPendingApprovals(token)
        .then((result) => {
          setAccounts(result.map(mapApprovalToAccount));
          setApprovalsDataStatus("live");
        })
        .catch(() => {
          setAccounts([]);
          setApprovalsDataStatus("unavailable");
        });

      await Promise.allSettled([
        dashboardPromise,
        disasterPromise,
        qrPromise,
        approvalsPromise,
        refreshSystemHealth(token),
      ]);
      setInitialHydrating(false);
    }
    void hydrate();
  }, [router, refreshSystemHealth]);

  const showToast = useCallback((type: ToastItem["type"], title: string, sub?: string) => {
    const id = ++toastRef.current;
    setToasts((p) => [...p, { id, type, title, sub }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const addLiveNotification = useCallback((alert: LiveAlertRecord) => {
    setNotifications((current) => [mapLiveAlertToNotification(alert), ...current].slice(0, 12));
    showToast("info", alert.title, alert.message.slice(0, 90));
  }, [showToast]);

  const addLog = useCallback((type: string, msg: string, col: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setActivityLog((p) => [{ time, type, msg, col }, ...p]);
  }, []);

  const handleApprove = useCallback((id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const applyLocalApproval = () => {
      setAccounts((p) => p.map((a) => a.id === id ? { ...a, status: "APPROVED" as AccountStatus, qrGenerated: true } : a));
      const qr: QRRecord = { id: `QR-${5000 + qrRecords.length + 1}`, name: acc.name, type: "individual", area: acc.area, issuedAt: "Just now", linkedAccountId: id };
      setQRRecords((p) => [...p, qr]);
      addLog("APPROVED", `${acc.name} approved as ${acc.role}  ${qr.id} auto-generated`, "var(--admin-green)");
      showToast("success", "Account Approved", `${acc.name}  Individual QR ${qr.id} generated`);
    };

    const stored = loadSession();
    if (!stored?.accessToken) {
      showToast("error", "Approval Failed", "Session expired. Please log in again.");
      return;
    }

    void approvePendingUser(stored.accessToken, id)
      .then(() => applyLocalApproval())
      .catch(() => {
        showToast("error", "Approval Failed", "Could not approve user. Please try again.");
      });
  }, [accounts, qrRecords, addLog, showToast]);

  const handleReject = useCallback((id: string, reason: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const applyLocalReject = () => {
      setAccounts((p) => p.map((a) => a.id === id ? { ...a, status: "REJECTED" as AccountStatus, rejectReason: reason } : a));
      addLog("REJECTED", `${acc.name} rejected  ${reason.slice(0, 50)}`, "var(--admin-red)");
    };

    const stored = loadSession();
    if (!stored?.accessToken) {
      applyLocalReject();
      return;
    }

    void rejectPendingUser(stored.accessToken, id, reason)
      .then(() => applyLocalReject())
      .catch(() => {
        showToast("error", "Rejection Failed", "Could not reject user. Please try again.");
      });
  }, [accounts, addLog]);

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    addLog("BROADCAST", `System broadcast: "${broadcastMsg.slice(0, 60)}"`, "var(--admin-red)");
    showToast("warning", "Broadcast Sent", broadcastMsg.slice(0, 80));
    setBroadcastModal(false);
    setBroadcastMsg("");
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToLiveAlerts((alert) => {
      addLiveNotification(alert);
    });

    return () => {
      unsubscribe?.();
    };
  }, [addLiveNotification]);

  const pending = accounts.filter((a) => a.status === "PENDING").length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const PAGE_TITLES: Record<AdminPage, { title: string; sub: string }> = {
    overview: { title: "Overview", sub: "System-wide status and key metrics" },
    approvals: { title: "Account Approvals", sub: "Review documents and manage role applications" },
    people_records: { title: "People & Records", sub: "Individual and family records for all registered accounts" },
    after_calamity: { title: "After Calamity", sub: "Post-disaster response, relief deployment and reporting" },
    disaster_monitoring: { title: "Disaster Monitoring", sub: "Live feeds, event tracking, forecast analysis" },
    early_warning: { title: "Early Warning System", sub: "Configure and broadcast calamity warnings" },
    system_health: { title: "System Health", sub: "Platform service status and uptime" },
    profile: { title: "My Profile", sub: "Account settings and password management" },
  };

  const pt = PAGE_TITLES[page];

  return (
    <div className="admin-root">
      {/*  SIDEBAR  */}
      <div className="admin-sidebar">
        <div className="admin-sb-brand">
          <div className="admin-sb-mark">D</div>
          <div className="admin-sb-brand-text">
            <strong>Damayan</strong>
            <span>Admin Console</span>
          </div>
        </div>

        <div className="admin-sb-section">Navigation</div>
        <nav className="admin-sb-nav">
          {([
            { id: "overview", icon: "grid_view", label: "Overview" },
            { id: "approvals", icon: "how_to_reg", label: "Approvals", badge: pending },
            { id: "people_records", icon: "people", label: "People & Records" },
            { id: "after_calamity", icon: "assignment_turned_in", label: "After Calamity" },
            { id: "disaster_monitoring", icon: "crisis_alert", label: "Disaster Monitor" },
            { id: "early_warning", icon: "broadcast_on_home", label: "Early Warning" },
            { id: "system_health", icon: "monitor_heart", label: "System Health" },
          ] as { id: AdminPage; icon: string; label: string; badge?: number }[]).map((item) => (
            <button
              key={item.id}
              className={`admin-nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="admin-nav-icon material-symbols-outlined" style={{ fontSize: "1.2rem" }}>{item.icon}</span>
              {item.label}
              {item.badge != null && item.badge > 0 && (
                <span className="admin-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sb-footer">
          <div className="admin-sb-user" onClick={() => setPage("profile")}>
            <div className="admin-sb-avatar">{profile.initials}</div>
            <div>
              <span className="admin-sb-uname">{profile.name}</span>
              <span className="admin-sb-urole">Administrator</span>
            </div>
          </div>
        </div>
      </div>

      {/*  SHELL  */}
      <div className="admin-shell">
        {/* Topbar */}
        <div className="admin-topbar">
          <div>
            <span className="admin-topbar-title">{pt.title}</span>
            <span className="admin-topbar-sub">{pt.sub}</span>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-btn admin-btn-broadcast admin-btn-sm" onClick={() => setBroadcastModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>campaign</span>
              Broadcast Alert
            </button>

            {/* Notifications */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="admin-topbar-icon-btn" onClick={() => { setNotifOpen((p) => !p); setProfileOpen(false); }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>notifications</span>
                {unreadNotifs > 0 && <span className="admin-notif-dot" />}
              </button>
              {notifOpen && (
                <div className="admin-notif-dropdown">
                  <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--admin-outline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>Notifications</span>
                    <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}>Mark all read</button>
                  </div>
                  {notifications.map((n) => (
                    <div key={n.id} className={`admin-notif-item ${!n.read ? "unread" : ""}`} onClick={() => setNotifications((p) => p.map((x) => x.id === n.id ? { ...x, read: true } : x))}>
                      <div className="admin-notif-dot-ind" style={{ background: n.type === "red" ? "var(--admin-red)" : n.type === "amber" ? "var(--admin-amber)" : n.type === "green" ? "var(--admin-green)" : "var(--admin-blue)" }} />
                      <div>
                        <div className="admin-notif-text">{n.title}</div>
                        <div className="admin-notif-sub">{n.sub}</div>
                        <div className="admin-notif-time">{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div ref={profileRef} style={{ position: "relative" }}>
              <div className="admin-topbar-avatar" onClick={() => { setProfileOpen((p) => !p); setNotifOpen(false); }}>
                {profile.initials}
              </div>
              {profileOpen && (
                <div className="admin-profile-dropdown">
                  <div className="admin-profile-dropdown-head">
                    <div className="admin-profile-dropdown-avatar">{profile.initials}</div>
                    <div>
                      <div className="admin-profile-dropdown-name">{profile.name}</div>
                      <div className="admin-profile-dropdown-role">Admin - {profile.badge}</div>
                    </div>
                  </div>
                  <button className="admin-profile-dropdown-item" onClick={() => { setPage("profile"); setProfileOpen(false); }}><span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>person</span> View Profile</button>
                  <button className="admin-profile-dropdown-item" onClick={() => { setPage("profile"); setProfileOpen(false); }}><span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>edit</span> Edit Profile</button>
                  <div style={{ height: "1px", background: "var(--admin-outline)" }} />
                  <button className="admin-profile-dropdown-item danger" onClick={() => { clearSession(); router.replace("/login"); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>logout</span> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="admin-content">
          {page === "overview" && (
            <OverviewPage
              accounts={accounts}
              qrRecords={qrRecords}
              disasters={disasters}
              loading={initialHydrating}
              activityLog={activityLog}
              setPage={setPage}
              overview={overview}
            />
          )}
          {page === "approvals" && (
            <ApprovalsPage accounts={accounts} onApprove={handleApprove} onReject={handleReject} addLog={addLog} showToast={showToast} dataStatus={approvalsDataStatus} />
          )}
          {page === "people_records" && (
            <PeopleRecordsPage accounts={accounts} />
          )}
          {page === "after_calamity" && (
            <AfterCalamityPage showToast={showToast} addLog={addLog} />
          )}
          {page === "disaster_monitoring" && (
            <DisasterMonitoringPage
              disasters={disasters}
              loading={disastersLoading}
              setDisasters={setDisasters}
              showToast={showToast}
              authToken={session?.accessToken}
            />
          )}
          {page === "early_warning" && (
            <EarlyWarningPage
              disasters={disasters}
              showToast={showToast}
              addLog={addLog}
              setPage={setPage}
              authToken={session?.accessToken}
            />
          )}
          {page === "system_health" && (
            <SystemHealthPage
              showToast={showToast}
              services={systemHealth}
              refreshing={healthRefreshing}
              onRefresh={refreshSystemHealth}
            />
          )}
          {page === "profile" && (
            <ProfilePage profile={profile} onSave={setProfile} showToast={showToast} />
          )}
        </div>
      </div>

      {/* Broadcast Modal */}
      {broadcastModal && (
        <Modal
          title=" System-Wide Broadcast Alert"
          narrow
          onClose={() => { setBroadcastModal(false); setBroadcastMsg(""); }}
          footer={
            <>
              <button className="admin-btn admin-btn-ghost" onClick={() => { setBroadcastModal(false); setBroadcastMsg(""); }}>Cancel</button>
              <button className="admin-btn admin-btn-broadcast" onClick={sendBroadcast} disabled={!broadcastMsg.trim()}>
                Send Broadcast Now
              </button>
            </>
          }
        >
          <div className="admin-alert warning" style={{ marginBottom: "1rem" }}>
            <span className="admin-alert-icon material-symbols-outlined">warning</span>
            <div>This broadcast will be sent to all registered citizens, dispatchers, and field units.</div>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Broadcast Message</label>
            <textarea className="admin-form-textarea" rows={5} placeholder="Enter your emergency broadcast message" value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
            <span className="admin-form-hint">{broadcastMsg.length}/500 characters</span>
          </div>
        </Modal>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

