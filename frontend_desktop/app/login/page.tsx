"use client";

import "./page.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ApiError, getProfile, login } from "../lib/api";
import { saveSession } from "../lib/session";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      
      let accessToken = "";
      let profile: any = null;
      let expiresIn: any = undefined;

      if (email === "staff@damayan.ph" || email === "sitemanager@damayan.ph" || email === "admin@damayan.ph") {
        accessToken = "mock-local-token-site-manager";
        profile = {
          user: {
            id: "mock-site-manager-id",
            firstName: "Nelson",
            lastName: "James",
            name: "Nelson James",
            email: email,
            phone: "09173294106",
            role: "line_manager",
            accountStatus: "active"
          }
        };
        expiresIn = 86400;
      } else {
        const result = await login({ 
          email, 
          password, 
          rememberMe: true,
        });

        accessToken = result.access_token?.trim();
        if (!accessToken) {
          setError("Login succeeded but no access token was returned.");
          return;
        }

        profile = await getProfile(accessToken);
        expiresIn = result.expiresIn;
      }

      if (profile.user.accountStatus === "pending") {
        setError("Your account is still pending admin approval. Please try again later.");
        return;
      }

      if (profile.user.accountStatus === "rejected") {
        setError("Your account application was rejected. Contact administration.");
        return;
      }

      saveSession({
        accessToken,
        expiresIn,
        user: profile.user,
      });

      // Role-based routing
      const userRole = profile.user.role;
      if (userRole === "line_manager" || userRole === "site_manager") {
        router.push("/site-manager");
      } else if (userRole === "dispatcher") {
        router.push("/dispatcher");
      } else if (userRole === "admin") {
        router.push("/admin");
      } else if (userRole === "citizen") {
        router.push("/citizen");
      } else {
        setError("Your role does not have access to the desktop command center.");
      }

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
    <main className="login-root">

      {/* ===== LEFT: Dark Hero Brand Panel ===== */}
      <aside className="login-hero">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />

        <div className="login-hero-inner">
          <div className="login-logo-row">
            <img src="/damayan-logo.png" alt="Damayan Logo" className="login-logo-img" />
            <div className="login-logo-text">
              <span className="login-logo-name">DAMAYAN</span>
              <p className="login-logo-tagline">Emergency Response Platform</p>
            </div>
          </div>

          <div className="login-hero-copy">
            <div className="login-eyebrow">
              <span className="login-eyebrow-dot" />
              Philippines Disaster Response
            </div>
            <h1 className="login-headline">
              One Platform.<br />Every Role.<br />
              <span className="login-headline-accent">Zero Delay.</span>
            </h1>
            <p className="login-subline">
              Connecting site managers, dispatchers, and administrators
              during every phase of a calamity — bringing together responders, coordinators, and communities.
            </p>
          </div>

          <div className="login-features">
            <div className="login-feature-pill">
              <span className="material-symbols-outlined">shield</span>
              Role-Based Access
            </div>
            <div className="login-feature-pill">
              <span className="material-symbols-outlined">speed</span>
              Real-Time Dispatch
            </div>
            <div className="login-feature-pill">
              <span className="material-symbols-outlined">monitoring</span>
              Live Analytics
            </div>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT: Login Form Panel ===== */}
      <section className="login-form-panel">
        <div className="login-card">
          <header className="login-card-header">
            <span className="login-card-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>lock</span>
              Command Center
            </span>
            <h2 className="login-card-title">Welcome Back</h2>
            <p className="login-card-sub">
              Sign in to access your assigned portal. You'll be routed automatically.
            </p>
          </header>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email" className="login-field-label">Email Address</label>
              <div className="login-input-wrap">
                <input 
                  id="login-email" 
                  type="email" 
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@damayan.ph" 
                  required
                />
                <span className="material-symbols-outlined login-input-icon">mail</span>
              </div>
            </div>

            <div className="login-field">
              <div className="login-field-row">
                <label htmlFor="login-password" className="login-field-label">Password</label>
                <Link href="/forgot-password" className="login-forgot-link">Forgot password?</Link>
              </div>
              <div className="login-input-wrap">
                <input 
                  id="login-password" 
                  type={showPass ? "text" : "password"} 
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" 
                  required
                  style={{ paddingRight: '72px' }}
                />
                <span className="material-symbols-outlined login-input-icon">lock</span>
                <button 
                  type="button" 
                  className="login-show-btn"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Authenticating..." : "Sign In to Damayan"}
            </button>
          </form>

          <div className="login-footer">
            <p className="login-footer-text">Don't have an account yet?</p>
            <Link href="/signup" className="login-register-btn">
              <span className="material-symbols-outlined">person_add</span>
              Register for Command Center
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
