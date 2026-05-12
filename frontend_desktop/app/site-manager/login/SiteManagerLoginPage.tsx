"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "../../components/AuthLayout";
import { ApiError, getProfile, login } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { AppRole } from "../../lib/types";

export default function SiteManagerLoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const result = await login({ 
        email, 
        password, 
        rememberMe: true,
        requiredRole: AppRole.LINE_MANAGER
      });

      if (result.user.role !== "line_manager") {
        setError("This account does not have site manager access.");
        return;
      }

      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        setError("Login succeeded but no access token was returned.");
        return;
      }

      // Verify token before redirect to avoid page flash then immediate logout.
      const profile = await getProfile(accessToken);

      saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: profile.user,
      });
      router.push("/site-manager");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to sign in right now.",
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
          Manage Sites.<br />
          Coordinate Relief.<br />
          <span className="auth-headline-accent">Keep Response Moving.</span>
        </>
      }
      subline="Access shelter readiness, evacuee intake, local distribution logs, and on-site response coordination from one operations dashboard."
      badgeText="Site Manager Login"
      formTitle="Welcome back"
      formSub="Sign in to access your site operations dashboard."
      switchText="Need another portal?"
      switchLink="/login"
    >
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="site-manager-email">Email</label>
          <input
            id="site-manager-email"
            name="site-manager-email"
            type="email"
            placeholder="manager@barangay.gov.ph"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="site-manager-password">Password</label>
            <Link href="/site-manager/forgot-password" className="auth-forgot-link">
              Forgot password?
            </Link>
          </div>
          <div className="auth-input-wrap">
            <input
              id="site-manager-password"
              name="site-manager-password"
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="auth-toggle-pass"
              onClick={() => setShowPass((value) => !value)}
              aria-label="Toggle password visibility"
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error ? <p className="auth-error-copy">{error}</p> : null}

        <button className="auth-submit" type="submit">
          {loading ? "Signing in..." : "Sign In to Site Manager Dashboard"}
        </button>
      </form>

      <p className="auth-switch-copy">
        Don&apos;t have an account?{" "}
        <Link href="/site-manager/signup">Create one here</Link>
      </p>
    </AuthLayout>
  );
}
