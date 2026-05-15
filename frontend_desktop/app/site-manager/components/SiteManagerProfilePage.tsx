"use client";
import React, { useState, useEffect } from "react";
import type { AuthSession } from "../../lib/types";
import { saveSession } from "../../lib/session";

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
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    cluster: "Central Visayas Cluster", // From assignment, typically not editable
    employeeId: "SM-CV-2026-04", // From auth system
  });

  // Load profile data on mount
  useEffect(() => {
    if (session?.user) {
      setProfileData({
        firstName: session.user.firstName || "",
        lastName: session.user.lastName || "",
        fullName: session.user.name || "",
        email: session.user.email || "",
        phone: session.user.phone || "",
        cluster: "Central Visayas Cluster",
        employeeId: "SM-CV-2026-04",
      });
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
      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      setSuccess(null);
      console.error("Profile update error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl space-y-10 py-6">
      <div className="flex justify-between items-end">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#444743] dark:text-[#c4c7c0] text-sm font-bold mb-8 hover:text-[#1a1c19] dark:hover:text-white transition-colors group">
            <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span> Back to Dashboard
          </button>
          <h2 className="text-4xl font-black tracking-tight text-[#1a1c19] dark:text-white">Manager Profile</h2>
          <p className="text-[#444743] dark:text-[#c4c7c0] font-medium mt-3 text-lg opacity-80">Manage your operational credentials and contact information.</p>
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
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-2xl text-green-700 dark:text-green-400 text-sm">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-[#232622] rounded-[2.5rem] p-10 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm space-y-10">
        
        {/* Operational Information */}
        <div>
          <div className="flex items-center gap-3 mb-6 border-b border-[#dadad5] dark:border-[#3b3b3b] pb-4">
            <span className="material-symbols-outlined" style={{ color: primaryColor }}>badge</span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444743] dark:text-[#a0a39f]">Operational Credentials</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">First Name</label>
              <input 
                value={profileData.firstName}
                onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Last Name</label>
              <input 
                value={profileData.lastName}
                onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Assigned Cluster</label>
              <input 
                value={profileData.cluster}
                disabled={true}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors opacity-50 cursor-not-allowed" 
                title="Cluster assignment cannot be changed manually."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Employee ID</label>
              <input 
                value={profileData.employeeId}
                disabled={true}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors opacity-50 cursor-not-allowed" 
                title="Employee ID cannot be changed."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Email Address</label>
              <input 
                value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                disabled={!isEditing}
                className="w-full px-6 py-4 rounded-2xl border-2 border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef] dark:bg-[#2e312d] text-[#1a1c19] dark:text-white font-bold focus:outline-none transition-colors disabled:opacity-70 disabled:bg-transparent" 
                style={{ outlineColor: primaryColor } as any}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444743] dark:text-[#c4c7c0] ml-1">Mobile Number</label>
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

        {/* Note */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-2xl">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <strong>Note:</strong> Cluster assignment and Employee ID are managed by the Damayan administration. Contact your regional coordinator to update these fields.
          </p>
        </div>

      </div>
    </div>
  );
}
