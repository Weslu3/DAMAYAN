"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "../../components/AuthLayout";
import { ApiError, signup } from "../../lib/api";
import { saveSession } from "../../lib/session";

export default function AdminSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    department: "",
    email: "",
    phone: "",
    authKey: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function splitName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { firstName: "", lastName: "" };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "Admin" };
    }

    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();

    const parsedName = splitName(form.fullName);
    if (!parsedName.firstName || !parsedName.lastName) {
      setError("Please provide your full name.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await signup({
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: form.email,
        phone: form.phone,
        password: form.authKey,
        role: "admin",
      });

      saveSession({
        accessToken: result.access_token,
        user: result.user,
      });

      router.push("/admin/beforecalamity");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to submit admin signup right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      persona="admin"
      portalName="System Administration"
      eyebrow="Privileged Access"
      headline={
        <>
          Initialize<br />
          <span className="auth-headline-accent">Network Admin.</span>
        </>
      }
      subline="Registration for centralized administrators and regional managers. Credentials submitted here require root physical verification."
      badgeText="Root Onboarding"
      formTitle="New Admin profile"
      formSub="Submit for credential initialization."
      switchText="Already have root access?"
      switchLink="/admin/login"
    >
      <form className="auth-form" onSubmit={handleApply}>
        <div className="auth-field">
          <label htmlFor="admin-signup-name">Root Administrator Name</label>
          <input
            id="admin-signup-name"
            type="text"
            placeholder="Authorized Personnel"
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="admin-signup-department">Department / Agency</label>
          <input
            id="admin-signup-department"
            type="text"
            placeholder="e.g., OCD, DSWD, LGU"
            value={form.department}
            onChange={(event) =>
              setForm((current) => ({ ...current, department: event.target.value }))
            }
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="admin-signup-email">Official Email</label>
          <input
            id="admin-signup-email"
            type="email"
            placeholder="root.admin@agency.gov.ph"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="admin-signup-phone">Phone Number</label>
          <input
            id="admin-signup-phone"
            type="tel"
            placeholder="09171234567"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="admin-signup-authkey">Auth Key</label>
          <input
            id="admin-signup-authkey"
            type="password"
            placeholder="Terminal authorization key"
            value={form.authKey}
            onChange={(event) =>
              setForm((current) => ({ ...current, authKey: event.target.value }))
            }
            required
          />
        </div>

        {error ? <p className="auth-error-copy">{error}</p> : null}

        <button className="auth-submit" type="submit">
          {loading ? "Submitting..." : "Request System Access"}
        </button>
      </form>
    </AuthLayout>
  );
}
