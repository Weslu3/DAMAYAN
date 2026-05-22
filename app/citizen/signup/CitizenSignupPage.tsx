"use client";

import { useEffect, useRef } from "react";
import AuthLayout from "../../components/AuthLayout";

type SignupStep = "PERSONAL" | "LOCATION" | "VERIFICATION" | "SUCCESS";

const STEPS: { label: string; icon: string }[] = [
  { label: "Personal", icon: "person" },
  { label: "Location", icon: "location_on" },
  { label: "Security", icon: "shield" },
];

const VERIFICATION_STEPS = [
  "Account Creation",
  "Identity Submission",
  "Staff Verification",
  "Portal Activation",
];

export default function CitizenSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("PERSONAL");
  
  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "PERSONAL") {
      if (!fullName || !username || !phone) {
        setError("Please fill in all personal details.");
        return;
      }
      setStep("LOCATION");
    } else if (step === "LOCATION") {
      if (!province || !municipality || !barangay || !address) {
        setError("Complete address is required for automated emergency routing.");
        return;
      }
      setStep("VERIFICATION");
    } else if (step === "VERIFICATION") {
      if (!password) {
        setError("Password is required.");
        return;
      }
      setLoading(true);
      // Simulate API call for now (or wire to actual Supabase signup if env ready)
      setTimeout(() => {
        setLoading(false);
        setStep("SUCCESS");
      }, 1500);
    }
  }

  if (step === "SUCCESS") {
    return (
      <AuthLayout
        persona="citizen"
        portalName="Registration Success"
        eyebrow="Join the Network"
        headline={
          <>
            Welcome to the<br />
            <span className="auth-headline-accent">Network.</span>
          </>
        }
        subline="Your account is being finalized. You can now access your citizen dashboard and secure your digital credentials."
      >
        <div style={{ textAlign: "center" }}>
          <div className="auth-success-icon">✓</div>
          
          <h2 className="auth-form-title" style={{ marginBottom: "16px" }}>Registration Complete!</h2>
          <p className="auth-form-sub" style={{ marginBottom: "40px" }}>
            Your digital preparedness profile is active. Secure your QR ID below for rapid checkpoint entry.
          </p>
          
          <div className="qr-container" style={{ 
            margin: "0 auto 40px", 
            padding: "24px", 
            backgroundColor: "#fff", 
            borderRadius: "32px", 
            border: "1px solid rgba(0,0,0,0.06)", 
            display: "inline-block",
            boxShadow: "0 20px 48px rgba(0,0,0,0.04)"
          }}>
            <div style={{ width: "200px", height: "200px", backgroundColor: "#000", position: "relative", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "12px", left: "12px", right: "12px", bottom: "12px", border: "12px solid #fff", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: "6px" }}>
                {[...Array(16)].map((_, i) => <div key={i} style={{ backgroundColor: i % 3 === 0 ? "#fff" : "transparent" }} />)}
              </div>
            </div>
            <p style={{ marginTop: "20px", fontWeight: "900", fontSize: "12px", letterSpacing: "3px", color: "#1a1c19" }}>IND-992-01-DM</p>
          </div>

          <div>
            <button 
              onClick={() => router.push("/citizen/beforecalamity")} 
              className="auth-submit"
              style={{ maxWidth: "320px", margin: "0 auto" }}
            >
              Enter Citizen Dashboard
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      persona="citizen"
      portalName="Citizen Registration"
      eyebrow="Join the Network"
      headline={
        <>
          Create Your<br />
          <span className="auth-headline-accent">Citizen Account.</span>
        </>
      }
      subline="Register for the citizen portal to receive real-time alerts, access your digital relief ID, and report incidents directly."
      badgeText="Sign Up"
      formTitle="Secure Registration"
      formSub="Complete the form to activate your digital preparedness profile."
      switchText="Already have an account?"
      switchLink="/citizen/login"
      brandAddon={
        <div className="auth-features" style={{ marginTop: "24px" }}>
          <strong style={{ display: "block", fontSize: "0.74rem", fontWeight: "800", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>Verification Path</strong>
          <div className="auth-steps-timeline">
            {VERIFICATION_STEPS.map((s, index) => {
              const isDone = step === "SUCCESS";
              const isActive = (step === "PERSONAL" && index === 0) || 
                              (step === "LOCATION" && index === 1) || 
                              (step === "VERIFICATION" && index === 2);
              return (
                <div key={s} className={`auth-timeline-item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
                  <div className="auth-timeline-node">{index + 1}</div>
                  <p style={{ margin: 0 }}>{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      }
    >
      {/* Form Progress Indicator */}
      {step !== "SUCCESS" && (
        <div className="auth-step-indicator" style={{ marginBottom: '32px' }}>
          {STEPS.map((s, i) => {
            const stepOrder = ["PERSONAL", "LOCATION", "VERIFICATION"];
            const currentIndex = stepOrder.indexOf(step as any);
            return (
              <div 
                key={s.label} 
                className={`auth-step-dot ${i === currentIndex ? 'is-active' : ''} ${i < currentIndex ? 'is-done' : ''}`}
                title={s.label}
              />
            );
          })}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSignup}>
        {step === "PERSONAL" && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="auth-field">
              <label>Full Name</label>
              <input type="text" placeholder="Juan Dela Cruz" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="auth-field">
              <label>Username</label>
              <input type="text" placeholder="juan.delacruz" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>

            <div className="auth-field">
              <label>Phone Number</label>
              <input type="tel" placeholder="+63 917 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
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
              <label>Street Address</label>
              <input type="text" placeholder="123 Mabini St., Block 4" value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
          </div>
        )}

        {step === "VERIFICATION" && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="auth-field">
              <label>Password</label>
              <input type="password" placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="auth-field">
              <label>Government ID (Recommended)</label>
              <div className="auth-input-wrap" style={{ cursor: "pointer" }}>
                <input
                  id="citizen-id"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  style={{ 
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    zIndex: 2
                  }}
                  onChange={(e) => setSelectedIdName(e.target.files?.[0]?.name ?? "No file selected")}
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
                  <span className="material-symbols-outlined" style={{ fontSize: "2rem", display: "block", marginBottom: "8px", color: "#2E7D32" }}>cloud_upload</span>
                  <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--auth-accent)" }}>
                    {selectedIdName === "No file selected" ? "Click to upload ID photo" : "ID Captured"}
                  </strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--auth-muted)" }}>
                    {selectedIdName === "No file selected" ? "JPG or PNG • Max 5MB" : selectedIdName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#d32f2f', fontSize: '0.85rem', fontWeight: '700', padding: '12px', background: '#ffebee', borderRadius: '12px', border: '1px solid #ffcdd2' }}>
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
                if (step === "VERIFICATION") setStep("LOCATION");
              }}
              style={{ flex: 1, background: 'var(--auth-neutral)', color: 'var(--ink)', boxShadow: 'none', border: '1.5px solid var(--auth-line)' }}
            >
              Back
            </button>
          )}
          <button className="auth-submit" type="submit" disabled={loading} style={{ flex: 2 }}>
            {loading ? "Processing..." : step === "VERIFICATION" ? "Complete Registration" : "Continue"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
