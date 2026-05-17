"use client";

import Link from "next/link";
import { ReactNode } from "react";
import "./auth.css";

export type PersonaType = "citizen" | "sm" | "dispatcher" | "admin";

interface AuthLayoutProps {
  persona: PersonaType;
  portalName: string;
  eyebrow: string;
  headline: ReactNode;
  subline: string;
  brandAddon?: ReactNode;
  badgeText?: string;
  formTitle?: string;
  formSub?: string;
  switchText?: string;
  switchLink?: string;
  children: ReactNode;
}

export default function AuthLayout({
  persona,
  portalName,
  eyebrow,
  headline,
  subline,
  brandAddon,
  badgeText,
  formTitle,
  formSub,
  switchText,
  switchLink,
  children,
}: AuthLayoutProps) {
  return (
    <main className={`auth-root ${persona}-auth`}>
      {/* Decorative blobs */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      {/* Brand Panel */}
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center' }}>
             <div style={{ width: '56px', height: '56px', marginRight: '16px', flexShrink: 0 }}>
               <img src="/damayan-logo.png" alt="Damayan Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
             </div>
            <div>
              <span className="auth-logo-name" style={{ color: '#FFC107' }}>DAMAYAN</span>
              <p className="auth-logo-sub">{portalName}</p>
            </div>
          </div>

          <div className="auth-brand-copy">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1 className="auth-headline">{headline}</h1>
            <p className="auth-subline">{subline}</p>
            {brandAddon}
          </div>
        </div>
      </aside>

      {/* Form Panel */}
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-logo" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '12px' }}>
             <div style={{ width: '42px', height: '42px', flexShrink: 0 }}>
               <img src="/damayan-logo.png" alt="Damayan Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
             </div>
            <span className="auth-logo-name" style={{ color: '#FFC107' }}>DAMAYAN</span>
          </div>

          <header className="auth-form-head">
            {badgeText && <span className="auth-badge">{badgeText}</span>}
            {formTitle && <h2 className="auth-form-title">{formTitle}</h2>}
            {formSub && <p className="auth-form-sub">{formSub}</p>}
          </header>

          {switchText && switchLink && (
            <div className="auth-switch-bar">
              <span>{switchText}</span>
              <Link href={switchLink}>Open role selector →</Link>
            </div>
          )}

          {/* Form Content */}
          {children}

        </div>
      </section>
    </main>
  );
}
