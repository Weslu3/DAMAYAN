"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AuthSession } from "../../lib/types";
import { saveSession } from "../../lib/session";
import CustomSelect from "./CustomSelect";

function formatAssignedZone(user?: AuthSession["user"] | null): string {
  const parts = [user?.barangay, user?.municipality, user?.province]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "No assigned location";
}

// Client-safe Portal component to bypass parent stacking contexts
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return mounted ? createPortal(children, document.body) : null;
}

interface SiteManagerProfilePageProps {
  onBack: () => void;
  primaryColor: string;
  session: AuthSession | null;
  onSessionUpdated?: (session: AuthSession) => void;
}

export default function SiteManagerProfilePage({ onBack, primaryColor, session, onSessionUpdated }: SiteManagerProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Change Password States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) {
      setPasswordError("Session expired. Please login again.");
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const { updateProfile } = await import("../../lib/api");
      
      await updateProfile(session.accessToken, {
        password: newPassword,
      });

      setPasswordSuccess("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  // Profile Data including new User Story requirements
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    geographicZone: "No assigned location",
    employeeId: "SM-CV-2026-04",
    isOnDuty: true,
    receiveZoneAlerts: true,
  });

  const [fieldTeams, setFieldTeams] = useState<{ id: number; name: string; role: string }[]>([]);

  // Load profile data on mount
  useEffect(() => {
    if (session?.user) {
      setProfileData(prev => ({
        ...prev,
        firstName: session.user.firstName || "",
        lastName: session.user.lastName || "",
        fullName: session.user.name || "",
        email: session.user.email || "",
        phone: session.user.phone || "",
        geographicZone: formatAssignedZone(session.user),
      }));
    }
  }, [session]);

  const handleSave = async () => {
    if (!session?.accessToken) {
      setError("Session expired. Please login again.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { updateProfile } = await import("../../lib/api");
      
      const updated = await updateProfile(session.accessToken, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
      });

      const nextSession: AuthSession = {
        ...session,
        user: updated.user,
      };

      saveSession(nextSession);
      onSessionUpdated?.(nextSession);

      setProfileData((current) => ({
        ...current,
        firstName: updated.user.firstName || "",
        lastName: updated.user.lastName || "",
        fullName: updated.user.name || "",
        email: updated.user.email || "",
        phone: updated.user.phone || "",
      }));

      setIsEditing(false);
      setSuccess("Profile updated successfully. Assigned location stays synced with your account record.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      setSuccess(null);
      console.error("Profile update error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = (id: number, newRole: string) => {
    setFieldTeams(teams => teams.map(t => t.id === id ? { ...t, role: newRole } : t));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto space-y-10 py-6">
      <div className="flex justify-between items-end">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#444743] dark:text-[#c4c7c0] text-sm font-bold mb-8 hover:text-[#1a1c19] dark:hover:text-white transition-colors group">
            <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black tracking-tight text-[#1a1c19] dark:text-white">Manager Profile</h2>
            <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${profileData.isOnDuty ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${profileData.isOnDuty ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {profileData.isOnDuty ? 'On-Duty' : 'Off-Duty'}
            </div>
          </div>
          <p className="text-[#444743] dark:text-[#c4c7c0] font-medium mt-3 text-lg opacity-80">Manage your operational credentials and permissions.</p>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => {
              setSuccess(null);
              setIsEditing(true);
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-colors"
            style={{ color: primaryColor, backgroundColor: primaryColor + "15" }}
          >
            <span className="material-symbols-outlined text-xl">edit</span>
            Edit Details
          </button>
        ) : (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest text-white shadow-lg transition-colors hover:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-2xl text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
        </div>
      )}

      {/* Premium Hero Banner */}
      <div className="relative bg-white dark:bg-[#232622] rounded-[2.5rem] p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm overflow-hidden">
        <div className="absolute inset-0 h-28 rounded-t-[2.5rem]" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-6 pt-10">
          <div className="w-24 h-24 rounded-3xl bg-white dark:bg-[#1a1c19] border-4 border-white dark:border-[#232622] shadow-xl flex items-center justify-center font-black text-3xl" style={{ color: primaryColor }}>
            {(profileData.firstName?.[0] || "S").toUpperCase()}{(profileData.lastName?.[0] || "M").toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-black text-[#1a1c19] dark:text-white">{profileData.fullName || `${profileData.firstName} ${profileData.lastName}` || "Site Manager"}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#f4f4ef] dark:bg-[#1a1c19] text-[#444743] dark:text-[#a0a39f] border border-[#dadad5] dark:border-[#3b3b3b]">ID: {profileData.employeeId}</span>
              <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider" style={{ background: primaryColor + "15", color: primaryColor }}>Site Manager</span>
              <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{profileData.geographicZone}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-[#f4f4ef] dark:bg-[#1a1c19] rounded-2xl p-4 text-center min-w-[80px] border border-[#dadad5] dark:border-[#3b3b3b]">
              <p className="text-xl font-black" style={{ color: primaryColor }}>{fieldTeams.length}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[#707a6c] mt-0.5">Team</p>
            </div>
            <div className="bg-[#f4f4ef] dark:bg-[#1a1c19] rounded-2xl p-4 text-center min-w-[80px] border border-[#dadad5] dark:border-[#3b3b3b]">
              <p className="text-xl font-black text-green-600">3</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[#707a6c] mt-0.5">Certs</p>
            </div>
            <div className="bg-[#f4f4ef] dark:bg-[#1a1c19] rounded-2xl p-4 text-center min-w-[80px] border border-[#dadad5] dark:border-[#3b3b3b]">
              <p className="text-xl font-black text-blue-600">12</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[#707a6c] mt-0.5">Ops</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-10 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm space-y-12">
        
        {/* Operational Information */}
        <div>
          <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
            <span className="material-symbols-outlined" style={{ color: primaryColor }}>badge</span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Operational Credentials</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">First Name</span>
              <input 
                value={profileData.firstName}
                onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Last Name</span>
              <input 
                value={profileData.lastName}
                onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Email Address</span>
              <input 
                value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Mobile Number</span>
              <input 
                value={profileData.phone}
                onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
          </div>
        </div>

        {/* Site Management Settings */}
        <div>
          <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
            <span className="material-symbols-outlined" style={{ color: primaryColor }}>my_location</span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Site Management Settings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Assigned Geographic Zone</span>
              <div className="rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-lg mt-0.5" style={{ color: primaryColor }}>location_on</span>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-[#1a1c19] dark:text-white break-words">{profileData.geographicZone}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#707a6c] mt-1">
                      {session?.user?.barangay ? "Barangay scope" : session?.user?.municipality ? "Municipality scope" : "Account assignment"}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#5f6b5e] mt-2 ml-1">This location comes from the same account assignment used by admin, dispatcher, and site manager views.</p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d]">
                <div>
                  <h4 className="font-bold text-sm text-[#1a1c19] dark:text-white">Active "On-Duty" Status</h4>
                  <p className="text-xs text-[#5f6b5e] mt-1">Allow dispatchers to assign tasks instantly.</p>
                </div>
                <button 
                  onClick={() => setProfileData({...profileData, isOnDuty: !profileData.isOnDuty})}
                  className={`relative w-14 h-8 rounded-full transition-colors ${profileData.isOnDuty ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${profileData.isOnDuty ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d]">
                <div>
                  <h4 className="font-bold text-sm text-[#1a1c19] dark:text-white">Zone Change Alerts</h4>
                  <p className="text-xs text-[#5f6b5e] mt-1">Receive notifications when your zone updates.</p>
                </div>
                <button 
                  onClick={() => setProfileData({...profileData, receiveZoneAlerts: !profileData.receiveZoneAlerts})}
                  className={`relative w-14 h-8 rounded-full transition-colors ${profileData.receiveZoneAlerts ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${profileData.receiveZoneAlerts ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Role-Based Access Management */}
        <div>
          <div className="flex items-center justify-between mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: primaryColor }}>admin_panel_settings</span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Field Team Access</h3>
            </div>
            <span className="text-xs font-bold text-[#5f6b5e] bg-[#f4f4ef] dark:bg-[#2e312d] px-3 py-1 rounded-full">Assign Roles</span>
          </div>
          
          <div className="space-y-4">
            {fieldTeams.length > 0 ? fieldTeams.map((team) => (
              <div key={team.id} className="flex items-center justify-between p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] bg-[#fdfefd] dark:bg-[#2a2d29] hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">
                    {team.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a1c19] dark:text-white">{team.name}</h4>
                    <p className="text-xs text-[#5f6b5e]">Field Team Member</p>
                  </div>
                </div>
                <div>
                  <CustomSelect
                    value={team.role}
                    onChange={(val: any) => handleRoleChange(team.id, val)}
                    disabled={!isEditing}
                    options={[
                      { value: "Medical Responder", label: "Medical Responder" },
                      { value: "Logistics Coordinator", label: "Logistics Coordinator" },
                      { value: "Security Officer", label: "Security Officer" },
                      { value: "Shelter Assistant", label: "Shelter Assistant" },
                    ]}
                    placeholder="Select Role"
                  />
                </div>
              </div>
            )) : (
              <div className="p-5 rounded-2xl border border-dashed border-[#dadad5] dark:border-[#3b3b3b] bg-[#fdfefd] dark:bg-[#2a2d29] text-center">
                <p className="font-bold text-[#1a1c19] dark:text-white">No field team records available</p>
                <p className="text-xs text-[#5f6b5e] mt-1">This section will populate once team assignments are loaded from the database.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-[#5f6b5e] mt-4 ml-1">Assigning specific roles ensures field teams perform tasks securely within their designated scope.</p>
        </div>

      </div>

      {/* Security & Access Card */}
      <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-10 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm space-y-8">
        <div className="flex items-center gap-3 mb-2 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
          <span className="material-symbols-outlined" style={{ color: primaryColor }}>shield_lock</span>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Security & Access Control</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] bg-[#fdfefd] dark:bg-[#2a2d29] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center"><span className="material-symbols-outlined text-green-600">lock</span></div>
              <div>
                <h4 className="font-bold text-sm text-[#1a1c19] dark:text-white">Password</h4>
                <p className="text-[10px] text-[#5f6b5e]">Last changed 14 days ago</p>
              </div>
            </div>
            <button className="w-full py-2.5 rounded-xl border border-[#dadad5] dark:border-[#3b3b3b] text-xs font-black uppercase tracking-wider hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all text-[#1a1c19] dark:text-white" onClick={() => setIsPasswordModalOpen(true)}>Change Password</button>
          </div>
          <div className="p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] bg-[#fdfefd] dark:bg-[#2a2d29] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center"><span className="material-symbols-outlined text-blue-600">smartphone</span></div>
              <div>
                <h4 className="font-bold text-sm text-[#1a1c19] dark:text-white">Two-Factor Auth</h4>
                <p className="text-[10px] text-[#5f6b5e]">SMS verification enabled</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span> Active</span>
              <button className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:underline">Configure</button>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 mt-0.5">info</span>
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Active Session</p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Windows Desktop &bull; Chrome &bull; Last active: Just now &bull; IP: 192.168.1.xx</p>
          </div>
        </div>
      </div>

      {/* Recent Activity & Emergency Contact Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
            <span className="material-symbols-outlined" style={{ color: primaryColor }}>history</span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Recent Activity</h3>
          </div>
          <div className="space-y-4">
            {[
              { icon: "login", text: "Logged in from desktop", time: "2 min ago", color: "#2E7D32" },
              { icon: "edit_document", text: "Updated inventory batch #WB-4421", time: "1h ago", color: "#81C784" },
              { icon: "person_add", text: "Checked in evacuee family (4 pax)", time: "3h ago", color: "#FFB300" },
              { icon: "assignment_turned_in", text: "Submitted site damage assessment", time: "Yesterday", color: "#2E7D32" },
              { icon: "download", text: "Exported auditing CSV report", time: "2 days ago", color: "#FFB300" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: item.color + "15" }}>
                  <span className="material-symbols-outlined text-sm" style={{ color: item.color }}>{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1a1c19] dark:text-white truncate">{item.text}</p>
                  <p className="text-[10px] text-[#707a6c]">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contact & Certifications */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
              <span className="material-symbols-outlined text-red-500">emergency</span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Account Contact</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <p className="font-bold text-sm text-[#1a1c19] dark:text-white">{profileData.fullName || "Account holder"}</p>
                  <p className="text-xs text-[#707a6c]">{profileData.phone || "No phone number on file"}</p>
                </div>
                <span className="material-symbols-outlined text-[#707a6c]">call</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
              <span className="material-symbols-outlined" style={{ color: primaryColor }}>workspace_premium</span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Certifications</h3>
            </div>
            <div className="space-y-3">
              {[
                { name: "Disaster Risk Reduction Management", date: "Valid until Dec 2026", color: "#2E7D32" },
                { name: "Basic First Aid & CPR", date: "Valid until Aug 2026", color: "#81C784" },
                { name: "Incident Command System (ICS)", date: "Valid until Mar 2027", color: "#FFB300" },
              ].map((cert, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cert.color + "15" }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: cert.color }}>verified</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1a1c19] dark:text-white">{cert.name}</p>
                    <p className="text-[10px] text-[#707a6c]">{cert.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#f4f4ef] dark:bg-[#232622] rounded-[2.5rem] p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-300 relative text-left">
              <button 
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPasswordError(null);
                  setPasswordSuccess(null);
                }}
                className="absolute right-6 top-6 w-10 h-10 rounded-full bg-white/20 dark:bg-white/5 flex items-center justify-center text-[#707a6c] hover:text-[#1a1c19] dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center" style={{ color: primaryColor }}>
                  <span className="material-symbols-outlined text-2xl">shield_lock</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1a1c19] dark:text-white">Change Credentials</h3>
                  <p className="text-xs text-[#707a6c]">Update your login credentials securely.</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl text-green-700 dark:text-green-400 text-xs font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {passwordSuccess}
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#707a6c] ml-1">New Password</span>
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#fcfdfc] dark:bg-[#1a1c19] border-2 border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-green-600 transition-colors"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#707a6c] ml-1">Confirm Password</span>
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#fcfdfc] dark:bg-[#1a1c19] border-2 border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-green-600 transition-colors"
                    placeholder="Repeat new password"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    className="flex-1 py-3.5 rounded-xl border border-[#dadad5] dark:border-[#3b3b3b] text-xs font-black uppercase tracking-wider hover:bg-white/20 dark:hover:bg-white/5 transition-all text-[#1a1c19] dark:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex-1 py-3.5 rounded-xl text-white font-black uppercase tracking-wider text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60"
                    style={{ background: primaryColor }}
                  >
                    {isChangingPassword ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
