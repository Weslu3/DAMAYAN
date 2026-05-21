"use client";

import React, { useState, useRef } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import type { AuthSession, CapacityCenter, CheckInRecord } from "../../../lib/types";
import type { PhaseConfig } from "../utils/siteManagerUtils";
import type { SiteManagerCitizenRecord } from "../../../lib/api";
import {
  getCitizenByQrCode,
  getCheckInByQrCode,
  createManualCheckIn,
  checkOutById,
  getRecentCheckIns,
} from "../../../lib/api";

interface CitizensTabProps {
  phase: "before" | "during" | "after";
  phaseConfig: PhaseConfig;
  session: AuthSession | null;
  checkIns: CheckInRecord[];
  capacityCenters: CapacityCenter[];
  citizenRegistry: SiteManagerCitizenRecord[];
  citizenRegistryLoading: boolean;
  citizenRegistryError: string | null;
  citizenSearchQuery: string;
  onCitizenSearchChange: (query: string) => void;
  onCheckInsRefreshed: (records: CheckInRecord[]) => void;
}

type ScanType = "check-in" | "check-out";

interface ManualCheckInState {
  citizenName: string;
  zone: string;
  groupSize: string;
}

interface CheckOutRecord {
  id: string;
  fullName: string;
  checkInTime?: string;
}

interface ScannedCitizen extends Partial<SiteManagerCitizenRecord> {
  qrCodeId: string;
}

