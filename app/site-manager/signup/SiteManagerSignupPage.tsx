"use client";

import { useEffect, useRef } from "react";
import AuthLayout from "../../components/AuthLayout";

type SignupStep = "PERSONAL" | "LOCATION" | "SECURITY";

const STEPS: { label: string; icon: string }[] = [
  { label: "Identity", icon: "badge" },
  { label: "Assignment", icon: "location_on" },
  { label: "Access", icon: "vpn_key" },
];

export default function SiteManagerSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("PERSONAL");
  
  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Location State
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [address, setAddress] = useState("");

  // PSGC Data State
  const [provinces, setProvinces] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedCityCode, setSelectedCityCode] = useState("");

  const [selectedIdName, setSelectedIdName] = useState("No file selected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Provinces on mount
  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/provinces")
      .then((res) => res.json())
      .then((data) => {
        data.push({ code: "130000000", name: "METRO MANILA" });
        data.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setProvinces(data);
      })
      .catch(console.error);
  }, []);

  // Fetch Municipalities when Province changes
  useEffect(() => {
    if (!selectedProvinceCode) {
      setMunicipalities([]);
      return;
    }
    const url = selectedProvinceCode === "130000000" 
      ? "https://psgc.gitlab.io/api/regions/130000000/cities-municipalities"
      : `https://psgc.gitlab.io/api/provinces/${selectedProvinceCode}/cities-municipalities`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        data.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setMunicipalities(data);
      })
      .catch(console.error);
  }, [selectedProvinceCode]);

  // Fetch Barangays when City changes
  useEffect(() => {
    if (!selectedCityCode) {
      setBarangays([]);
      return;
    }
    fetch(`https://psgc.gitlab.io/api/cities-municipalities/${selectedCityCode}/barangays`)
      .then((res) => res.json())
      .then((data) => {
        data.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setBarangays(data);
      })
      .catch(console.error);
  }, [selectedCityCode]);

  function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === "PERSONAL") {
      if (!fullName || !username) {
        setError("Please fill in your identity details.");
        return;
      }
      setStep("LOCATION");
    } else if (step === "LOCATION") {
      if (!province || !municipality || !barangay || !address) {
        setError("Please assign your site location correctly.");
        return;
      }
      setStep("SECURITY");
    } else if (step === "SECURITY") {
      if (!password) {
        setError("Password is required for portal access.");
        return;
      }
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setLoading(false);
        router.push("/site-manager/login?status=pending");
      }, 1500);
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
      brandAddon={
        <div className="auth-info-box" style={{ marginTop: "24px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
          <p style={{ margin: 0, fontSize: "0.88rem" }}>
            <strong>Note:</strong> Site manager accounts require administrative approval after registration. Ensure your Government ID is clearly visible.
          </p>
        </div>
      }
    >
      {/* Form Progress Indicator */}
      <div className="auth-step-indicator" style={{ marginBottom: '32px' }}>
        {STEPS.map((s, i) => {
          const stepOrder = ["PERSONAL", "LOCATION", "SECURITY"];
          const currentIndex = stepOrder.indexOf(step);
          return (
            <div 
              key={s.label} 
              className={`auth-step-dot ${i === currentIndex ? 'is-active' : ''} ${i < currentIndex ? 'is-done' : ''}`}
              title={s.label}
            />
          );
        })}
      </div>

      <form className="auth-form" onSubmit={handleRegister}>
        {step === "PERSONAL" && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="auth-field">
              <label>Full Name</label>
              <input type="text" placeholder="Site Manager Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="auth-field">
              <label>Username</label>
              <input type="text" placeholder="manager.username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            
            <div className="auth-field">
              <label>Government ID (Required for Verification)</label>
              <div className="auth-input-wrap" style={{ cursor: "pointer" }}>
                <input
                  id="signup-id"
                  type="file"
                  accept=".jpg,.jpeg,.png"
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
                  <span className="material-symbols-outlined" style={{ fontSize: "2rem", display: "block", marginBottom: "8px", color: "var(--auth-accent)" }}>contact_page</span>
                  <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--auth-accent)" }}>
                    {selectedIdName === "No file selected" ? "Upload Official ID" : "ID Cached"}
                  </strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--auth-muted)" }}>
                    {selectedIdName === "No file selected" ? "JPG or PNG • Max 5MB" : selectedIdName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "LOCATION" && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="auth-field">
              <label>Province</label>
              <select 
                className="auth-input-wrap" 
                style={{ appearance: 'none', padding: '15px 16px', borderRadius: '14px', border: '1.5px solid var(--auth-line)', background: 'var(--auth-neutral)', width: '100%', font: 'inherit' }}
                value={selectedProvinceCode} 
                onChange={(e) => {
                  const opt = e.target.options[e.target.selectedIndex];
                  setSelectedProvinceCode(e.target.value);
                  setProvince(opt.text);
                  setSelectedCityCode("");
                  setMunicipality("");
                }}
                required
              >
                <option value="">Select Province</option>
                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>

            <div className="auth-field">
              <label>City / Municipality</label>
              <select 
                className="auth-input-wrap"
                style={{ appearance: 'none', padding: '15px 16px', borderRadius: '14px', border: '1.5px solid var(--auth-line)', background: 'var(--auth-neutral)', width: '100%', font: 'inherit' }}
                value={selectedCityCode}
                onChange={(e) => {
                  const opt = e.target.options[e.target.selectedIndex];
                  setSelectedCityCode(e.target.value);
                  setMunicipality(opt.text);
                }}
                disabled={!selectedProvinceCode}
                required
              >
                <option value="">Select City/Municipality</option>
                {municipalities.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
              </select>
            </div>

            <div className="auth-field">
              <label>Barangay</label>
              <select 
                className="auth-input-wrap"
                style={{ appearance: 'none', padding: '15px 16px', borderRadius: '14px', border: '1.5px solid var(--auth-line)', background: 'var(--auth-neutral)', width: '100%', font: 'inherit' }}
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                disabled={!selectedCityCode}
                required
              >
                <option value="">Select Barangay</option>
                {barangays.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
              </select>
            </div>

            <div className="auth-field">
              <label>Site Street Address</label>
              <input type="text" placeholder="e.g. Brgy Hall, Main St." value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
          </div>
        )}

        {step === "SECURITY" && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="auth-field">
              <label>Create Password</label>
              <input type="password" placeholder="Create a secure password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="auth-info-box" style={{ background: 'var(--auth-accent-light)', border: '1px solid var(--auth-accent-ring)', color: 'var(--auth-accent)' }}>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                By joining as a site manager, you agree to uphold Damayan&apos;s data privacy standards for all evacuee information.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#d32f2f', fontSize: '0.85rem', fontWeight: '700', padding: '12px', background: '#ffebee', borderRadius: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          {step !== "PERSONAL" && (
            <button 
              type="button" 
              className="auth-submit" 
              onClick={() => {
                setError(null);
                if (step === "LOCATION") setStep("PERSONAL");
                if (step === "SECURITY") setStep("LOCATION");
              }}
              style={{ flex: 1, background: 'var(--auth-neutral)', color: 'var(--auth-ink)', boxShadow: 'none', border: '1.5px solid var(--auth-line)' }}
            >
              Back
            </button>
          )}
          <button className="auth-submit" type="submit" disabled={loading} style={{ flex: 2 }}>
            {loading ? "Registering..." : step === "SECURITY" ? "Complete Registration" : "Continue"}
          </button>
        </div>
      </form>

      <p className="auth-switch-copy">
        Already have an account? <Link href="/site-manager/login">Log in here</Link>
      </p>
    </AuthLayout>
  );
}
