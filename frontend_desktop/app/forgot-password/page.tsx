"use client";

import "../signup/page.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { forgotPassword, resetPassword, ApiError } from "../lib/api";

export default function UnifiedForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await forgotPassword({ contact, method: "email" });
      setSuccessMsg(res.message || "A reset code has been sent to your email.");
      setStep("verify");
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Unable to request reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await resetPassword({ contact, code, newPassword });
      router.push("/login?reset=success");
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-root">
      {/* ===== LEFT: Dark Hero Brand Panel ===== */}
      <aside className="portal-hero">
        <div className="portal-bg-orb portal-bg-orb-1" />
        <div className="portal-bg-orb portal-bg-orb-2" />
        <div className="portal-bg-orb portal-bg-orb-3" />

        <div className="portal-hero-inner">
          <div className="portal-logo-row">
            <img src="/damayan_logo.svg" alt="Damayan Logo" className="portal-logo-img" />
            <div>
              <span className="portal-logo-name">DAMAYAN</span>
              <p className="portal-logo-tagline">Emergency Response Platform</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="portal-eyebrow">
              <span className="portal-eyebrow-dot" />
              Account Recovery
            </div>
            <h1 className="portal-headline">
              Recover<br />Your<br />
              <span className="portal-headline-accent">Access.</span>
            </h1>
            <p className="portal-subline">
              Don&apos;t worry — we&apos;ll send a secure recovery code to your registered email address to get you back in.
            </p>
          </div>

          <div className="portal-features">
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">mail_lock</span>
              Email Verification
            </div>
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">shield</span>
              Secure Reset
            </div>
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">speed</span>
              Instant Recovery
            </div>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT: Forgot Password Form Panel ===== */}
      <section className="portal-form-panel">
        <div className="portal-form-container" style={{ maxWidth: '440px' }}>
          <header className="form-header">
            <span className="form-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>lock_reset</span>
              {step === "request" ? "Step 1 of 2" : "Step 2 of 2"}
            </span>
            <h2 className="form-title">Reset Password</h2>
            <p className="form-subtitle">
              {step === "request"
                ? "Enter your email to receive a recovery code."
                : "Enter the code sent to your email and your new password."}
            </p>
          </header>

          {successMsg && (
            <div className="form-success">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>check_circle</span>
              {successMsg}
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequestCode}>
              <div className="form-field">
                <label htmlFor="contact">Email Address</label>
                <div className="form-input-wrap">
                  <span className="material-symbols-outlined form-input-icon">mail</span>
                  <input
                    id="contact"
                    type="email"
                    className="form-input"
                    placeholder="staff@damayan.ph"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="form-error">
                  <span className="material-symbols-outlined">error</span>
                  {error}
                </div>
              )}

              <button type="submit" className="form-submit" disabled={loading}>
                {loading ? "Sending..." : "Send Recovery Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="form-field">
                <label htmlFor="code">Recovery Code</label>
                <div className="form-input-wrap">
                  <span className="material-symbols-outlined form-input-icon">pin</span>
                  <input
                    id="code"
                    type="text"
                    className="form-input"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="newPassword">New Password</label>
                <div className="form-input-wrap">
                  <span className="material-symbols-outlined form-input-icon">lock</span>
                  <input
                    id="newPassword"
                    type={showPass ? "text" : "password"}
                    className="form-input"
                    placeholder="Create a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ paddingRight: '72px' }}
                  />
                  <button type="button" className="form-show-btn" onClick={() => setShowPass(!showPass)}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="form-error">
                  <span className="material-symbols-outlined">error</span>
                  {error}
                </div>
              )}

              <button type="submit" className="form-submit" disabled={loading}>
                {loading ? "Resetting..." : "Confirm New Password"}
              </button>
            </form>
          )}

          <div className="form-footer">
            <p className="form-footer-text">Remembered your password?</p>
            <Link href="/login" className="form-footer-link">
              <span className="material-symbols-outlined">login</span>
              Back to Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
