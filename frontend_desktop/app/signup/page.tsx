"use client";

import "./page.css";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ApiError, getPublicRegions, signup, uploadGovernmentIdForSignup } from "../lib/api";
import { AppRole } from "../lib/types";

function CustomSelect({ value, options, onChange, placeholder, disabled, icon }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value === value);

  return (
    <div className="form-input-wrap" ref={dropdownRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 100 : 1 }}>
      <span className="material-symbols-outlined form-input-icon">{icon}</span>
      <div 
        className={`form-select ${disabled ? 'disabled' : ''}`}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '48px',
          padding: '0 16px 0 48px',
          color: selectedOption ? '#1a1c19' : '#a3b3a3',
          backgroundImage: 'none',
          boxSizing: 'border-box'
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8fa88f', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </div>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #dde5dd',
          boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
          maxHeight: '240px',
          overflowY: 'auto',
          zIndex: 50,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {options.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#6b7b6a', fontSize: '0.85rem', textAlign: 'center' }}>No options available</div>
          )}
          {options.map((opt: any) => (
            <div 
              key={opt.value}
              onClick={() => {
                onChange(opt.value, opt.label);
                setIsOpen(false);
              }}
              className="custom-option"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UnifiedSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  const [role, setRole] = useState<AppRole>(AppRole.LINE_MANAGER);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  // Location Fields (Names for DB)
  const [barangay, setBarangay] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [province, setProvince] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");

  // Location Fields (Codes for PSGC API)
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedCityCode, setSelectedCityCode] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [selectedIdFile, setSelectedIdFile] = useState<File | null>(null);
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

  useEffect(() => {
    getPublicRegions()
      .then((data) => {
        setRegions(data ?? []);
      })
      .catch(console.error);
  }, []);

  // Fetch Cities when Province changes
  useEffect(() => {
    if (!selectedProvinceCode) {
      setCities([]);
      return;
    }
    const url = selectedProvinceCode === "130000000" 
      ? "https://psgc.gitlab.io/api/regions/130000000/cities-municipalities"
      : `https://psgc.gitlab.io/api/provinces/${selectedProvinceCode}/cities-municipalities`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        data.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCities(data);
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

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate Step 1
    if (step === 1) {
      if (!role || !firstName || !lastName || !email || !phone) {
        setError("Please fill in all personal details.");
        return;
      }
      if (phone.length < 13) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }
      setStep(2);
    } 
    // Validate Step 2
    else if (step === 2) {
      if (!selectedRegionId || !province || !municipality || !barangay) {
        setError("Please select your region and complete the location information.");
        return;
      }
      setStep(3);
    } 
    // Validate Step 3
    else if (step === 3) {
      if (!password) {
        setError("Please create a password for your account.");
        return;
      }
      if (!selectedIdFile) {
        setError("Please upload a valid Official ID before submitting.");
        return;
      }
      handleRegister();
    }
  }

  async function handleRegister() {
    try {
      setLoading(true);
      setError(null);

      if (!selectedIdFile) {
        throw new ApiError("Please upload a Government ID before submitting.", 400);
      }
      if (selectedIdFile.size > 5 * 1024 * 1024) {
        throw new ApiError("Government ID file must be 5MB or smaller.", 400);
      }

      const upload = await uploadGovernmentIdForSignup({
        file: selectedIdFile,
        applicantRole: role,
        applicantEmail: email,
      });

      const formattedPhone = "0" + phone.replace(/\D/g, "").substring(2);

      const result = await signup({
        firstName,
        lastName,
        email,
        phone: formattedPhone,
        password,
        role,
        barangay,
        municipality,
        province,
        assignedRegionId: selectedRegionId,
        governmentIdKey: `${upload.bucket}/${upload.objectPath}`,
        governmentIdFileName: selectedIdFile.name,
      });

      if (result?.access_token) {
        router.push("/login?signup=success");
        return;
      }
      router.push("/login");
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
    <main className="portal-root">
      {/* ===== LEFT: Dark Hero Brand Panel ===== */}
      <aside className="portal-hero">
        <div className="portal-bg-orb portal-bg-orb-1" />
        <div className="portal-bg-orb portal-bg-orb-2" />
        <div className="portal-bg-orb portal-bg-orb-3" />

        <div className="portal-hero-inner">
          <div className="portal-logo-row">
            <img src="/damayan_logo.png" alt="Damayan Logo" className="portal-logo-img" />
            <div>
              <span className="portal-logo-name">DAMAYAN</span>
              <p className="portal-logo-tagline">Emergency Response Platform</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="portal-eyebrow">
              <span className="portal-eyebrow-dot" />
              Join the Response Network
            </div>
            <h1 className="portal-headline">
              Apply for<br />Command<br />
              <span className="portal-headline-accent">Center Access.</span>
            </h1>
            <p className="portal-subline">
              Register as a site manager, dispatcher, or administrator
              to join the Damayan emergency coordination network.
            </p>
          </div>

          <div className="portal-features">
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">verified_user</span>
              ID Verification
            </div>
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              Admin Approval
            </div>
            <div className="portal-feature-pill">
              <span className="material-symbols-outlined">bolt</span>
              Instant Activation
            </div>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT: Sign-Up Form Panel ===== */}
      <section className="portal-form-panel">
        <div className="portal-form-container" style={{ maxWidth: '480px' }}>
          
          {/* Form Header */}
          <header className="form-header" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{ 
                  height: '4px', 
                  width: '40px', 
                  borderRadius: '2px', 
                  background: s <= step ? '#81C784' : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s ease'
                }} />
              ))}
            </div>
            
            <h2 className="form-title">
              {step === 1 ? "Personal Details" : step === 2 ? "Location Info" : "Verification"}
            </h2>
            <p className="form-subtitle">
              {step === 1 ? "Start by telling us who you are." : step === 2 ? "Where will you be assigned?" : "Secure your account and verify your identity."}
            </p>
          </header>

          <form onSubmit={handleNextStep}>
            
            {/* --- STEP 1 --- */}
            {step === 1 && (
              <div style={{ animation: 'formSlideUp 0.4s ease forwards', position: 'relative', zIndex: 10 }}>
                <div className="form-field">
                  <label htmlFor="role">Assigned Role</label>
                  <CustomSelect
                    icon="badge"
                    value={role}
                    options={[
                      { value: AppRole.LINE_MANAGER, label: "Site Manager" },
                      { value: AppRole.DISPATCHER, label: "Dispatcher" },
                      { value: AppRole.ADMIN, label: "Administrator" }
                    ]}
                    onChange={(val: string) => setRole(val as AppRole)}
                  />
                </div>

                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                  <div className="form-field">
                    <label htmlFor="firstName">First Name</label>
                    <div className="form-input-wrap">
                      <span className="material-symbols-outlined form-input-icon">person</span>
                      <input id="firstName" type="text" className="form-input" placeholder="Juan" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="lastName">Last Name</label>
                    <div className="form-input-wrap">
                      <input id="lastName" type="text" className="form-input form-input--plain" placeholder="Dela Cruz" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="email">Email Address</label>
                  <div className="form-input-wrap">
                    <span className="material-symbols-outlined form-input-icon">mail</span>
                    <input id="email" type="email" className="form-input" placeholder="staff@damayan.ph" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                
                <div className="form-field">
                  <label htmlFor="phone">Phone Number</label>
                  <div className="form-input-wrap">
                    <span className="material-symbols-outlined form-input-icon">phone</span>
                    <input 
                      id="phone" 
                      type="tel" 
                      className="form-input" 
                      placeholder="+63 917 123 4567" 
                      value={phone} 
                      onFocus={() => {
                        if (!phone) setPhone("+63 ");
                      }}
                      onChange={(e) => {
                        let input = e.target.value;
                        if (input.length < 3) {
                          setPhone("");
                          return;
                        }
                        let digits = input.replace(/\D/g, "");
                        if (digits.startsWith("63")) digits = digits.substring(2);
                        else if (digits.startsWith("0")) digits = digits.substring(1);
                        
                        if (digits.length > 0 && digits[0] !== "9") digits = "9";
                        digits = digits.substring(0, 10);
                        
                        setPhone("+63 " + digits);
                      }} 
                      required 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 2 --- */}
            {step === 2 && (
              <div style={{ animation: 'formSlideUp 0.4s ease forwards', position: 'relative', zIndex: 10 }}>
                <div className="form-field">
                  <label htmlFor="region">Region</label>
                  <CustomSelect
                    icon="public"
                    placeholder="Select Region"
                    value={selectedRegionId}
                    options={regions.map((region) => ({ value: region.id, label: region.name }))}
                    onChange={(regionId: string) => setSelectedRegionId(regionId)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="province">Province</label>
                  <CustomSelect
                    icon="map"
                    placeholder="Select Province"
                    value={selectedProvinceCode}
                    options={provinces.map(p => ({ value: p.code, label: p.name }))}
                    onChange={(code: string, name: string) => {
                      setSelectedProvinceCode(code);
                      setProvince(name);
                      setSelectedCityCode("");
                      setMunicipality("");
                      setBarangay("");
                    }}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="municipality">City / Municipality</label>
                  <CustomSelect
                    icon="location_city"
                    placeholder="Select City/Municipality"
                    value={selectedCityCode}
                    disabled={!selectedProvinceCode}
                    options={cities.map(c => ({ value: c.code, label: c.name }))}
                    onChange={(code: string, name: string) => {
                      setSelectedCityCode(code);
                      setMunicipality(name);
                      setBarangay("");
                    }}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="barangay">Barangay</label>
                  <CustomSelect
                    icon="location_on"
                    placeholder="Select Barangay"
                    value={barangay}
                    disabled={!selectedCityCode}
                    options={barangays.map(b => ({ value: b.name, label: b.name }))}
                    onChange={(val: string, name: string) => setBarangay(name)}
                  />
                </div>
              </div>
            )}

            {/* --- STEP 3 --- */}
            {step === 3 && (
              <div style={{ animation: 'formSlideUp 0.4s ease forwards' }}>
                <div className="form-field">
                  <label htmlFor="password">Password</label>
                  <div className="form-input-wrap">
                    <span className="material-symbols-outlined form-input-icon">lock</span>
                    <input id="password" type={showPass ? "text" : "password"} className="form-input" placeholder="Create a secure password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: '72px' }} />
                    <button type="button" className="form-show-btn" onClick={() => setShowPass(!showPass)}>{showPass ? "Hide" : "Show"}</button>
                  </div>
                </div>

                <div className="form-field">
                  <label>Government ID (Required for Verification)</label>
                  <div style={{ position: "relative", cursor: "pointer", marginTop: '4px' }}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      required
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", zIndex: 2 }}
                      onChange={(e) => {
                        const nextFile = e.target.files?.[0] ?? null;
                        setSelectedIdFile(nextFile);
                        setSelectedIdName(nextFile?.name ?? "No file selected");
                      }}
                    />
                    <div className={`form-upload-zone ${selectedIdName !== "No file selected" ? "form-upload-zone--selected" : ""}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: selectedIdName !== "No file selected" ? '#2E7D32' : '#8fa88f', display: 'block', marginBottom: '6px' }}>
                        {selectedIdName !== "No file selected" ? 'task_alt' : 'cloud_upload'}
                      </span>
                      <strong style={{ display: "block", color: selectedIdName !== "No file selected" ? '#2E7D32' : '#4a5449', fontSize: '0.95rem' }}>
                        {selectedIdName === "No file selected" ? "Click or drag to upload Official ID" : "ID Selected Successfully"}
                      </strong>
                      <span style={{ fontSize: "0.8rem", color: "#5f6b5e", marginTop: '2px', display: 'block' }}>
                        {selectedIdName === "No file selected" ? "JPG or PNG • Max 5MB" : selectedIdName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="form-error">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {step > 1 && (
                <button 
                  type="button" 
                  onClick={() => setStep(step - 1)}
                  className="form-submit" 
                  style={{ flex: 1, width: 'auto', background: '#F5F7F5', border: '1.5px solid #dde5dd', boxShadow: 'none', color: '#3d4a3c' }}
                  disabled={loading}
                >
                  Back
                </button>
              )}
              <button type="submit" className="form-submit" disabled={loading} style={{ flex: 2, width: 'auto' }}>
                {loading ? "Submitting..." : step < 3 ? "Continue to Next Step" : "Submit Registration"}
              </button>
            </div>
          </form>

          <div className="form-footer">
            <p className="form-footer-text">Already have an account?</p>
            <Link href="/login" className="form-footer-link">
              <span className="material-symbols-outlined">login</span>
              Sign In Instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
