"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "../../components/AuthLayout";
import { ApiError, signup } from "../../lib/api";
import { saveSession } from "../../lib/session";

export default function SiteManagerSignupPage() {
  const router = useRouter();
  const [selectedIdName, setSelectedIdName] = useState("No file selected");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const result = await signup({
        ...form,
        role: "line_manager",
      });
      saveSession({
        accessToken: result.access_token,
        user: result.user,
      });
      router.push("/site-manager");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to complete sign up right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      persona="sm"
      portalName="Site Manager Portal"
      eyebrow="Operations Command"
      headline={
        <>
          Scale Your<br />
          <span className="auth-headline-accent">Response Power.</span>
        </>
      }
      subline="Register for the site manager portal to validate your credentials, manage supply logs, and access the rescue network overview."
      badgeText="Registration"
      formTitle="Manager Account"
      formSub="Complete this form to activate your site operations dashboard."
      switchText="Already have an account?"
      switchLink="/site-manager/login"
    >
      <form className="auth-form" onSubmit={handleRegister}>
        <div className="auth-field" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div>
            <label htmlFor="sm-first-name">First Name</label>
            <input id="sm-first-name" type="text" placeholder="Juan" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required />
          </div>
          <div>
            <label htmlFor="sm-last-name">Last Name</label>
            <input id="sm-last-name" type="text" placeholder="Dela Cruz" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="sm-email">Email</label>
          <input id="sm-email" type="email" placeholder="manager@barangay.gov.ph" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </div>

        <div className="auth-field">
          <label htmlFor="sm-phone">Phone Number</label>
          <input id="sm-phone" type="tel" placeholder="09171234567" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
        </div>

        <div className="auth-field">
          <label htmlFor="sm-password">Password</label>
          <input id="sm-password" type="password" placeholder="Create a secure password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
        </div>

        <div className="auth-field">
          <label>Government ID (Required for Verification)</label>
          <div className="auth-input-wrap" style={{ cursor: "pointer" }}>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              required
              style={{ 
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                zIndex: 2
              }}
              onChange={(event) =>
                setSelectedIdName(
                  event.target.files?.[0]?.name ?? "No file selected"
                )
              }
            />
            <div 
              className="auth-upload-backdrop" 
              style={{ 
                width: "100%",
                padding: "24px",
                borderRadius: "16px",
                border: "2px dashed var(--auth-line)",
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.01)",
                transition: "all 0.2s ease"
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "2rem", display: "block", marginBottom: "8px", color: "#2E7D32" }}>description</span>
              <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--auth-accent)" }}>
                {selectedIdName === "No file selected" ? "Upload Official ID" : "ID Cached"}
              </strong>
              <span style={{ fontSize: "0.8rem", color: "var(--auth-muted)" }}>
                {selectedIdName === "No file selected" ? "JPG or PNG • Max 5MB" : selectedIdName}
              </span>
            </div>
          </div>
        </div>

        <p className="auth-form-sub" style={{ marginTop: -4 }}>
          Verification document upload is still UI-only until an approval/document backend model is added.
        </p>

        {error ? <p className="auth-error-copy">{error}</p> : null}

        <button className="auth-submit" type="submit">
          {loading ? "Creating account..." : "Submit Registration"}
        </button>
      </form>

      <p className="auth-switch-copy">
        Already have an account? <Link href="/site-manager/login">Log in here</Link>
      </p>
    </AuthLayout>
  );
}
