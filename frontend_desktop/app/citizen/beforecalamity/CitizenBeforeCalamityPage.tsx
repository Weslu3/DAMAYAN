"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { registerCitizen, addFamilyMember, addAnimal, clearFamilyMembers, clearAnimals, getCitizenProfile, getFamilyMembers, getAnimals } from "../../lib/api";
import { loadSession } from "../../lib/session";

const checklist = [
  {
    title: "Update Emergency Contact List",
    detail: "Ensure all phone numbers and medical info are current for household members.",
    status: "Done",
    done: true,
  },
  {
    title: "Restock 72-Hour Survival Kit",
    detail: "Check expiration dates on canned goods and refresh water supply (4L/person/day).",
    status: "Pending",
    done: false,
  },
  {
    title: "Verify Evacuation Route",
    detail: "Review the secondary route in case the primary highway is inaccessible.",
    status: "Pending",
    done: false,
  },
];

const sidebarLinks = [
  { label: "Home", href: "/citizen/beforecalamity", key: "home", icon: "H" },
  { label: "Risk Map", href: "#sector-map", key: "risk-map", icon: "M" },
  { label: "Checklists", href: "#checklists", key: "checklists", icon: "C" },
  { label: "Reporting", href: "/citizen/duringcalamity", key: "reporting", icon: "A" },
  { label: "Support", href: "#support", key: "support", icon: "S" },
];

const topLinks = ["Dashboard", "Emergency", "Shelters", "Prepare"];

function CitizenAvatarChip() {
  return (
    <div className="citizen-web-profile-avatar" aria-label="Citizen profile">
      SR
    </div>
  );
}