export default function CitizensTab({
  phase,
  phaseConfig,
  session,
  checkIns,
  capacityCenters,
  citizenRegistry,
  citizenRegistryLoading,
  citizenRegistryError,
  citizenSearchQuery,
  onCitizenSearchChange,
  onCheckInsRefreshed,
}: CitizensTabProps) {
  const [checkInMode, setCheckInMode] = useState<"scan" | "manual">("scan");
  const [scanType, setScanType] = useState<ScanType>(phase === "after" ? "check-out" : "check-in");
  const [manualCheckInState, setManualCheckInState] = useState<ManualCheckInState>({
    citizenName: "",
    zone: "",
    groupSize: "",
  });
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [scannedCitizen, setScannedCitizen] = useState<ScannedCitizen | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [checkOutRecord, setCheckOutRecord] = useState<CheckOutRecord | null>(null);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [isSubmittingCheckOut, setIsSubmittingCheckOut] = useState(false);
  const [isScanLookingUp, setIsScanLookingUp] = useState(false);
  const scanLockRef = useRef(false);

  const handleQrScanned = async (results: { rawValue: string }[]) => {
    if (scanLockRef.current || isScanLookingUp) return;
    const raw = results[0]?.rawValue?.trim();
    if (!raw || !session?.accessToken) return;
    const qrCodeId = raw.startsWith("QR-") ? raw.replace("QR-", "") : raw;
    scanLockRef.current = true;
    setIsScanLookingUp(true);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      if (scanType === "check-in") {
        const citizen = await getCitizenByQrCode(session.accessToken, qrCodeId);
        if (!citizen) {
          setCheckInError(`No registered citizen found for QR: ${qrCodeId}`);
          scanLockRef.current = false;
          return;
        }
        setScannedCitizen({ ...citizen, qrCodeId });
        setScanModalOpen(true);
      } else {
        const citizen = await getCitizenByQrCode(session.accessToken, qrCodeId);
        const record = await getCheckInByQrCode(session.accessToken, qrCodeId);
        if (!record) {
          setCheckInError(`No active check-in found for QR: ${qrCodeId}`);
          scanLockRef.current = false;
          return;
        }
        const fullName = citizen
          ? (citizen.fullName || `${citizen.firstName ?? ""} ${citizen.lastName ?? ""}`.trim())
          : `${record.firstName} ${record.lastName}`.trim();
        setCheckOutRecord({ id: record.id, fullName, checkInTime: record.checkInTime });
        setCheckOutModalOpen(true);
      }
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Failed to look up citizen.");
      scanLockRef.current = false;
    } finally {
      setIsScanLookingUp(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!session?.accessToken || !checkOutRecord) return;
    setIsSubmittingCheckOut(true);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      await checkOutById(session.accessToken, checkOutRecord.id);
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      onCheckInsRefreshed(freshCheckIns);
      setCheckOutModalOpen(false);
      setCheckOutRecord(null);
      setCheckInSuccess(`Checked out ${checkOutRecord.fullName} successfully.`);
      scanLockRef.current = false;
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Check-out failed.");
    } finally {
      setIsSubmittingCheckOut(false);
    }
  };

  const handleConfirmScannedCheckIn = async () => {
    if (!session?.accessToken || !scannedCitizen) return;
    if (!selectedCenterId) {
      setCheckInError("Please select an evacuation center.");
      return;
    }
    setIsSubmittingCheckIn(true);
    setCheckInSuccess(null);
    try {
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: scannedCitizen.qrCodeId || "",
        firstName: scannedCitizen.firstName || scannedCitizen.fullName?.split(" ")[0] || "",
        location: "Site Manager Desktop Check-in",
        centerId: selectedCenterId,
        familySize: scannedCitizen.familySize,
      });
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      onCheckInsRefreshed(freshCheckIns);
      setScanModalOpen(false);
      setScannedCitizen(null);
      scanLockRef.current = false;
      setCheckInError(null);
      setCheckInSuccess(`Checked in ${scannedCitizen.fullName || scannedCitizen.qrCodeId} successfully.`);
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleSubmitManualCheckIn = async () => {
    if (!session?.accessToken) {
      setCheckInError("Session expired. Please login again.");
      return;
    }
    if (!manualCheckInState.citizenName.trim()) {
      setCheckInError("Please enter citizen name or ID.");
      return;
    }
    setIsSubmittingCheckIn(true);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: manualCheckInState.citizenName,
        firstName: manualCheckInState.citizenName.split(" ")[0] || "",
        zone: manualCheckInState.zone || "",
        location: "Site Manager Check-in",
        familySize:
          Number(manualCheckInState.groupSize) > 0 ? Number(manualCheckInState.groupSize) : undefined,
      });
      setManualCheckInState({ citizenName: "", zone: "", groupSize: "" });
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      onCheckInsRefreshed(freshCheckIns);
      setCheckInSuccess("Check-in recorded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit check-in";
      setCheckInError(message);
      console.error("Check-in error:", error);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleSubmitManualCheckOut = async () => {
    if (!session?.accessToken) {
      setCheckInError("Session expired. Please login again.");
      return;
    }
    const inputVal = manualCheckInState.citizenName.trim();
    if (!inputVal) {
      setCheckInError("Please enter citizen ID or QR code.");
      return;
    }
    setIsSubmittingCheckIn(true);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      const qrCodeId = inputVal.startsWith("QR-") ? inputVal.replace("QR-", "") : inputVal;
      const record = await getCheckInByQrCode(session.accessToken, qrCodeId);
      if (!record) {
        setCheckInError(`No active check-in found for ID/QR: ${qrCodeId}`);
        return;
      }
      await checkOutById(session.accessToken, record.id);
      setManualCheckInState({ citizenName: "", zone: "", groupSize: "" });
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      onCheckInsRefreshed(freshCheckIns);
      setCheckInSuccess("Citizen checked out successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit check-out";
      setCheckInError(message);
      console.error("Check-out error:", error);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
          <div className="mb-6">
            <h3 className="text-2xl font-black">Citizen Check-In/Out</h3>
            <p className="text-sm text-[#444743] dark:text-[#c4c7c0]">
              {scanType === "check-out"
                ? "QR scanner and manual entry for citizen check-out."
                : "QR scanner and manual entry for citizen check-in."}
            </p>
          </div>

          <div className="w-full space-y-3 mb-4">
            <div className="flex gap-2 bg-[#dadad5] dark:bg-[#3b3b3b] p-1 rounded-lg">
              <button
                onClick={() => { setScanType("check-in"); setCheckInError(null); scanLockRef.current = false; }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${scanType === "check-in" ? "bg-white dark:bg-[#1a1c19] shadow-sm" : "text-[#444743] dark:text-[#c4c7c0]"}`}
              >
                Check-In
              </button>
              <button
                onClick={() => { setScanType("check-out"); setCheckInError(null); scanLockRef.current = false; }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${scanType === "check-out" ? "bg-white dark:bg-[#1a1c19] shadow-sm" : "text-[#444743] dark:text-[#c4c7c0]"}`}
              >
                Check-Out
              </button>
            </div>

            <div className="flex gap-2 bg-[#dadad5] dark:bg-[#3b3b3b] p-1 rounded-lg">
              <button
                onClick={() => { setCheckInMode("scan"); setCheckInError(null); scanLockRef.current = false; }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "scan" ? "bg-white dark:bg-[#1a1c19] shadow-sm" : "text-[#444743] dark:text-[#c4c7c0]"}`}
              >
                Scan QR
              </button>
              <button
                onClick={() => { setCheckInMode("manual"); setCheckInError(null); scanLockRef.current = false; }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "manual" ? "bg-white dark:bg-[#1a1c19] shadow-sm" : "text-[#444743] dark:text-[#c4c7c0]"}`}
              >
                Manual ID
              </button>
            </div>

            {checkInMode === "scan" ? (
              <div className="w-full max-w-[360px] mx-auto aspect-square rounded-xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-[#dadad5] dark:border-[#3b3b3b]">
                {isScanLookingUp ? (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <span className="text-white text-sm font-bold animate-pulse">Looking up citizen...</span>
                  </div>
                ) : (
                  <Scanner
                    onScan={handleQrScanned}
                    onError={() => setCheckInError("Camera error. Check browser permissions.")}
                    styles={{ container: { width: "100%", height: "100%" } }}
                  />
                )}
              </div>
            ) : scanType === "check-out" ? (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-300 w-full overflow-hidden">
                <input
                  className="w-full bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-sm"
                  placeholder="Citizen ID or QR Code..."
                  type="text"
                  value={manualCheckInState.citizenName}
                  onChange={(e) => setManualCheckInState({ ...manualCheckInState, citizenName: e.target.value })}
                />
                <button
                  onClick={handleSubmitManualCheckOut}
                  disabled={isSubmittingCheckIn}
                  className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                  style={{ background: phaseConfig.primaryColor }}
                >
                  {isSubmittingCheckIn ? "Processing..." : "Confirm Manual Check-Out"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-300 w-full overflow-hidden">
                <input
                  className="w-full bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-sm"
                  placeholder="Citizen Name or ID..."
                  type="text"
                  value={manualCheckInState.citizenName}
                  onChange={(e) => setManualCheckInState({ ...manualCheckInState, citizenName: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="w-full bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-sm"
                    placeholder="Zone"
                    type="text"
                    value={manualCheckInState.zone}
                    onChange={(e) => setManualCheckInState({ ...manualCheckInState, zone: e.target.value })}
                  />
                  <input
                    className="w-full bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-sm"
                    placeholder="Group Size"
                    type="number"
                    min="0"
                    value={manualCheckInState.groupSize}
                    onChange={(e) => setManualCheckInState({ ...manualCheckInState, groupSize: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleSubmitManualCheckIn}
                  disabled={isSubmittingCheckIn}
                  className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                  style={{ background: phaseConfig.primaryColor }}
                >
                  {isSubmittingCheckIn ? "Processing..." : "Confirm Manual Check-In"}
                </button>
              </div>
            )}
          </div>

          {checkInError && <p className="text-red-600 text-sm">{checkInError}</p>}
          {checkInSuccess && <p className="text-green-700 dark:text-green-400 text-sm font-medium">{checkInSuccess}</p>}

          <div className="mt-6 pt-5 border-t border-[#dadad5] dark:border-[#3b3b3b]">
            <h4 className="text-sm font-black uppercase tracking-wider mb-3">
              {scanType === "check-out" ? "Recent Check-Out Activity" : "Recent Check-In Activity"}
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {checkIns.slice(0, 8).map((record) => (
                <div key={record.id} className="p-3 rounded-xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                  <p className="font-bold text-sm">{record.firstName || "Citizen"} {record.lastName || ""}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#707a6c]">{record.evacueeNumber || "No QR"}</p>
                </div>
              ))}
              {checkIns.length === 0 && (
                <p className="text-sm text-[#707a6c]">
                  {scanType === "check-out" ? "No recent check-outs yet." : "No recent check-ins yet."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h3 className="text-2xl font-black">Citizen Registry</h3>
              <p className="text-sm text-[#444743] dark:text-[#c4c7c0]">Backend-powered list of citizens visible to site manager.</p>
            </div>
            <input
              value={citizenSearchQuery}
              onChange={(e) => onCitizenSearchChange(e.target.value)}
              placeholder="Search name, QR, or ID"
              className="w-full sm:w-64 bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-2 text-sm"
            />
          </div>

          {citizenRegistryError && <p className="text-red-600 text-sm mb-3">{citizenRegistryError}</p>}

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {citizenRegistryLoading && (
              <p className="text-sm text-[#707a6c]">Loading citizens...</p>
            )}

            {!citizenRegistryLoading && citizenRegistry.map((citizen) => {
              const fullName = citizen.fullName || `${citizen.firstName ?? ""} ${citizen.lastName ?? ""}`.trim() || "Unnamed Citizen";
              return (
                <div key={citizen.id} className="p-4 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sm">{fullName}</p>
                      <p className="text-[10px] uppercase tracking-widest text-[#707a6c]">QR: {citizen.qrCodeId || "N/A"}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-[#e8f5e9] text-[#2E7D32]">
                      {(citizen.registrationType || "registered").replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#444743] dark:text-[#c4c7c0] flex gap-3">
                    <span>Family: {citizen.familySize ?? 1}</span>
                    <span>ID: {citizen.id}</span>
                  </div>
                </div>
              );
            })}

            {!citizenRegistryLoading && citizenRegistry.length === 0 && (
              <p className="text-sm text-[#707a6c]">No citizens found for your current search.</p>
            )}
          </div>
        </section>
      </div>

      {/* QR Scan Citizen Confirmation Modal */}
      {scanModalOpen && scannedCitizen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close scan confirmation"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm cursor-default border-none outline-none focus:outline-none"
            onClick={() => { setScanModalOpen(false); scanLockRef.current = false; }}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 z-10 animate-in zoom-in-95 duration-200">
            <p className="text-[10px] font-black tracking-widest text-[#FFB300] uppercase mb-4">Check-In Confirmation</p>
            <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl mb-6">
              <div className="w-14 h-14 rounded-full bg-[#FFB300] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                {(scannedCitizen.fullName || `${scannedCitizen.firstName ?? ""} ${scannedCitizen.lastName ?? ""}`.trim())
                  .split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-black text-lg leading-tight">
                  {scannedCitizen.fullName || `${scannedCitizen.firstName ?? ""} ${scannedCitizen.lastName ?? ""}`.trim() || "Unknown"}
                </p>
                <p className="text-xs text-gray-500 mt-1">QR: {scannedCitizen.qrCodeId}</p>
                {scannedCitizen.registrationType && (
                  <p className="text-[11px] font-bold text-[#FFB300] mt-1">{scannedCitizen.registrationType.toUpperCase()}</p>
                )}
                {!!scannedCitizen.familySize && (
                  <p className="text-xs text-gray-500">Family size: {scannedCitizen.familySize}</p>
                )}
              </div>
            </div>
            <div className="mb-5">
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-2">Evacuation Center</p>
              <select
                value={selectedCenterId}
                onChange={(e) => { setSelectedCenterId(e.target.value); setCheckInError(null); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#FFB300]"
              >
                <option value="">Select a center...</option>
                {capacityCenters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {checkInError && <p className="text-red-600 text-sm mb-4">{checkInError}</p>}
            <button
              onClick={handleConfirmScannedCheckIn}
              disabled={isSubmittingCheckIn}
              className="w-full py-4 rounded-2xl font-black text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: "#FFB300" }}
            >
              {isSubmittingCheckIn ? "Checking in..." : "Confirm Check-In"}
            </button>
            <button
              onClick={() => { setScanModalOpen(false); setScannedCitizen(null); scanLockRef.current = false; setCheckInError(null); }}
              className="w-full py-3 mt-2 text-sm font-bold text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Check-Out Confirmation Modal */}
      {checkOutModalOpen && checkOutRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close check out confirmation"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm cursor-default border-none outline-none focus:outline-none"
            onClick={() => { setCheckOutModalOpen(false); scanLockRef.current = false; }}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 z-10 animate-in zoom-in-95 duration-200">
            <p className="text-[10px] font-black tracking-widest text-[#2E7D32] uppercase mb-4">Check-Out Confirmation</p>
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl mb-6">
              <div className="w-14 h-14 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                {checkOutRecord.fullName.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-black text-lg leading-tight">{checkOutRecord.fullName}</p>
                {checkOutRecord.checkInTime && (
                  <p className="text-xs text-gray-500 mt-1">
                    Checked in: {new Date(checkOutRecord.checkInTime).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {checkInError && <p className="text-red-600 text-sm mb-4">{checkInError}</p>}
            <button
              onClick={handleConfirmCheckOut}
              disabled={isSubmittingCheckOut}
              className="w-full py-4 rounded-2xl font-black text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: "#4CAF50" }}
            >
              {isSubmittingCheckOut ? "Checking out..." : "Confirm Check-Out"}
            </button>
            <button
              onClick={() => { setCheckOutModalOpen(false); setCheckOutRecord(null); scanLockRef.current = false; setCheckInError(null); }}
              className="w-full py-3 mt-2 text-sm font-bold text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
