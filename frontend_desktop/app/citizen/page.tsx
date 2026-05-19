"use client";

import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { loadSession, clearSession } from "../lib/session";
import { getCitizenProfile, getFileViewUrl } from "../lib/api";
import type { AuthSession } from "../lib/types";
import type { CitizenProfile } from "../lib/api";

export default function CitizenPortalPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) { window.location.href = "/login"; return; }
    setSession(stored);
    getCitizenProfile(stored.accessToken)
      .then(async (data) => {
        setProfile(data);
        if (data.profilePhotoKey) {
          try {
            const url = await getFileViewUrl(stored.accessToken, "government-ids", data.profilePhotoKey);
            setProfilePhotoUrl(url);
          } catch { /* photo unavailable, use initials */ }
        }
      })
      .catch(() => setError("Could not load your profile. You may not be registered as a citizen yet."))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = "/login";
  };

  const displayName = profile?.fullName
    || (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null)
    || session?.user?.name
    || session?.user?.email
    || "Citizen";

  const initials = displayName
    .split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4ef] flex items-center justify-center">
        <div className="text-[#444743] text-sm font-bold animate-pulse">Loading your portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4ef] flex flex-col items-center justify-start py-12 px-4">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-black tracking-widest text-[#888] uppercase">Damayan</p>
          <p className="text-[10px] font-bold text-[#888]">Citizen Portal</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-[#444743] border border-[#dadad5] rounded-xl px-4 py-2 hover:bg-white transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Profile Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-[#e8e8e3] p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-[#FFB300]"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#FFB300] flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-[#1A1C1A] leading-tight">{displayName}</h1>
            <p className="text-sm text-[#888] mt-0.5">{session?.user?.email}</p>
            {profile?.registrationType && (
              <span className="inline-block mt-1 text-[10px] font-black tracking-widest text-[#FFB300] uppercase">
                {profile.registrationType}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {profile?.birthDate && (
            <div>
              <p className="text-[10px] font-black text-[#888] uppercase tracking-wider mb-1">Date of Birth</p>
              <p className="font-bold text-[#1A1C1A]">{new Date(profile.birthDate).toLocaleDateString()}</p>
            </div>
          )}
          {profile?.gender && (
            <div>
              <p className="text-[10px] font-black text-[#888] uppercase tracking-wider mb-1">Gender</p>
              <p className="font-bold text-[#1A1C1A]">{profile.gender}</p>
            </div>
          )}
          {profile?.bloodType && (
            <div>
              <p className="text-[10px] font-black text-[#888] uppercase tracking-wider mb-1">Blood Type</p>
              <p className="font-bold text-[#1A1C1A]">{profile.bloodType}</p>
            </div>
          )}
          {profile?.medicalConditions && (
            <div className="col-span-2">
              <p className="text-[10px] font-black text-[#888] uppercase tracking-wider mb-1">Medical Conditions</p>
              <p className="font-bold text-[#1A1C1A]">{profile.medicalConditions}</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-[#e8e8e3] p-8">
        <p className="text-[10px] font-black tracking-widest text-[#888] uppercase mb-6">Your Evacuation QR Code</p>

        {profile?.qrCodeId ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl border-2 border-[#f0f0eb]">
              <QRCode value={profile.qrCodeId} size={200} />
            </div>
            <p className="text-xs font-bold text-[#888] tracking-wider">{profile.qrCodeId}</p>
            <p className="text-xs text-[#aaa] text-center max-w-xs">
              Show this QR code to site managers for check-in and check-out at evacuation centers.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-[#f4f4ef] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M17 17h3M14 20h3"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-[#888]">No QR code yet</p>
            <p className="text-xs text-[#aaa] text-center">
              {error || "Complete your citizen registration in the mobile app to get your QR code."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