export default function CitizenBeforeCalamityPage() {
  const [activeSidebarItem, setActiveSidebarItem] = useState("home");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const [activeAlert, setActiveAlert] = useState<string | null>(
    "FLASH FLOOD WARNING: Sector 4 expects 20cm surge within 120mins. Acknowledge to receive evacuation route."
  );
  
  // New Registration Flow State
  const [registrationType, setRegistrationType] = useState<"Individual" | "Household" | null>(null);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [userProfile, setUserProfile] = useState({
    fullName: "",
    dob: "",
    gender: "",
    bloodType: "O+",
    conditions: "",
    consent: false
  });

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const session = loadSession();
      if (session?.accessToken) {
        try {
          const [data, fam, anim] = await Promise.all([
            getCitizenProfile(session.accessToken),
            getFamilyMembers(session.accessToken),
            getAnimals(session.accessToken)
          ]);

          if (data) {
            console.log("Found existing profile:", data);
            setProfile(data);
            setUserProfile({
              fullName: data.fullName || "",
              dob: data.birthDate || "",
              gender: data.gender || "",
              bloodType: data.bloodType || "O+",
              conditions: data.medicalConditions || "",
              consent: true
            });
          }

          if (fam) {
            // Map backend rows to frontend format
            setHouseholdMembers(fam.map(f => ({
              name: f.family_member_name,
              age: f.age,
              relationship: f.relationship,
              accessibilityNeeds: (f.accessibility_needs || "").split(", ").filter(Boolean)
            })));
          } else {
            setHouseholdMembers([]);
          }

          if (anim) {
            setAnimals(anim.map(a => ({
              name: a.name,
              species: a.species,
              needsCage: a.needs_cage
            })));
          } else {
            setAnimals([]);
          }
        } catch (err) {
          console.error("Failed to fetch profile or related data:", err);
        }
      }
    }
    loadData();
  }, []);

  const [householdMembers, setHouseholdMembers] = useState<any[]>([
    { name: "", age: "", relationship: "", accessibilityNeeds: [] }
  ]);

  const [animals, setAnimals] = useState<any[]>([
    { name: "", species: "", needsCage: false }
  ]);

  const [isEditing, setIsEditing] = useState(false);

  const handleAddMember = () => {
    setHouseholdMembers([...householdMembers, { name: "", age: "", relationship: "", accessibilityNeeds: [] }]);
  };

  const handleRemoveMember = (index: number) => {
    if (householdMembers.length > 1) {
      setHouseholdMembers(householdMembers.filter((_, i) => i !== index));
    }
  };

  const handleMemberChange = (index: number, field: string, value: any) => {
    const newMembers = [...householdMembers];
    if (field === "age") {
      const val = parseInt(value);
      newMembers[index][field] = isNaN(val) ? "" : Math.max(0, val).toString();
    } else {
      newMembers[index][field] = value;
    }
    setHouseholdMembers(newMembers);
  };

  const handleAddAnimal = () => {
    setAnimals([...animals, { name: "", species: "", needsCage: false }]);
  };

  const handleRemoveAnimal = (index: number) => {
    if (animals.length > 1) {
      setAnimals(animals.filter((_, i) => i !== index));
    }
  };

  const handleAnimalChange = (index: number, field: string, value: any) => {
    const newAnimals = [...animals];
    newAnimals[index][field] = value;
    setAnimals(newAnimals);
  };

  const toggleAccessibilityNeed = (memberIndex: number, needId: string) => {
    const member = householdMembers[memberIndex];
    const currentNeeds = member.accessibilityNeeds || [];
    const newNeeds = currentNeeds.includes(needId)
      ? currentNeeds.filter((id: string) => id !== needId)
      : [...currentNeeds, needId];
    handleMemberChange(memberIndex, "accessibilityNeeds", newNeeds);
  };

  const handleHouseholdSubmit = async () => {
    console.log("handleHouseholdSubmit started");
    
    // Basic validation
    if (!userProfile.fullName || !userProfile.dob || !userProfile.gender) {
      alert("Please complete all personal identity fields.");
      return;
    }

    try {
      const session = loadSession();
      if (!session) throw new Error("No active session. Please log in.");
      const token = session.accessToken;

      // REUSE EXISTING QR CODE OR GENERATE NEW ONE
      const qrCodeId = profile?.qrCodeId || `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      console.log("Using QR ID:", qrCodeId);

      // 1. Register the main citizen
      const citizenPayload: {
        fullName: string;
        birthDate: string;
        gender: string;
        bloodType: string;
        medicalConditions: string;
        registrationType: "Individual" | "Household";
        qrCodeId: string;
      } = {
        fullName: userProfile.fullName,
        birthDate: userProfile.dob,
        gender: userProfile.gender,
        bloodType: userProfile.bloodType,
        medicalConditions: userProfile.conditions,
        registrationType: registrationType === "Household" ? "Household" : "Individual",
        qrCodeId,
      };
      
      console.log("Registering citizen with payload:", JSON.stringify(citizenPayload, null, 2));
      await registerCitizen(token, citizenPayload);
      console.log("Citizen registration successful");

      // 2. If household, register members
      if (registrationType === "Household") {
        // PREVENT DUPLICATES: Clear existing members and animals first
        console.log("Clearing existing household data to prevent duplicates...");
        await Promise.all([
          clearFamilyMembers(token, qrCodeId),
          clearAnimals(token),
        ]);
        
        const validMembers = householdMembers.filter(m => m.name);
        const totalMembers = validMembers.length + 1; // +1 for the head of household
        
        console.log(`Registering ${validMembers.length} family members. Total members: ${totalMembers}`);
        
        for (const member of validMembers) {
          const familyPayload = {
            qrCodeId,
            headFullName: userProfile.fullName,
            familyMemberName: member.name,
            relationship: member.relationship || "Other",
            age: parseInt(member.age) || 0,
            accessibilityNeeds: (member.accessibilityNeeds || []).join(", "),
            familyMemberCount: totalMembers,
          };
          
          console.log("Adding family member:", JSON.stringify(familyPayload, null, 2));
          await addFamilyMember(token, familyPayload);
        }
        console.log("All family members registered");

        // 3. Register animals
        console.log("Registering animals:", animals);
        for (const animal of animals) {
          if (!animal.species) continue;
          
          const animalPayload = {
            name: animal.name || "Unnamed",
            species: animal.species,
            needsCage: animal.needsCage || false,
            qrCodeId,
          };
          
          console.log("Adding animal:", JSON.stringify(animalPayload, null, 2));
          await addAnimal(token, animalPayload);
        }
        console.log("All animals registered");
      }

      console.log("Registration process complete");
      setRegistrationSuccess(true);
    } catch (err: any) {
      console.error("Registration error:", err);
      alert(err.message || "Failed to complete registration.");
    }
  };

  const getMaxDob = (minAge: number = 0) => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
    return targetDate.toISOString().split("T")[0];
  };

  useEffect(() => {
    function syncActiveSidebarItem() {
      const hash = window.location.hash;
      if (hash === "#sector-map") {
        setActiveSidebarItem("risk-map");
        return;
      }
      if (hash === "#checklists") {
        setActiveSidebarItem("checklists");
        return;
      }
      if (hash === "#support") {
        setActiveSidebarItem("support");
        return;
      }
      setActiveSidebarItem("home");
    }

    syncActiveSidebarItem();
    window.addEventListener("hashchange", syncActiveSidebarItem);
    return () => {
      window.removeEventListener("hashchange", syncActiveSidebarItem);
    };
  }, []);

  return (
    <div className="citizen-web-page">
      {/* Notification Permission Overlay */}
      {showNotificationPrompt && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "32px", maxWidth: "450px", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}>
             <h2 style={{ fontSize: "24px", fontWeight: "900", marginBottom: "12px" }}>Enable Alerts?</h2>
             <p style={{ color: "#707a6c", lineHeight: "1.6", marginBottom: "32px" }}>Receive real-time surge warnings and evacuation route changes directly on your desktop.</p>
             <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setShowNotificationPrompt(false)} style={{ flex: 1, padding: "16px", borderRadius: "14px", border: "1px solid #eef1ed", backgroundColor: "#fff", fontWeight: "800", cursor: "pointer" }}>Not Now</button>
                <button onClick={() => setShowNotificationPrompt(false)} style={{ flex: 1, padding: "16px", borderRadius: "14px", border: "none", backgroundColor: "#2e7d32", color: "#fff", fontWeight: "800", cursor: "pointer" }}>Allow Alerts</button>
             </div>
          </div>
        </div>
      )}

      {/* High-Visibility Alert Banner */}
      {activeAlert && (
        <div style={{ backgroundColor: "#ba1a1a", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", position: "sticky", top: 0, zIndex: 1000 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontWeight: "900", backgroundColor: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px" }}>CRITICAL ALERT</div>
            <p style={{ fontWeight: "700", fontSize: "14px" }}>{activeAlert}</p>
          </div>
          <button 
            onClick={() => setActiveAlert(null)}
            style={{ backgroundColor: "#fff", color: "#ba1a1a", border: "none", padding: "8px 20px", borderRadius: "10px", fontWeight: "900", fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
          >
            ACKNOWLEDGE
          </button>
        </div>
      )}

      <aside className="citizen-web-sidebar">
        <div className="citizen-web-sidebar-brand">
          <h1>Citizen Portal</h1>
          <p>Stay Safe, Stay Informed</p>
        </div>
        <nav className="citizen-web-sidebar-nav" aria-label="Citizen sections">
          {sidebarLinks.map((item) => (
            <Link
              key={item.key}
              className={activeSidebarItem === item.key ? "is-active" : undefined}
              href={item.href}
              onClick={() => setActiveSidebarItem(item.key)}
            >
              <span className="citizen-web-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="citizen-web-sidebar-footer">
          <Link className="citizen-web-signout" href="/citizen/login">Sign Out</Link>
        </div>
      </aside>

      <div className="citizen-web-shell">
        <header className="citizen-web-topbar">
          <div className="citizen-web-topbar-inner">
            <div className="citizen-web-topbar-copy">
              <Link className="citizen-web-logo" href="/citizen/beforecalamity">
                Damayan Connect Preparedness Dashboard
              </Link>
            </div>
            <div className="citizen-web-topactions">
              <Link href="/citizen/duringcalamity#broadcast">Alerts</Link>
              <CitizenAvatarChip />
            </div>
          </div>
        </header>

        <main className="citizen-web-main" id="home">
          {/* Registration Type Selection */}
          {!registrationType && !profile && (
            <section style={{ marginBottom: "4rem" }}>
              <div className="registration-main">
                <header className="step-header">
                  <span className="step-indicator">Identity Setup</span>
                  <h3 style={{ fontSize: "2.8rem", fontWeight: "900", margin: 0, letterSpacing: "-0.04em" }}>
                    Public Portal Registration
                  </h3>
                  <p style={{ color: "#586054", fontSize: "1.15rem", marginTop: "1rem", lineHeight: "1.6", maxWidth: "45rem" }}>
                    Secure your digital emergency identity. Select the registration portal that best matches your current residency status.
                  </p>
                </header>

                <div className="field-grid">
                  <button 
                    onClick={() => { setRegistrationType("Individual"); setIsEditing(false); }} 
                    className="registration-card"
                    style={{ 
                      textAlign: "left", 
                      cursor: "pointer", 
                      padding: "3.5rem",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontFamily: "'Poppins', sans-serif"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-8px)";
                      e.currentTarget.style.borderColor = "#0d631b";
                      e.currentTarget.style.boxShadow = "0 30px 60px rgba(13, 99, 27, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(13, 99, 27, 0.08)";
                      e.currentTarget.style.boxShadow = "0 25px 60px rgba(0,0,0,0.04)";
                    }}
                  >
                    <h4 style={{ fontSize: "1.8rem", fontWeight: "900", margin: "0 0 1rem", color: "#1a1c19" }}>Register Myself</h4>
                    <p style={{ color: "#586054", fontSize: "1.1rem", lineHeight: "1.7", fontWeight: "500" }}>
                      Generate an individual QR ID for personal tracking, medical status reporting, and rapid shelter check-in.
                    </p>
                  </button>

                  <button 
                    onClick={() => { setRegistrationType("Household"); setIsEditing(false); }} 
                    className="registration-card"
                    style={{ 
                      textAlign: "left", 
                      cursor: "pointer", 
                      padding: "3.5rem",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontFamily: "'Poppins', sans-serif"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-8px)";
                      e.currentTarget.style.borderColor = "#0d631b";
                      e.currentTarget.style.boxShadow = "0 30px 60px rgba(13, 99, 27, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(13, 99, 27, 0.08)";
                      e.currentTarget.style.boxShadow = "0 25px 60px rgba(0,0,0,0.04)";
                    }}
                  >
                    <h4 style={{ fontSize: "1.8rem", fontWeight: "900", margin: "0 0 1rem", color: "#1a1c19" }}>Register My Family</h4>
                    <p style={{ color: "#586054", fontSize: "1.1rem", lineHeight: "1.7", fontWeight: "500" }}>
                      Input family details to receive a unified household QR code, humanitarian aid clustering, and collective alerts.
                    </p>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Upgraded Multi-Step Registration Flow */}
          {(registrationType === "Individual" || registrationType === "Household") && !registrationSuccess && (
            <div className="registration-container" style={{ marginBottom: "4rem" }}>
              <div className="registration-main">
                
                {/* Step Header */}
                <header className="step-header">
                  <span className="step-indicator">
                    {registrationType === "Individual" 
                      ? "Step 01 of 01 / Personal Identity" 
                      : `Step 0${registrationStep} of 02 / ${registrationStep === 1 ? "Profile" : "Household"}`}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <h3 style={{ fontSize: "2.8rem", fontWeight: "900", margin: 0, letterSpacing: "-0.04em" }}>
                      {registrationStep === 1 ? "Personal Identity Profile" : "Register My Family"}
                    </h3>
                    <button 
                      onClick={() => registrationStep === 1 ? setRegistrationType(null) : setRegistrationStep(1)} 
                      style={{ background: "transparent", border: "none", color: "#586054", fontWeight: "800", cursor: "pointer", fontSize: "1rem" }}
                    >
                      ← Back
                    </button>
                  </div>
                  <p style={{ color: "#586054", fontSize: "1.15rem", marginTop: "1rem", lineHeight: "1.6", maxWidth: "45rem" }}>
                    {registrationStep === 1 
                      ? "Your health and identity are vital for coordinating relief. Please provide accurate details to ensure medical responders have the context they need."
                      : "Provide details for each person currently residing with you. This ensures appropriate aid distribution and medical prioritization."}
                  </p>
                </header>

                {/* STEP 1: PERSONAL IDENTITY (MEDICAL) - SHARED */}
                {registrationStep === 1 && (
                  <div className="registration-card">
                    <div className="field-grid" style={{ marginBottom: "2.5rem" }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="field-label">Full Legal Name</label>
                        <input 
                          type="text" 
                          className="text-input" 
                          placeholder="As shown on official ID" 
                          value={userProfile.fullName}
                          onChange={(e) => setUserProfile({...userProfile, fullName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="field-label">Date of Birth</label>
                        <input 
                          type="date" 
                          className="text-input" 
                          max={getMaxDob(18)}
                          value={userProfile.dob}
                          onChange={(e) => setUserProfile({...userProfile, dob: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="field-label">Gender Identity</label>
                        <div className="chip-group">
                          {["Female", "Male", "Other"].map(g => (
                            <button 
                              key={g} 
                              className={`chip-btn ${userProfile.gender === g ? "is-active" : ""}`}
                              onClick={() => setUserProfile({...userProfile, gender: g})}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #eef1ed", paddingTop: "2.5rem", marginBottom: "2.5rem" }}>
                      <div className="field-grid">
                        <div>
                          <label className="field-label">Critical Blood Type</label>
                          <div className="blood-grid">
                            {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(type => (
                              <button 
                                key={type} 
                                className={`blood-btn ${userProfile.bloodType === type ? "is-active" : ""}`}
                                onClick={() => setUserProfile({...userProfile, bloodType: type})}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="field-label">Conditions & Allergies</label>
                          <textarea 
                            className="text-area" 
                            rows={4} 
                            placeholder="List chronic conditions (e.g. Asthma) or severe allergies..."
                            value={userProfile.conditions}
                            onChange={(e) => setUserProfile({...userProfile, conditions: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "3rem" }}>
                      <input 
                        type="checkbox" 
                        id="consent" 
                        checked={userProfile.consent}
                        onChange={(e) => setUserProfile({...userProfile, consent: e.target.checked})}
                        style={{ width: "20px", height: "20px", cursor: "pointer" }}
                      />
                      <label htmlFor="consent" style={{ color: "#586054", fontSize: "0.95rem", cursor: "pointer" }}>
                        I certify that the information provided is accurate and consent to humanitarian data usage.
                      </label>
                    </div>

                    <button 
                      className="citizen-web-primary-action" 
                      style={{ width: "100%", justifyContent: "center", opacity: userProfile.consent ? 1 : 0.5 }}
                      disabled={!userProfile.consent}
                      onClick={() => {
                        if (registrationType === "Individual") {
                          handleHouseholdSubmit();
                        } else {
                          setRegistrationStep(2);
                        }
                      }}
                    >
                      {registrationType === "Individual" 
                        ? (isEditing ? "Save Changes" : "Complete Registration") 
                        : "Continue to Family Registration"}
                    </button>
                  </div>
                )}

                {/* STEP 2: HOUSEHOLD MEMBERS */}
                {registrationStep === 2 && (
                  <div className="registration-main">
                    {householdMembers.map((member, index) => (
                      <div key={index} className="member-card-v2">
                        <div className="member-card-head">
                          <div className="member-card-id">
                            <div className="member-id-circle">{index + 1}</div>
                            <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800" }}>Family Member</h4>
                          </div>
                          {index > 0 && (
                            <button className="member-remove-btn" onClick={() => handleRemoveMember(index)}>Remove Member</button>
                          )}
                        </div>

                        <div className="field-grid" style={{ marginBottom: "2rem" }}>
                          <div style={{ gridColumn: "span 2" }}>
                            <label className="field-label">Full Legal Name</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              placeholder="e.g. Maria Aristha" 
                              value={member.name}
                              onChange={(e) => handleMemberChange(index, "name", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="field-label">Age</label>
                            <input 
                              type="number" 
                              className="text-input" 
                              placeholder="Years" 
                              min="0"
                              value={member.age}
                              onChange={(e) => handleMemberChange(index, "age", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="field-label">Relationship to Head</label>
                            <div className="chip-group">
                              {["Spouse", "Child", "Parent", "Sibling", "Other"].map(r => (
                                <button 
                                  key={r} 
                                  className={`chip-btn ${member.relationship === r ? "is-active" : ""}`}
                                  onClick={() => handleMemberChange(index, "relationship", r)}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="field-label">Quick Select Accessibility Needs</label>
                          <div className="chip-group">
                            {[
                              {id: "wheelchair", label: "Wheelchair"},
                              {id: "medication", label: "Medication"},
                              {id: "infant", label: "Infant Care"},
                              {id: "elderly", label: "Elderly"}
                            ].map(need => (
                              <button 
                                key={need.id} 
                                className={`chip-btn ${(member.accessibilityNeeds || []).includes(need.id) ? "is-active" : ""}`}
                                onClick={() => toggleAccessibilityNeed(index, need.id)}
                              >
                                {need.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Animal Registration Section */}
                    <div style={{ borderTop: "1px solid #eef1ed", paddingTop: "3rem", marginTop: "1rem", marginBottom: "2rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                        <h4 style={{ fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Animals & Pets</h4>
                        <button 
                          onClick={handleAddAnimal}
                          style={{ background: "transparent", border: "none", color: "#0d631b", fontWeight: "800", cursor: "pointer", fontSize: "0.9rem" }}
                        >
                          + Add Another Animal
                        </button>
                      </div>
                      
                      {animals.map((animal, index) => (
                        <div key={index} className="member-card-v2" style={{ borderLeft: "6px solid #ffba38" }}>
                           <div className="member-card-head">
                             <div className="member-card-id">
                             <div className="member-id-circle" style={{ backgroundColor: "#7e5700", color: "#fff" }}>P</div>
                             <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800" }}>Household Animal</h4>
                             </div>
                             {animals.length > 1 && (
                               <button className="member-remove-btn" onClick={() => handleRemoveAnimal(index)}>Remove Animal</button>
                             )}
                           </div>

                           <div className="field-grid">
                             <div style={{ gridColumn: "span 2" }}>
                               <label className="field-label">Animal Name (Optional)</label>
                               <input 
                                 type="text" 
                                 className="text-input" 
                                 placeholder="e.g. Luna" 
                                 value={animal.name}
                                 onChange={(e) => handleAnimalChange(index, "name", e.target.value)}
                               />
                             </div>
                             <div>
                               <label className="field-label">Species / Type</label>
                               <div className="chip-group">
                                 {["Dog", "Cat", "Bird", "Livestock", "Other"].map(s => (
                                   <button 
                                     key={s} 
                                     className={`chip-btn ${animal.species === s ? "is-active" : ""}`}
                                     style={{ fontSize: "0.8rem" }}
                                     onClick={() => handleAnimalChange(index, "species", s)}
                                   >
                                     {s}
                                   </button>
                                 ))}
                               </div>
                             </div>
                             <div>
                               <label className="field-label">Transport Logistics</label>
                               <div 
                                 className={`chip-btn ${animal.needsCage ? "is-active" : ""}`}
                                 onClick={() => handleAnimalChange(index, "needsCage", !animal.needsCage)}
                                 style={{ width: "fit-content", cursor: "pointer" }}
                               >
                                 {animal.needsCage ? "Container Provided" : "Assistance Required"}
                               </div>
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="action-row-v2">
                      <button 
                        onClick={handleAddMember}
                        style={{ border: "2px dashed #bfcaba", background: "transparent", padding: "1.2rem 2.5rem", borderRadius: "1.5rem", color: "#586054", fontWeight: "800", cursor: "pointer" }}
                      >
                        + Add Another Family Member
                      </button>
                      <button 
                        className="citizen-web-primary-action" 
                        style={{ minWidth: "15rem", justifyContent: "center" }}
                        onClick={handleHouseholdSubmit}
                      >
                        {isEditing ? "Save Changes" : "Complete Registration"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Informational Sidebars */}
              <aside className="info-sidebar">
                <div className="sidebar-box is-accent">
                  <span className="sidebar-box-kicker">Protected Data</span>
                  <h4>Privacy Protocol</h4>
                  <p>Your health and family data is encrypted and only shared with verified humanitarian response organizations during a declared emergency state.</p>
                  <div className="sidebar-box-stat">
                    <strong>Access Scope</strong>
                    <span>Verified responders only</span>
                  </div>
                </div>
                <div className="sidebar-box">
                  <span className="sidebar-box-kicker">Operational Value</span>
                  <h4>Why this matters</h4>
                  <p>Accurate household data helps responders calculate food ratios, specialized transport, and medical supply distribution for your exact sector.</p>
                  <ul className="sidebar-box-list">
                    <li>Faster aid allocation per household size</li>
                    <li>Better medical triage for flagged conditions</li>
                    <li>More accurate transport and shelter planning</li>
                  </ul>
                </div>
                <div className="sidebar-box">
                  <span className="sidebar-box-kicker">Household Mode</span>
                  <h4>Aid Clustering</h4>
                  <p>Registering as a family allows you to receive unified relief packages and stay together if evacuation is triggered.</p>
                  <div className="sidebar-box-tags">
                    <span>Shared QR</span>
                    <span>Linked Alerts</span>
                    <span>Grouped Relief</span>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {registrationSuccess && (
            <section style={{ 
              marginBottom: "3rem", 
              padding: "5rem", 
              backgroundColor: "#eef4ed", 
              borderRadius: "3rem", 
              textAlign: "center"
            }}>
               <div style={{ backgroundColor: "#0d631b", width: "80px", height: "80px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "32px", margin: "0 auto 32px" }}>S</div>
               <h3 style={{ fontSize: "2.5rem", fontWeight: "900", margin: "0 0 1rem" }}>Registration Complete</h3>
               <p style={{ color: "#586054", fontSize: "1.2rem", marginBottom: "3rem" }}>Your Household Identity has been verified and synced with local response stations.</p>
               
               <div style={{ margin: "2rem auto", padding: "3rem", background: "#fff", display: "inline-block", borderRadius: "2.5rem", boxShadow: "0 30px 60px rgba(0,0,0,0.06)" }}>
                  <div style={{ width: "200px", height: "200px", backgroundColor: "#000", position: "relative" }}>
                     <div style={{ position: "absolute", top: "15px", left: "15px", right: "15px", bottom: "15px", border: "10px solid #fff", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: "8px" }}>
                        {[...Array(9)].map((_, i) => <div key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "transparent" }} />)}
                     </div>
                  </div>
                  <p style={{ fontWeight: "900", marginTop: "2rem", fontSize: "1.4rem", letterSpacing: "4px" }}>CLUSTER-DAM-092</p>
               </div>
               <br />
               <button 
                 onClick={() => { setRegistrationSuccess(false); setRegistrationType(null); setRegistrationStep(1); }} 
                 style={{ background: "transparent", border: "none", color: "#0d631b", fontWeight: "8600", cursor: "pointer", marginTop: "2rem", fontSize: "1.1rem" }}
               >
                 Change Registration or Add Group
               </button>
            </section>
          )}

          <section className="citizen-web-hero">
            <div className="citizen-web-hero-media" aria-hidden="true"><div className="citizen-web-hero-overlay" /></div>
            <div className="citizen-web-hero-content">
              <div className="citizen-web-status-pill"><span className="citizen-web-status-dot" /><span>Active Status: Stable</span></div>
              <h2>Low-Risk<br /><span>Condition.</span></h2>
              <p>No immediate environmental threats detected in your primary zone. Current preparedness phase: Maintenance and Education.</p>
              <Link className="citizen-web-primary-action" href="#checklists">Update Plan<span aria-hidden="true">+</span></Link>
            </div>
          </section>

          <section className="citizen-web-editorial">
            <div className="citizen-web-left-column">
              <section className="citizen-web-section-block" id="checklists">
                <div className="citizen-web-section-head">
                  <div><h3>Ready-Check</h3><p>Monthly Preparedness Audit</p></div>
                  <span>01/03</span>
                </div>
                <div className="citizen-web-checklist">
                  {checklist.map((item) => (
                    <article className="citizen-web-checkitem" key={item.title}>
                      <div className={`citizen-web-checkmark ${item.done ? "is-done" : ""}`}>{item.done ? "OK" : ""}</div>
                      <div className="citizen-web-checkcopy"><h4>{item.title}</h4><p>{item.detail}</p></div>
                      <span className={`citizen-web-checkstatus ${item.done ? "is-done" : "is-pending"}`}>{item.status}</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="citizen-web-section-block" id="household">
                <h3 className="citizen-web-simple-head">Household</h3>
                <div className="citizen-web-household-grid">
                  <article className="citizen-web-household-card">
                    <div className="citizen-web-household-icon">GH</div>
                    <div className="citizen-web-household-actions">
                      <button 
                        className="citizen-web-household-card-btn"
                        onClick={() => {
                          setRegistrationType("Household");
                          setIsEditing(true);
                          setRegistrationSuccess(false);
                          setRegistrationStep(1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </button>
                      {!registrationSuccess && (
                        <button 
                          className="citizen-web-household-card-btn is-secondary"
                          onClick={() => {
                            setRegistrationType("Household");
                            setIsEditing(true);
                            setRegistrationSuccess(false);
                            setRegistrationStep(2);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                    <div>
                      <strong>{profile ? (householdMembers.length + 1) : 0} Members</strong>
                      <p>Profile: {profile ? "Active" : "Not Registered"}</p>
                    </div>
                  </article>
                  <article className="citizen-web-household-card">
                    <div className="citizen-web-household-icon is-secondary">PT</div>
                    <div className="citizen-web-household-actions">
                      <button 
                        className="citizen-web-household-card-btn"
                        onClick={() => {
                          setRegistrationType("Household");
                          setIsEditing(true);
                          setRegistrationSuccess(false);
                          setRegistrationStep(2);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        {registrationSuccess ? "Edit" : "Add"}
                      </button>
                    </div>
                    <div>
                      <strong>{profile ? animals.length : 0} Animals</strong>
                      <p>{profile ? "Care Plan Synced" : "Care-plan Required"}</p>
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <div className="citizen-web-right-column">
              <section className="citizen-web-weather-card" id="weather">
                <div className="citizen-web-weather-symbol">SUN</div>
                <div className="citizen-web-weather-top"><span>Atmospheric Status</span></div>
                <div className="citizen-web-weather-main">
                  <div className="citizen-web-weather-temp">24C</div>
                  <div><strong>Partly Cloudy</strong><p>Clear visibility (12km)</p></div>
                </div>
                <div className="citizen-web-weather-stats">
                  <div><span>Wind Velocity</span><strong>12 km/h NW</strong></div>
                  <div><span>Precipitation</span><strong>2% Prob.</strong></div>
                  <div><span>UV Index</span><strong>4 (Moderate)</strong></div>
                </div>
              </section>

              <section className="citizen-web-map-card" id="sector-map">
                <div className="citizen-web-map-label"><span>Current Sector</span><strong>West District, Zone 4</strong></div>
                <div className="citizen-web-map-surface"><div className="citizen-web-map-grid" /></div>
                <Link className="citizen-web-map-route" href="/citizen/duringcalamity">
                  <div><strong>1.2km to Nearest Shelter</strong><p>Route: Clear - 15min Walk</p></div>
                  <span>GO</span>
                </Link>
              </section>
            </div>
          </section>

          <footer className="citizen-web-footer-actions" id="support">
            <Link className="is-primary" href="/citizen/duringcalamity" style={{ textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Open Emergency Portal
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
