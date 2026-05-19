"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SiteManagerProfilePage from "./SiteManagerProfilePage";
import SiteManagerRegionalMap from "./SiteManagerRegionalMap";
import CustomSelect from "./CustomSelect";
import { clearSession, hasRole, loadSession } from "../../lib/session";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  getDashboard,
  getLatestAfterActionAssessment,
  getCapacity,
  getDisasterEvents,
  getIncidentReports,
  getInventory,
  getRecentCheckIns,
  upsertAfterActionAssessment,
  getCitizenByQrCode,
  createManualCheckIn,
  checkOutById,
  getCheckInByQrCode,
} from "../../lib/api";
import { AppRole, AuthSession, CapacityCenter, CheckInRecord, DashboardOverview, DisasterEvent, IncidentReport, InventoryItem } from "../../lib/types";

interface SiteManagerDashboardProps {
  phase: "before" | "during" | "after";
}

interface StructureDamageRecord {
  id: string;
  ownerName: string;
  address: string;
  severity: string;
  needsAid: boolean;
  status: string;
}

function normalizeDamageSeverity(severity: string, content?: string): string {
  const combined = `${severity} ${content ?? ""}`.toLowerCase();
  if (combined.includes("collapse") || combined.includes("severe")) {
    return "Severe / Collapse";
  }
  if (combined.includes("major")) {
    return "Major Damage";
  }
  return "Minor Damage";
}

function toStructureDamageRecord(report: IncidentReport): StructureDamageRecord | null {
  const combinedText = `${report.title} ${report.content}`.toLowerCase();
  const looksLikeDamageRecord =
    report.title.toLowerCase().startsWith("damage assessment") ||
    /(damage|collapse|structural|rehab|house|home assessment)/i.test(combinedText);

  if (!looksLikeDamageRecord) {
    return null;
  }

  const ownerName = report.title.replace(/^damage assessment:\s*/i, "").trim() || report.reportedBy;
  const needsAid =
    /immediate financial assistance:\s*yes/i.test(report.content) ||
    /(severe|major)/i.test(report.severity);

  return {
    id: report.id,
    ownerName: ownerName || "Unspecified homeowner",
    address: report.location,
    severity: normalizeDamageSeverity(report.severity, report.content),
    needsAid,
    status: report.status || "logged",
  };
}


  interface RecoveryPlanCard {
    id: string;
    name: string;
    progress: number;
    lead: string;
    status: string;
  }

  interface AuditEntry {
    id: string;
    title: string;
    timestamp: string;
    source: string;
    status: string;
    note: string;
    sortAt: number;
  }

  interface HistoricalDisasterRecord {
    id: string;
    name: string;
    date: string;
    severity: string;
    province: string;
    affectedAreas: number;
    status: string;
    lessonsLearned: string;
    fullText: string;
  }

  function clampProgress(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function progressStatus(progress: number): string {
    if (progress >= 100) return "Complete";
    if (progress >= 70) return "Active";
    if (progress >= 40) return "In Progress";
    return "Planning";
  }

  function formatTimestamp(value?: string): string {
    if (!value) return "No timestamp";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  }

  function formatMonthYear(value?: string): string {
    if (!value) return "Unknown date";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function getInventoryTone(status: string): "secure" | "warning" | "error" {
    const normalized = status.toLowerCase();
    if (normalized.includes("critical") || normalized.includes("depleted")) {
      return "error";
    }
    if (normalized.includes("low") || normalized.includes("transit") || normalized.includes("scheduled")) {
      return "warning";
    }
    return "secure";
  }

  function formatRelativeTime(iso?: string): string {
    if (!iso) {
      return "Recent";
    }
    const at = new Date(iso).getTime();
    if (Number.isNaN(at)) {
      return "Recent";
    }
    const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const SiteManagerDashboard: React.FC<SiteManagerDashboardProps> = ({ phase }) => {
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);
    const [checkInMode, setCheckInMode] = useState<"scan" | "manual">("scan");
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [activeTab, setActiveTab] = useState<"Dashboard" | "Inventory" | "SiteMap">("Dashboard");
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
    const [session, setSession] = useState<AuthSession | null>(null);
    const [overview, setOverview] = useState<DashboardOverview | null>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
    const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
    const [capacityCenters, setCapacityCenters] = useState<CapacityCenter[]>([]);
    const [disasterEvents, setDisasterEvents] = useState<DisasterEvent[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [incidentFormState, setIncidentFormState] = useState({
      disasterId: "",
      location: "",
      type: "",
      severity: "",
      description: "",
    });
    const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
    const [incidentSubmitError, setIncidentSubmitError] = useState<string | null>(null);

    const [stockAdjustmentState, setStockAdjustmentState] = useState({
      quantity: 0,
      reason: "Distribution Update",
      notes: "",
    });
    const [isSubmittingStockAdjustment, setIsSubmittingStockAdjustment] = useState(false);
    const [stockAdjustmentError, setStockAdjustmentError] = useState<string | null>(null);

    const [manualCheckInState, setManualCheckInState] = useState({
      citizenName: "",
      zone: "",
      groupSize: "",
    });
    const [readinessStatusMessage, setReadinessStatusMessage] = useState<string | null>(null);
    const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
    const [checkInError, setCheckInError] = useState<string | null>(null);
    const [scanType, setScanType] = useState<"check-in" | "check-out">("check-in");
    const [scannedCitizen, setScannedCitizen] = useState<{ id: string; fullName?: string; firstName?: string; lastName?: string; registrationType?: string; qrCodeId?: string; familySize?: number } | null>(null);
    const [scanModalOpen, setScanModalOpen] = useState(false);
    const [checkOutRecord, setCheckOutRecord] = useState<{ id: string; fullName: string; checkInTime?: string } | null>(null);
    const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
    const [isSubmittingCheckOut, setIsSubmittingCheckOut] = useState(false);
    const [isScanLookingUp, setIsScanLookingUp] = useState(false);
    const [selectedCenterId, setSelectedCenterId] = useState<string>("");
    const scanLockRef = useRef(false);

    const [receiveGoodsState, setReceiveGoodsState] = useState({
      arrivalTerminal: "",
      waybillNumber: "",
      condition: "Intact",
      itemId: "",
      quantity: "",
    });
    const [isSubmittingReceiveGoods, setIsSubmittingReceiveGoods] = useState(false);
    const [receiveGoodsError, setReceiveGoodsError] = useState<string | null>(null);

    const [newBatchState, setNewBatchState] = useState({
      name: "",
      itemId: "",
      quantity: "",
    });
    const [isSubmittingNewBatch, setIsSubmittingNewBatch] = useState(false);
    const [newBatchError, setNewBatchError] = useState<string | null>(null);
    const [newBatchSuccess, setNewBatchSuccess] = useState<string | null>(null);

    const [isClosingOperations, setIsClosingOperations] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isRefreshingInventory, setIsRefreshingInventory] = useState(false);

    const [recoveryTab, setRecoveryTab] = useState<"assess" | "structure" | "plans" | "audit">("assess");
    const [damageAssessment, setDamageAssessment] = useState({
      infraStatus: "Partially Restored",
      estimatedCost: "450000",
      reliefNeeded: "200",
      durationDays: "14",
      shelterRating: "4",
      successNotes: "Swift coordination of primary evacuation center within 30 minutes of peak water levels. No casualties recorded inside the hub.",
      bottlenecks: "Water drainage backflow at low-lying entry point. Power grid disconnected for 18 hours without immediate secondary generator activation.",
      isSubmitted: false,
    });
    const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
    const [assessmentError, setAssessmentError] = useState<string | null>(null);
    const [structureDamageForm, setStructureDamageForm] = useState({
      ownerName: "",
      address: "",
      severity: "Major Damage",
      needsAid: true,
    });
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/site-manager" || pathname === "/site-manager/") {
      setActiveTab("Dashboard");
    } else if (pathname.startsWith("/site-manager/inventory")) {
      setActiveTab("Inventory");
    } else if (pathname.startsWith("/site-manager/sitemap")) {
      setActiveTab("SiteMap");
    }
  }, [pathname]);


  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const stored = loadSession();
    if (!hasRole(stored, AppRole.LINE_MANAGER)) {
      router.replace("/login");
      return;
    }

    if (stored?.user.accountStatus === "pending") {
      router.replace("/login");
      return;
    }

    setSession(stored);

    async function hydrate() {
      if (!stored?.accessToken) {
        return;
      }

      setLoadingData(true);
      setLoadError(null);

      const dashboardPromise = getDashboard("site-manager", stored.accessToken)
        .then(setOverview)
        .catch(() => setOverview(null));

      const inventoryPromise = getInventory("site-manager", stored.accessToken)
        .then(setInventoryItems)
        .catch(() => setInventoryItems([]));

      const checkInPromise = getRecentCheckIns(stored.accessToken, 8)
        .then(setCheckIns)
        .catch(() => setCheckIns([]));

      const incidentPromise = getIncidentReports(stored.accessToken)
        .then(setIncidentReports)
        .catch(() => setIncidentReports([]));

      const capacityPromise = getCapacity(stored.accessToken)
        .then(setCapacityCenters)
        .catch(() => setCapacityCenters([]));

      const disastersPromise = getDisasterEvents("site-manager", stored.accessToken)
        .then((payload) => {
          const eventList = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as { disasterEvents?: DisasterEvent[] }).disasterEvents)
              ? (payload as { disasterEvents: DisasterEvent[] }).disasterEvents
              : [];
          setDisasterEvents(eventList);

          const selectedDisasterId =
            eventList.find((event) => event.status?.toLowerCase() === "active")?.id ??
            eventList[0]?.id;

          return getLatestAfterActionAssessment(stored.accessToken, selectedDisasterId)
            .then((assessment) => {
              if (!assessment) {
                return;
              }

              setDamageAssessment({
                infraStatus: assessment.infraStatus,
                estimatedCost: String(assessment.estimatedCost),
                reliefNeeded: String(assessment.reliefNeeded),
                durationDays: String(assessment.durationDays),
                shelterRating: String(assessment.shelterRating),
                successNotes: assessment.successNotes,
                bottlenecks: assessment.bottlenecks,
                isSubmitted: true,
              });
            })
            .catch(() => {
              // Keep local defaults when no assessment exists yet.
            });
        })
        .catch(() => setDisasterEvents([]));

      await Promise.allSettled([dashboardPromise, inventoryPromise, checkInPromise, incidentPromise, capacityPromise, disastersPromise]);

      setLoadingData(false);
    }

    hydrate();
  }, [router]);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  const handleSubmitIncidentReport = async () => {
    if (!session?.accessToken || !session.user) {
      setIncidentSubmitError("Session expired. Please login again.");
      return;
    }

    if (!incidentFormState.description.trim()) {
      setIncidentSubmitError("Please provide a description for the incident.");
      return;
    }

    if (!incidentFormState.type.trim() || !incidentFormState.severity.trim()) {
      setIncidentSubmitError("Please select incident type and severity.");
      return;
    }

    if (!incidentFormState.disasterId.trim() || !incidentFormState.location.trim()) {
      setIncidentSubmitError("Please select disaster context and location.");
      return;
    }

    setIsSubmittingIncident(true);
    setIncidentSubmitError(null);

    try {
      const { createIncidentReport } = await import("../../lib/api");
      
      await createIncidentReport(session.accessToken, {
        disasterId: incidentFormState.disasterId,
        reportedBy: session.user.email || "System",
        title: incidentFormState.type,
        content: incidentFormState.description,
        severity: incidentFormState.severity,
        location: incidentFormState.location,
      });

      // Reset form on success
      setIncidentFormState({
        disasterId: incidentDisasterOptions[0]?.id ?? "",
        location: incidentLocationOptions[0] ?? "",
        type: incidentTypeOptions[0] ?? "",
        severity: incidentSeverityOptions[0] ?? "",
        description: "",
      });

      // Refresh incident reports
      const freshReports = await getIncidentReports(session.accessToken);
      setIncidentReports(freshReports);

      alert("Incident report submitted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit incident report";
      setIncidentSubmitError(message);
      console.error("Incident submission error:", error);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const handleConfirmStockAdjustment = async () => {
    if (!session?.accessToken || !selectedItem) {
      setStockAdjustmentError("Session expired. Please login again.");
      return;
    }

    if (stockAdjustmentState.quantity === 0) {
      setStockAdjustmentError("Please enter a quantity adjustment.");
      return;
    }

    setIsSubmittingStockAdjustment(true);
    setStockAdjustmentError(null);

    try {
      const { adjustInventoryItem } = await import("../../lib/api");

      await adjustInventoryItem(
        session.accessToken,
        selectedItem.id,
        stockAdjustmentState.quantity,
      );

      // Reset form on success
      setStockAdjustmentState({
        quantity: 0,
        reason: "Distribution Update",
        notes: "",
      });

      // Refresh inventory
      const freshInventory = await getInventory("site-manager", session.accessToken);
      setInventoryItems(freshInventory);

      // Close panel
      setIsActionPanelOpen(false);

      alert("Stock adjustment applied successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply stock adjustment";
      setStockAdjustmentError(message);
      console.error("Stock adjustment error:", error);
    } finally {
      setIsSubmittingStockAdjustment(false);
    }
  };

  const handleQrScanned = async (results: { rawValue: string }[]) => {
    if (scanLockRef.current || isScanLookingUp) return;
    const raw = results[0]?.rawValue?.trim();
    if (!raw || !session?.accessToken) return;
    const qrCodeId = raw.startsWith("QR-") ? raw.replace("QR-", "") : raw;
    scanLockRef.current = true;
    setIsScanLookingUp(true);
    setCheckInError(null);
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
    try {
      await checkOutById(session.accessToken, checkOutRecord.id);
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      setCheckIns(freshCheckIns);
      setCheckOutModalOpen(false);
      setCheckOutRecord(null);
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
    try {
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: scannedCitizen.qrCodeId!,
        firstName: scannedCitizen.firstName || scannedCitizen.fullName?.split(" ")[0] || "",
        location: "Site Manager Desktop Check-in",
        centerId: selectedCenterId,
        familySize: scannedCitizen.familySize,
      });
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      setCheckIns(freshCheckIns);
      setScanModalOpen(false);
      setScannedCitizen(null);
      scanLockRef.current = false;
      setCheckInError(null);
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

    try {
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: manualCheckInState.citizenName,
        firstName: manualCheckInState.citizenName.split(" ")[0] || "",
        zone: manualCheckInState.zone || "",
        location: "Site Manager Check-in",
        familySize: Number(manualCheckInState.groupSize) > 0
          ? Number(manualCheckInState.groupSize)
          : undefined,
      });

      setManualCheckInState({ citizenName: "", zone: "", groupSize: "" });
      const freshCheckIns = await getRecentCheckIns(session.accessToken);
      setCheckIns(freshCheckIns);
      alert("Check-in recorded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit check-in";
      setCheckInError(message);
      console.error("Check-in error:", error);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleReceiveGoods = async () => {
    if (!session?.accessToken) {
      setReceiveGoodsError("Session expired. Please login again.");
      return;
    }

    const selectedItemId = receiveGoodsState.itemId || inventoryItems[0]?.id;
    const parsedQuantity = Number(receiveGoodsState.quantity);

    if (!selectedItemId) {
      setReceiveGoodsError("No inventory items available for intake.");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setReceiveGoodsError("Please enter a valid quantity greater than 0.");
      return;
    }

    setIsSubmittingReceiveGoods(true);
    setReceiveGoodsError(null);

    try {
      const { receiveInventory } = await import("../../lib/api");
      
      await receiveInventory(session.accessToken, {
        itemIds: [selectedItemId],
        quantities: [parsedQuantity],
        arrivalTerminal: receiveGoodsState.arrivalTerminal || "Main Terminal",
        waybillNumber: receiveGoodsState.waybillNumber || "N/A",
        condition: receiveGoodsState.condition,
      });

      setReceiveGoodsState({
        arrivalTerminal: "",
        waybillNumber: "",
        condition: "Intact",
        itemId: "",
        quantity: "",
      });
      setIsReceiveModalOpen(false);
      const freshInventory = await getInventory("site-manager", session.accessToken);
      setInventoryItems(freshInventory);
      alert("Goods received successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to receive goods";
      setReceiveGoodsError(message);
      console.error("Receive goods error:", error);
    } finally {
      setIsSubmittingReceiveGoods(false);
    }
  };

  const handleCreateNewBatch = async () => {
    if (!session?.accessToken) {
      setNewBatchError("Session expired. Please login again.");
      setNewBatchSuccess(null);
      return;
    }

    const selectedItemId = newBatchState.itemId;
    const parsedQuantity = Number(newBatchState.quantity);

    if (!selectedItemId) {
      setNewBatchError("Please select an inventory item.");
      setNewBatchSuccess(null);
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setNewBatchError("Please enter a valid batch quantity greater than 0.");
      setNewBatchSuccess(null);
      return;
    }

    setIsSubmittingNewBatch(true);
    setNewBatchError(null);
    setNewBatchSuccess(null);

    try {
      let successMsg = "";
      let refName = "";

      if (phase === 'during') {
        const { adjustInventoryItem } = await import("../../lib/api");
        await adjustInventoryItem(session.accessToken, selectedItemId, -parsedQuantity);
        
        const defaultPrefix = "Disp";
        refName = newBatchState.name.trim() || `${defaultPrefix}-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;
        successMsg = `Recorded distribution of ${parsedQuantity} units. (Ref: ${refName})`;
      } else if (phase === 'after') {
        const { adjustInventoryItem } = await import("../../lib/api");
        const currentItem = inventoryItems.find(item => item.id === selectedItemId);
        const currentQuantity = currentItem ? Number(currentItem.quantity) : 0;
        const adjustment = parsedQuantity - currentQuantity;

        await adjustInventoryItem(session.accessToken, selectedItemId, adjustment);
        
        const defaultPrefix = "Aud";
        refName = newBatchState.name.trim() || `${defaultPrefix}-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;
        successMsg = `Final inventory count updated to exactly ${parsedQuantity} units. (Ref: ${refName})`;
      } else {
        const { createInventoryBatch } = await import("../../lib/api");
        
        let defaultPrefix = "Req";

        const submittedBatchName =
          newBatchState.name.trim() || `${defaultPrefix}-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;
        
        const batchResult = await createInventoryBatch(session.accessToken, {
          name: submittedBatchName,
          items: [{ itemId: selectedItemId, quantity: parsedQuantity }],
        });
        
        refName = batchResult?.batchName ?? submittedBatchName;
        successMsg = `Added ${parsedQuantity} units to shelter supplies. (Ref: ${refName})`;
      }

      setNewBatchState({ name: "", itemId: "", quantity: "" });
      const freshInventory = await getInventory("site-manager", session.accessToken);
      setInventoryItems(freshInventory);
      
      setNewBatchSuccess(successMsg);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process inventory update";
      setNewBatchError(message);
      setNewBatchSuccess(null);
      console.error("New batch error:", error);
    } finally {
      setIsSubmittingNewBatch(false);
    }
  };

  const handleRefreshInventory = async () => {
    if (!session?.accessToken) return;
    
    setIsRefreshingInventory(true);
    try {
      const freshInventory = await getInventory("site-manager", session.accessToken);
      setInventoryItems(freshInventory);
      alert("Inventory refreshed successfully.");
    } catch (error) {
      console.error("Refresh inventory error:", error);
    } finally {
      setIsRefreshingInventory(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!session?.accessToken || !session.user) {
      setAssessmentError("Session expired. Please login again.");
      return;
    }

    const disasterId =
      disasterEvents.find((event) => event.status?.toLowerCase() === "active")?.id ??
      disasterEvents[0]?.id;

    if (!disasterId) {
      setAssessmentError("Create or activate a disaster event before submitting assessment.");
      return;
    }

    const estimatedCost = Number(damageAssessment.estimatedCost);
    const reliefNeeded = Number(damageAssessment.reliefNeeded);
    const durationDays = Number(damageAssessment.durationDays);
    const shelterRating = Number(damageAssessment.shelterRating);

    if ([estimatedCost, reliefNeeded, durationDays, shelterRating].some((value) => !Number.isFinite(value))) {
      setAssessmentError("Please provide valid numeric values before submitting.");
      return;
    }

    if (!damageAssessment.successNotes.trim() || !damageAssessment.bottlenecks.trim()) {
      setAssessmentError("Please provide both successes and bottlenecks before submitting.");
      return;
    }

    setIsSubmittingAssessment(true);
    setAssessmentError(null);

    try {
      await upsertAfterActionAssessment(session.accessToken, {
        disasterId,
        infraStatus: damageAssessment.infraStatus,
        estimatedCost,
        reliefNeeded,
        durationDays,
        shelterRating,
        successNotes: damageAssessment.successNotes,
        bottlenecks: damageAssessment.bottlenecks,
        submittedBy: session.user.email || "System",
      });

      setDamageAssessment((prev) => ({ ...prev, isSubmitted: true }));
      alert("Assessment report submitted and synchronized successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit assessment";
      setAssessmentError(message);
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleCloseOperations = async () => {
    if (!session?.accessToken) {
      alert("Session expired. Please login again.");
      return;
    }

    if (!confirm("Are you sure you want to close operations? This cannot be undone.")) {
      return;
    }

    setIsClosingOperations(true);
    try {
      const { closeOperations } = await import("../../lib/api");
      await closeOperations(session.accessToken);
      alert("Operations closed successfully. Site is now in lockdown.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to close operations";
      alert(`Error: ${message}`);
      console.error("Close operations error:", error);
    } finally {
      setIsClosingOperations(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!session?.accessToken) {
      alert("Session expired. Please login again.");
      return;
    }

    setIsGeneratingReport(true);
    try {
      const { generateSiteReport } = await import("../../lib/api");
      await generateSiteReport(session.accessToken);
      alert("Site summary report generated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate report";
      alert(`Error: ${message}`);
      console.error("Generate report error:", error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Category", "Stock Level", "Incoming", "ETA", "Status"];
      const csvRows = inventoryTable.map(row => 
        `"${row.category}","${row.stock}","${row.incoming}","${row.eta}","${row.status}"`
      );
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `damayan_inventory_export_${phase}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const phaseConfig = {
    before: {
      label: "Pre-Disaster Phase",
      subLabel: "Readiness & Mitigation",
      mainTitle: "Regional Preparedness Dashboard",
      mainDesc: "Live readiness metrics for your assigned site cluster and logistics network.",
      statusLabel: "Active Preparedness Mode",
      accent: "#81C784",
      primaryColor: "#81C784",
      primaryContainer: "#66bb6a",
      heroMetricLabel: "Readiness Score",
      checklistTitle: "Before Calamity Checklist",
      checklistDesc: "Core readiness actions aligned to your swimlane before the response phase begins.",
    },
    during: {
      label: "Active Disaster Phase",
      subLabel: "Emergency Response",
      mainTitle: "Live Status Map & Command",
      mainDesc: "Operational command view with live incident and shelter response indicators.",
      statusLabel: "Active Response Mode",
      accent: "#FFB300",
      primaryColor: "#FFB300",
      primaryContainer: "#ffa000",
      heroMetricLabel: "High Alerts",
      checklistTitle: "Emergency Operational Guide",
      checklistDesc: "This view follows the daily process: evacuee arrival, identity capture, and relief distribution.",
    },
    after: {
      label: "Post-Disaster Phase",
      subLabel: "Recovery & Rehabilitation",
      mainTitle: "Central Relief Hub Dashboard",
      mainDesc: "Recovery operations with check-out progress and replenishment tracking.",
      statusLabel: "Post-Disaster Recovery",
      accent: "#2E7D32",
      primaryColor: "#2E7D32",
      primaryContainer: "#1b5e20",
      secondaryColor: "#FFB300",
      tertiaryColor: "#81C784",
      heroMetricLabel: "Recovery Progress",
      checklistTitle: "Citizen Check-out Station",
      checklistDesc: "Active intake point for departures. Finalize aid dispensing and registry update.",
    },
  }[phase];

  const displayName = session?.user.name?.trim() || "Site Manager";
  const effectiveInventory = inventoryItems;
  const maxQuantity = Math.max(1, ...effectiveInventory.map((item) => item.quantity));

  const inventoryData = effectiveInventory.slice(0, 4).map((item) => {
    const percent = Math.max(5, Math.min(100, Math.round((item.quantity / maxQuantity) * 100)));
    const tone = getInventoryTone(item.status);
    return {
      name: item.name,
      detail: `${item.quantity.toLocaleString()} ${item.unit}`,
      percent: `${percent}%`,
      status: tone === "error" ? "Critical" : tone === "warning" ? "Low Stock" : "Secure",
      tone,
    };
  });

  const nextPhase = {
    before: "during",
    during: "after",
    after: "before",
  }[phase];

  const inventoryTable = effectiveInventory.slice(0, 8).map((item) => {
    const stockPercent = Math.max(5, Math.min(100, Math.round((item.quantity / maxQuantity) * 100)));
    const tone = getInventoryTone(item.status);
    return {
      category: item.name,
      stock: `${stockPercent}%`,
      incoming: tone === "warning" ? `${Math.max(0, Math.round(item.quantity * 0.3)).toLocaleString()} ${item.unit}` : "--",
      eta: tone === "warning" ? "Pending" : "--",
      status: tone === "error" ? "Critical" : tone === "warning" ? "Replenish" : "Stable",
      icon: "inventory_2",
      tone,
      quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
    };
  });

  const activeAlerts = overview?.incidentReports.highSeverityReports;
  const readinessScore = overview
    ? Math.min(
        100,
        Math.round(
          ((overview.capacity.totalCapacity - overview.capacity.totalOccupancy) /
            Math.max(1, overview.capacity.totalCapacity)) *
            100,
        ),
      )
    : null;
  const recoveryProgress = overview
    ? Math.min(
        100,
        Math.round(
          (overview.checkIns.totalCheckedOut / Math.max(1, overview.checkIns.total)) * 100,
        ),
      )
    : null;
  const heroMetricValue =
    phase === "before"
      ? (readinessScore != null ? `${readinessScore}%` : "N/A")
      : phase === "during"
        ? (activeAlerts != null ? String(activeAlerts) : "N/A")
        : (recoveryProgress != null ? `${recoveryProgress}%` : "N/A");

  const activityLogs = [
    ...checkIns.slice(0, 3).map((entry) => ({
      t: formatRelativeTime(entry.checkInTime),
      m: `${entry.fullName || `${entry.firstName} ${entry.lastName}`} at ${entry.location || "Site"}`,
    })),
    ...incidentReports.slice(0, 2).map((report) => ({
      t: formatRelativeTime(report.createdAt),
      m: `${report.title} - ${report.status}`,
    })),
  ].slice(0, 4);

  const incidentTypeOptions = Array.from(
    new Set(
      incidentReports
        .map((report) => report.title?.trim())
        .concat(disasterEvents.map((event) => event.type?.trim()))
        .concat(incidentFormState.type)
        .filter((value): value is string => Boolean(value && value.length > 0)),
    ),
  );

  const incidentSeverityOptions = Array.from(
    new Set(
      incidentReports
        .map((report) => report.severity?.trim())
        .concat(disasterEvents.map((event) => event.severityLevel?.trim()))
        .concat(incidentFormState.severity)
        .filter((value): value is string => Boolean(value && value.length > 0)),
    ),
  );

  const incidentDisasterOptions = disasterEvents.filter((event) => event.id && event.name);

  const incidentLocationOptions = Array.from(
    new Set(
      capacityCenters
        .map((center) => [center.name, center.barangay, center.municipality].filter(Boolean).join(", "))
        .filter((value) => value.length > 0),
    ),
  );

  const structureDamageRecords = incidentReports
    .map(toStructureDamageRecord)
    .filter((record): record is StructureDamageRecord => record !== null);

  const totalCapacity = overview?.capacity.totalCapacity ?? capacityCenters.reduce((sum, center) => sum + center.capacity, 0);
  const totalOccupancy = overview?.capacity.totalOccupancy ?? capacityCenters.reduce((sum, center) => sum + center.currentOccupancy, 0);
  const shelterCloseoutProgress = totalCapacity > 0
    ? clampProgress(((totalCapacity - totalOccupancy) / totalCapacity) * 100)
    : 0;
  const resolvedIncidents = incidentReports.filter((report) => !["pending", "open", "new"].includes(report.status.toLowerCase())).length;
  const incidentResolutionProgress = incidentReports.length > 0
    ? clampProgress((resolvedIncidents / incidentReports.length) * 100)
    : 0;
  const inventoryReadyItems = inventoryItems.filter((item) => getInventoryTone(item.status) !== "error").length;
  const inventoryReconciliationProgress = inventoryItems.length > 0
    ? clampProgress((inventoryReadyItems / inventoryItems.length) * 100)
    : 0;
  const archivedDisasterEvents = disasterEvents.filter((event) => event.status.toLowerCase() !== "active" || Boolean(event.dateEnded));
  const documentationProgress = disasterEvents.length > 0
    ? clampProgress((archivedDisasterEvents.length / disasterEvents.length) * 100)
    : 0;

  const recoveryPlans: RecoveryPlanCard[] = [
    {
      id: "recovery-shelter-closeout",
      name: "Shelter Decongestion & Resettlement Handover",
      progress: shelterCloseoutProgress,
      lead: "Shelter Operations",
      status: progressStatus(shelterCloseoutProgress),
    },
    {
      id: "recovery-incident-validation",
      name: "Incident Validation & Damage Resolution",
      progress: incidentResolutionProgress,
      lead: "Incident Desk",
      status: progressStatus(incidentResolutionProgress),
    },
    {
      id: "recovery-inventory-closeout",
      name: "Inventory Reconciliation & Aid Closeout",
      progress: inventoryReconciliationProgress,
      lead: "Logistics Unit",
      status: progressStatus(inventoryReconciliationProgress),
    },
    {
      id: "recovery-documentation",
      name: "Disaster Documentation & Archive Readiness",
      progress: documentationProgress,
      lead: "Admin Coordination",
      status: progressStatus(documentationProgress),
    },
  ];

  const operationalAuditEntries: AuditEntry[] = [
    ...incidentReports.map((report) => ({
      id: `incident-${report.id}`,
      title: report.title,
      timestamp: formatTimestamp(report.createdAt),
      source: "Incident Report",
      status: report.status,
      note: `${report.severity} severity at ${report.location}`,
      sortAt: new Date(report.createdAt).getTime() || 0,
    })),
    ...checkIns.map((entry) => ({
      id: `checkin-${entry.id}`,
      title: entry.fullName || entry.evacueeNumber,
      timestamp: formatTimestamp(entry.checkInTime),
      source: "Check-in",
      status: entry.status,
      note: `${entry.zone || "Unknown zone"} • ${entry.location || "Unknown location"}`,
      sortAt: new Date(entry.checkInTime ?? "").getTime() || 0,
    })),
  ]
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, 10);

  const historicalDisasterSource = archivedDisasterEvents.length > 0 ? archivedDisasterEvents : disasterEvents;
  const historicalDisasterReports: HistoricalDisasterRecord[] = historicalDisasterSource
    .slice()
    .sort((left, right) => new Date(right.dateStarted).getTime() - new Date(left.dateStarted).getTime())
    .map((event) => ({
      id: event.id,
      name: event.name,
      date: formatMonthYear(event.dateEnded || event.dateStarted),
      severity: event.severityLevel,
      province: event.province,
      affectedAreas: event.affectedAreas.length,
      status: event.status,
      lessonsLearned: event.notes?.trim() || "No post-event notes have been recorded for this disaster event yet.",
      fullText: `${event.name} (${event.type}) affected ${event.affectedAreas.join(", ") || event.province}. Status: ${event.status}. Started ${formatTimestamp(event.dateStarted)}${event.dateEnded ? ` and ended ${formatTimestamp(event.dateEnded)}` : " and remains active."}`,
    }));

  const selectedHistoricalReport = historicalDisasterReports.find((report) => report.id === selectedReportId) ?? null;

  useEffect(() => {
    if (historicalDisasterReports.length === 0) {
      if (selectedReportId !== null) {
        setSelectedReportId(null);
      }
      return;
    }

    if (!selectedReportId || !historicalDisasterReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(historicalDisasterReports[0].id);
    }
  }, [historicalDisasterReports, selectedReportId]);

  const essentialTasks = phase === 'after' ? [
    {
      t: "Final Damage Report",
      s: structureDamageRecords.length > 0 ? "Damage Intake Logged" : "Awaiting Intake",
    },
    {
      t: "Shelter Performance Evaluation",
      s: capacityCenters.length > 0 ? "Live Capacity Synced" : "In Progress",
    },
    {
      t: "Registered Structure Damage",
      s: `${structureDamageRecords.length} Units Logged`,
    },
    {
      t: "Recovery Plan Progress",
      s: `${Math.round(recoveryPlans.reduce((acc, p) => acc + p.progress, 0) / recoveryPlans.length)}% Avg`,
    },
  ] : [
    {
      t: "Inventory Validation",
      s: loadingData ? "Loading" : inventoryItems.length > 0 ? "Ready" : "Pending",
    },
    {
      t: "Comms Stabilization",
      s: loadingData ? "Loading" : loadError ? "Needs Attention" : "Active",
    },
    {
      t: "Volunteer Briefing",
      s: loadingData ? "Loading" : (overview?.checkIns.total ?? checkIns.length) > 0 ? "Complete" : "Pending",
    },
  ];

  const inventoryCards = [
    {
      label: "Total Assets",
      value: loadingData ? "..." : overview ? overview.inventory.itemCount.toLocaleString() : "N/A",
      trend: loadingData ? "Loading" : overview ? `${overview.inventory.totalCategories} categories` : "No backend data",
      color: "#2196F3",
    },
    {
      label: "Critical Lows",
      value: loadingData ? "..." : overview ? String(overview.inventory.lowStockItems) : "N/A",
      trend: "Needs attention",
      color: "#ba1a1a",
    },
    {
      label: "In Transit",
      value: loadingData ? "..." : "N/A",
      trend: loadingData ? "Loading" : "No backend metric",
      color: "#FFB300",
    },
  ];

  const activeShelters = overview?.capacity.totalCenters;
  const totalPopulation = overview?.capacity.totalOccupancy;
  const highUtilizationCenters = overview?.capacity.highUtilizationCenters;

  const avatarInitials = (() => {
    if (!session?.user) {
      return "SM";
    }

    const firstInitial = session.user.firstName?.trim()?.[0]?.toUpperCase();
    const lastInitial = session.user.lastName?.trim()?.[0]?.toUpperCase();

    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    }

    const nameParts = session.user.name?.trim()?.split(/\s+/)?.filter(Boolean) ?? [];
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }

    return (firstInitial ?? nameParts[0]?.[0] ?? "S").toUpperCase();
  })();

  return (
    <div className="bg-[#fafaf5] dark:bg-[#1a1c19] text-[#1a1c19] dark:text-[#e2e3dd] min-h-screen font-['Public_Sans']">
      {/* TopAppBar */}
      {/* Floating Top Header Pill */}
      <header className="fixed top-6 right-6 left-6 md:left-[280px] z-[40] flex justify-between items-center px-8 py-3 bg-white/70 dark:bg-[#1a1c19]/70 backdrop-blur-2xl border border-white/20 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] animate-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-6">
          <Link href="/site-manager/beforecalamity" className="font-black text-xs tracking-[0.2em] hover:opacity-80 transition-opacity" style={{ color: phaseConfig.primaryColor }}>
            DAMAYAN
          </Link>
          <div className="h-4 w-[1px] bg-[#dadad5] dark:bg-[#3b3b3b]"></div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#707a6c]">
            <span>Portal</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-[#1a1c19] dark:text-white">{activeTab}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block relative">
            <input
              className="bg-[#eeeeea] dark:bg-[#232622] border-none rounded-full px-4 py-2 text-sm focus:ring-2 w-64"
              placeholder="Search logistics..."
              type="text"
            />
            <span className="material-symbols-outlined absolute right-3 top-2 text-[#444743]">search</span>
          </div>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 flex items-center justify-center font-black text-white bg-gradient-to-br" 
              style={{ borderColor: phaseConfig.primaryColor, backgroundImage: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
            >
              <span className="text-sm">{avatarInitials}</span>
            </button>
            
            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-4 w-64 bg-white/95 dark:bg-[#232622]/95 backdrop-blur-xl rounded-[2.5rem] border border-[#dadad5] dark:border-[#3b3b3b] shadow-2xl py-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="px-8 pb-4 border-b border-[#dadad5]/50 dark:border-[#3b3b3b]/50">
                  <p className="text-lg font-black text-[#1a1c19] dark:text-[#e2e3dd]">{displayName}</p>
                  <p className="text-[10px] font-bold text-[#707a6c] dark:text-[#c4c7c0] uppercase tracking-[0.2em] mt-1">{session?.user.role.replace("_", " ") ?? "Site Manager"}</p>
                </div>
                
                <div className="p-3 space-y-1">
                  <button 
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#E3F2FD] dark:bg-[#2196F3]/20">
                      <span className="material-symbols-outlined text-2xl text-[#2196F3]">
                        {isDarkMode ? "light_mode" : "dark_mode"}
                      </span>
                    </div>
                    <span className="text-base font-black text-[#1a1c19] dark:text-[#e2e3dd]">
                      {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      setShowProfile(true);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[#f4f4ef] dark:hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-[#E8F5E9] dark:bg-[#2E7D32]/20">
                      <span className="material-symbols-outlined text-2xl text-[#2E7D32]">person</span>
                    </div>
                    <span className="text-base font-black text-[#1a1c19] dark:text-[#e2e3dd]">View Profile</span>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-[#dadad5]/50 dark:border-[#3b3b3b]/50 px-3">
                  <button
                    onClick={() => {
                      clearSession();
                      router.replace("/login");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group text-left"
                  >
                    <div className="w-12 h-12 rounded-[1.25rem] bg-[#FFEBEE] dark:bg-red-500/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-red-600">logout</span>
                    </div>
                    <span className="text-base font-black text-red-600">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#fafaf5] dark:bg-[#1a1c19] border-r border-[#dadad5] dark:border-[#3b3b3b] z-[30] hidden md:flex flex-col py-8 px-6">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-6 rounded-full" style={{ background: phaseConfig.primaryColor }}></div>
             <p className="font-black text-2xl tracking-tight">Damayan</p>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b]">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#707a6c]">{phaseConfig.label}</p>
          </div>
        </div>

        <nav className="space-y-2 flex-grow">
          {[
            { id: 'Dashboard', label: 'Dashboard', icon: 'grid_view', path: `/site-manager/${phase}calamity` },
            { id: 'Inventory', label: 'Inventory', icon: 'inventory_2', path: `/site-manager/inventory?phase=${phase}` },
            { id: 'SiteMap', label: 'Interactive Site Map', icon: 'map', path: `/site-manager/sitemap?phase=${phase}` },
          ].map((item) => {
            const isActive = activeTab === item.id && !showProfile;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group relative overflow-hidden ${
                  isActive 
                    ? 'text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] scale-[1.02]' 
                    : 'text-[#707a6c] hover:bg-[#f4f4ef] dark:hover:bg-white/5'
                }`}
                style={isActive ? { background: phaseConfig.primaryColor } : {}}
              >
                <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute right-0 top-0 h-full w-1.5 bg-white/30 rounded-l-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-4">
          {phase !== "before" && (
            <Link 
              href={`/site-manager/${phase === "after" ? "during" : "before"}calamity`}
              className="w-full group relative overflow-hidden rounded-3xl p-px transition-all hover:scale-[1.02] active:scale-95 shadow-sm block"
            >
              <div 
                className="relative flex items-center justify-center gap-3 px-6 py-4 rounded-[1.4rem] transition-colors border border-[#dadad5] dark:border-[#3b3b3b] bg-white dark:bg-[#232622] hover:bg-[#f4f4ef] dark:hover:bg-white/5"
              >
                 <span className="material-symbols-outlined text-[#707a6c] transition-transform group-hover:-translate-x-1 text-xl">arrow_backward</span>
                 <span className="text-[#707a6c] text-[10px] font-black uppercase tracking-[0.2em]">Back: {phase === "after" ? "During" : "Before"}</span>
              </div>
            </Link>
          )}

          {phase !== "after" && (
            <Link 
              href={`/site-manager/${nextPhase}calamity`}
              className="w-full group relative overflow-hidden rounded-3xl p-px transition-all hover:scale-[1.02] active:scale-95 shadow-xl block"
            >
              <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: phaseConfig.primaryColor }}></div>
              <div 
                className="relative flex items-center justify-center gap-3 px-6 py-5 rounded-[1.4rem] transition-colors"
                style={{ background: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
              >
                 <span className="material-symbols-outlined text-white animate-pulse text-xl">arrow_forward</span>
                 <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Next: {nextPhase}</span>
              </div>
            </Link>
          )}
        </div>
      </aside>


      {/* Main Content */}
      <main className="md:ml-64 pt-28 px-6 pb-24 max-w-7xl mx-auto">
        {showProfile ? (
          <SiteManagerProfilePage 
            onBack={() => setShowProfile(false)} 
            primaryColor={phaseConfig.primaryColor}
            session={session}
            onSessionUpdated={setSession}
          />
        ) : (
          <>
            {/* Hero Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-grow">
            <span className="bg-[#dadad5] dark:bg-[#3b3b3b] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center w-fit mb-3">
              <span className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ background: phaseConfig.primaryColor }}></span>
              {phaseConfig.statusLabel}
            </span>
            <h2 className="text-4xl font-black tracking-tight mb-2">
              {activeTab === "Dashboard" && phaseConfig.mainTitle}
              {activeTab === "Inventory" && "Logistics & Inventory"}
              {activeTab === "SiteMap" && "Regional Site Map"}
            </h2>
            <p className="text-[#444743] dark:text-[#c4c7c0] max-w-lg">
              {activeTab === "Dashboard" && `${displayName}: ${phaseConfig.mainDesc}`}
              {activeTab === "Inventory" && "Manage incoming and outgoing relief assets."}
              {activeTab === "SiteMap" && "Live monitoring of active shelters and supply routes."}
            </p>
            {loadingData && <p className="text-xs text-[#707a6c] mt-2">Loading live dashboard data...</p>}
            {loadError && <p className="text-xs text-red-600 mt-2">{loadError}</p>}
          </div>
          {activeTab === "Dashboard" && (
            <div className="flex gap-4">
              <div className="bg-white dark:bg-[#232622] p-4 rounded-2xl shadow-sm border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col items-center min-w-[120px]">
                <span className="text-3xl font-black" style={{ color: phaseConfig.primaryColor }}>{heroMetricValue}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#444743] dark:text-[#a0a39f]">{phaseConfig.heroMetricLabel}</span>
              </div>
            </div>
          )}
        </header>

        {activeTab === "Dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Main Action Card */}
          <section className="md:col-span-8 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold">{phaseConfig.checklistTitle}</h3>
                <p className="text-[#444743] text-sm">{phaseConfig.checklistDesc}</p>
              </div>
              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-4 py-2 rounded-xl flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>verified</span>
                <span className="text-sm font-bold">Priority Status</span>
              </div>
            </div>

            {/* Checklist / Scanner Grid */}
            {phase === 'after' ? (
              <div className="space-y-6 mb-8 animate-in fade-in duration-500">
                {/* Custom Recovery Tabs */}
                <div className="flex gap-2 bg-[#dadad5]/40 dark:bg-[#3b3b3b]/30 p-1.5 rounded-2xl w-full max-w-2xl">
                  <button 
                    onClick={() => setRecoveryTab("assess")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "assess" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
                  >
                    <span className="material-symbols-outlined text-sm">analytics</span>
                    1. Damage & Shelter
                  </button>
                  <button 
                    onClick={() => setRecoveryTab("structure")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "structure" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
                  >
                    <span className="material-symbols-outlined text-sm">home_work</span>
                    2. Structure Intake
                  </button>
                  <button 
                    onClick={() => setRecoveryTab("plans")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "plans" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
                  >
                    <span className="material-symbols-outlined text-sm">target</span>
                    3. Recovery Plans
                  </button>
                  <button 
                    onClick={() => setRecoveryTab("audit")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${recoveryTab === "audit" ? "bg-white dark:bg-[#232622] shadow-md text-black dark:text-white" : "text-[#444743] dark:text-[#a0a39f] hover:bg-white/10"}`}
                  >
                    <span className="material-symbols-outlined text-sm">assignment</span>
                    4. Audit & History
                  </button>
                </div>

                {/* Tab Content 1: Damage & Shelter Assessment Form */}
                {recoveryTab === "assess" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b]">
                    <div className="lg:col-span-8 space-y-6">
                      <div>
                        <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                          <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>analytics</span>
                          Post-Disaster Impact & Shelter Evaluation
                        </h4>
                        <p className="text-xs text-[#707a6c] mt-1">Submit reports for central administration evaluation and aid calculations.</p>
                      </div>

                      {damageAssessment.isSubmitted ? (
                        <div className="bg-[#e8f5e9] dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 p-6 rounded-2xl space-y-4 text-left">
                          <div className="flex items-center gap-3 text-[#2E7D32] dark:text-[#81C784]">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                            <div>
                              <p className="font-black text-sm uppercase tracking-wider">Reports Successfully Submitted</p>
                              <p className="text-[10px] text-[#444743]">Instantly synchronized with Central Disaster Administration Office</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#dadad5]/50 text-xs">
                            <div>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Infrastructure Status</p>
                              <p className="font-black text-sm text-green-700 mt-0.5">{damageAssessment.infraStatus}</p>
                            </div>
                            <div>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Est. Financial Damage</p>
                              <p className="font-black text-sm text-green-700 mt-0.5">PHP {parseInt(damageAssessment.estimatedCost).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Relief Kits Required</p>
                              <p className="font-black text-sm text-green-700 mt-0.5">{parseInt(damageAssessment.reliefNeeded).toLocaleString()} units</p>
                            </div>
                            <div>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Est. Rebuilding Duration</p>
                              <p className="font-black text-sm text-green-700 mt-0.5">{damageAssessment.durationDays} days</p>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[#dadad5]/50 text-xs">
                            <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Shelter Performance Rating</p>
                            <div className="flex gap-1 mt-1">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <span key={idx} className="material-symbols-outlined text-sm" style={{ color: idx < parseInt(damageAssessment.shelterRating) ? '#FFB300' : '#dadad5' }}>
                                  star
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[#dadad5]/50 text-xs">
                            <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Operational Successes Summary</p>
                            <p className="text-[#1a1c19] dark:text-[#e2e3dd] mt-1 leading-relaxed">{damageAssessment.successNotes}</p>
                          </div>

                          <div className="pt-4 border-t border-[#dadad5]/50 text-xs">
                            <p className="font-bold text-[#444743] uppercase tracking-wider text-[9px]">Challenges / Staging Bottlenecks</p>
                            <p className="text-[#1a1c19] dark:text-[#e2e3dd] mt-1 leading-relaxed">{damageAssessment.bottlenecks}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 text-left">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Infrastructure Status</label>
                              <CustomSelect 
                                value={damageAssessment.infraStatus}
                                onChange={(val: any) => setDamageAssessment(prev => ({ ...prev, infraStatus: val }))}
                                options={[
                                  { value: "Fully Restored", label: "Fully Restored" },
                                  { value: "Partially Restored", label: "Partially Restored" },
                                  { value: "Severely Degraded", label: "Severely Degraded" },
                                  { value: "Non-Functional", label: "Non-Functional" },
                                ]}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Est. Financial Damage (PHP)</label>
                              <input 
                                type="number"
                                value={damageAssessment.estimatedCost}
                                onChange={(e) => setDamageAssessment(prev => ({ ...prev, estimatedCost: e.target.value }))}
                                className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Relief Kits Required</label>
                              <input 
                                type="number"
                                value={damageAssessment.reliefNeeded}
                                onChange={(e) => setDamageAssessment(prev => ({ ...prev, reliefNeeded: e.target.value }))}
                                className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Est. Rebuilding Duration (Days)</label>
                              <input 
                                type="number"
                                value={damageAssessment.durationDays}
                                onChange={(e) => setDamageAssessment(prev => ({ ...prev, durationDays: e.target.value }))}
                                className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Evacuation Shelter Performance Rating</label>
                            <div className="flex gap-2 items-center">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <button 
                                  key={idx} 
                                  onClick={() => setDamageAssessment(prev => ({ ...prev, shelterRating: String(idx + 1) }))}
                                  className="hover:scale-110 active:scale-95 transition-transform"
                                >
                                  <span className="material-symbols-outlined text-2xl" style={{ color: idx < parseInt(damageAssessment.shelterRating) ? '#FFB300' : '#dadad5' }}>
                                    star
                                  </span>
                                </button>
                              ))}
                              <span className="text-xs text-[#707a6c] font-black ml-2">({damageAssessment.shelterRating} / 5 Stars)</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Operational Successes Summary</label>
                            <textarea 
                              rows={2}
                              value={damageAssessment.successNotes}
                              onChange={(e) => setDamageAssessment(prev => ({ ...prev, successNotes: e.target.value }))}
                              className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none resize-none"
                              placeholder="What protocols went perfectly? (e.g. swift evacuation, pre-staged kits, zero casualties...)"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Challenges & Staging Bottlenecks</label>
                            <textarea 
                              rows={2}
                              value={damageAssessment.bottlenecks}
                              onChange={(e) => setDamageAssessment(prev => ({ ...prev, bottlenecks: e.target.value }))}
                              className="w-full bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-4 py-3 text-xs font-bold outline-none resize-none"
                              placeholder="What delays occurred? (e.g. water backups, power outages, comms delays...)"
                            />
                          </div>

                          <button 
                            onClick={handleSubmitAssessment}
                            disabled={isSubmittingAssessment}
                            className="w-full text-white font-black uppercase tracking-wider text-xs py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:brightness-110"
                            style={{ background: phaseConfig.primaryColor }}
                          >
                            <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                            {isSubmittingAssessment ? "Submitting..." : "Generate & Submit Final Reports"}
                          </button>
                          {assessmentError && (
                            <p className="text-[11px] font-bold text-red-700">{assessmentError}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PDF Style Printable Overview Sidebar */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col justify-between gap-6">
                      <div className="text-left">
                        <div className="flex justify-between items-start border-b border-[#dadad5]/50 pb-3.5">
                          <div>
                            <h5 className="font-black text-xs text-[#1a1c19] dark:text-[#e2e3dd] uppercase tracking-wider">Digital PDF Docket</h5>
                            <p className="text-[9px] text-[#707a6c] uppercase font-bold mt-0.5">Doc Ref: DD-AFTER-2026</p>
                          </div>
                          <span className="material-symbols-outlined text-[#707a6c]">picture_as_pdf</span>
                        </div>

                        <div className="space-y-4 mt-6 text-xs">
                          <div className="bg-[#f4f4ef] dark:bg-[#232622] p-3.5 rounded-xl">
                            <p className="font-black text-[9px] text-[#707a6c] uppercase tracking-widest">Report Verification Status</p>
                            <p className="font-bold mt-1 text-[#1a1c19] dark:text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: damageAssessment.isSubmitted ? '#2E7D32' : '#ba1a1a' }}></span>
                              {damageAssessment.isSubmitted ? 'SIGNED & SYNCHRONIZED' : 'DRAFT - PENDING SIGNATURE'}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-[#707a6c]">Security Hash ID</span>
                            <p className="font-mono text-[9px] bg-[#f4f4ef] dark:bg-[#232622] p-2 rounded text-[#444743] dark:text-[#a0a39f] truncate">
                              {damageAssessment.isSubmitted ? 'SHA-256: 8f9b2d8e411b4efc8c12a7f8e83344b5a2662f2d93e1a6c42dfbe9ea100c' : 'DRAFT_INCOMPLETE_NO_SEC_KEY'}
                            </p>
                          </div>

                          <div className="pt-3.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#707a6c] mb-2">Intended Central Recipients</p>
                            <ul className="space-y-2 text-[10px] text-[#444743] dark:text-[#a0a39f] font-bold">
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs text-green-700">done_all</span>
                                DSWD Regional Office III
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs text-green-700">done_all</span>
                                OCD Central Command Hub
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs text-green-700">done_all</span>
                                PAGASA Climate Risk Desk
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          if (!damageAssessment.isSubmitted) {
                            alert('🔒 Please fill out the report and submit it first before generating a print job.');
                            return;
                          }
                          window.print();
                        }}
                        className="w-full bg-[#1a1c19] dark:bg-white text-white dark:text-black py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">print</span>
                        Print Assessment PDF
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab Content 2: Structure Damage Intake Form & Table */}
                {recoveryTab === "structure" && (
                  <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6 animate-in fade-in duration-500">
                    <div className="text-left">
                      <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                        <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>home_work</span>
                        Digital Structure Damage Registration Portal
                      </h4>
                      <p className="text-xs text-[#707a6c] mt-1">Register impacted household structures to expedite government emergency recovery grant payouts.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Form Block */}
                      <div className="lg:col-span-5 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4 text-left">
                        <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white pb-3 border-b border-[#dadad5]/50">Register New Damaged Unit</h5>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Homeowner Full Name</label>
                          <input 
                            type="text" 
                            value={structureDamageForm.ownerName}
                            onChange={(e) => setStructureDamageForm(prev => ({ ...prev, ownerName: e.target.value }))}
                            placeholder="e.g. Juan Dela Cruz"
                            className="w-full bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Structure Address</label>
                          <input 
                            type="text" 
                            value={structureDamageForm.address}
                            onChange={(e) => setStructureDamageForm(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="e.g. 123 Mabini St, Zone 2"
                            className="w-full bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Damage Severity Level</label>
                          <CustomSelect 
                            value={structureDamageForm.severity}
                            onChange={(val: any) => setStructureDamageForm(prev => ({ ...prev, severity: val }))}
                            options={[
                              { value: "Severe / Collapse", label: "Severe / Collapse" },
                              { value: "Major Damage", label: "Major Damage" },
                              { value: "Minor Damage", label: "Minor Damage" },
                            ]}
                          />
                        </div>

                        <label className="flex items-center gap-3 p-3 bg-[#dadad5]/20 dark:bg-white/5 rounded-xl cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={structureDamageForm.needsAid}
                            onChange={(e) => setStructureDamageForm(prev => ({ ...prev, needsAid: e.target.checked }))}
                            className="w-4 h-4 rounded border-[#dadad5] text-green-700 focus:ring-green-500"
                          />
                          <span className="text-[10px] font-black uppercase text-[#444743] dark:text-[#a0a39f] select-none">Requires Immediate Financial Assistance</span>
                        </label>

                        <button 
                          onClick={async () => {
                            if (!session?.accessToken) {
                              alert('⚠️ Session expired. Please log in again.');
                              return;
                            }
                            if (!structureDamageForm.ownerName.trim() || !structureDamageForm.address.trim()) {
                              alert('⚠️ Owner name and address are required to log structural assessments.');
                              return;
                            }

                            const disasterId =
                              disasterEvents.find((event) => event.status?.toLowerCase() === 'active')?.id ??
                              incidentDisasterOptions[0]?.id;

                            if (!disasterId) {
                              alert('⚠️ Create or activate a disaster event first before registering structure damage.');
                              return;
                            }

                            try {
                              const { createIncidentReport } = await import("../../lib/api");

                              await createIncidentReport(session.accessToken, {
                                disasterId,
                                reportedBy: session.user.email || "System",
                                title: `Damage Assessment: ${structureDamageForm.ownerName.trim()}`,
                                content: [
                                  `Assessment type: Structural damage intake`,
                                  `Immediate financial assistance: ${structureDamageForm.needsAid ? 'yes' : 'no'}`,
                                ].join("\n"),
                                severity: structureDamageForm.severity,
                                location: structureDamageForm.address.trim(),
                              });

                              const freshReports = await getIncidentReports(session.accessToken);
                              setIncidentReports(freshReports);
                              setStructureDamageForm({ ownerName: "", address: "", severity: "Major Damage", needsAid: true });
                            } catch (error) {
                              const message = error instanceof Error ? error.message : 'Failed to register structure damage';
                              alert(`⚠️ ${message}`);
                            }
                          }}
                          className="w-full text-white font-black uppercase tracking-wider text-xs py-3.5 rounded-2xl shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                          style={{ background: phaseConfig.primaryColor }}
                        >
                          <span className="material-symbols-outlined text-sm">home_work</span>
                          Register Structure Damage
                        </button>
                      </div>

                      {/* Records Table */}
                      <div className="lg:col-span-7 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] overflow-hidden">
                        <div className="flex justify-between items-center pb-3.5 border-b border-[#dadad5]/50 mb-4">
                          <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">Registered Damage Intake Logs</h5>
                          <span className="bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 px-2.5 py-0.5 rounded text-[9px] font-black uppercase border border-green-200/50">Synchronized Live</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead>
                              <tr className="border-b border-[#dadad5]/50 text-[#707a6c] font-black text-[9px] uppercase tracking-wider">
                                <th className="pb-3">ID</th>
                                <th className="pb-3">Homeowner</th>
                                <th className="pb-3">Address</th>
                                <th className="pb-3">Severity</th>
                                <th className="pb-3 text-center">Financial Aid</th>
                                <th className="pb-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#dadad5]/30">
                              {structureDamageRecords.map((rec) => (
                                <tr key={rec.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors font-bold">
                                  <td className="py-3.5 font-mono text-[10px]">{rec.id}</td>
                                  <td className="py-3.5 text-[#1a1c19] dark:text-white">{rec.ownerName}</td>
                                  <td className="py-3.5 text-[#444743] dark:text-[#a0a39f]">{rec.address}</td>
                                  <td className="py-3.5">
                                    <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${
                                      rec.severity === 'Severe / Collapse' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                                      rec.severity === 'Major Damage' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                                      'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                    }`}>
                                      {rec.severity}
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-center">
                                    <span className="material-symbols-outlined text-sm font-black" style={{ color: rec.needsAid ? '#2E7D32' : '#707a6c' }}>
                                      {rec.needsAid ? 'check_box' : 'disabled_by_default'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-right">
                                    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-[#f4f4ef] dark:bg-[#232622] px-2 py-0.5 rounded">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                      {rec.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 3: Track Progress on Recovery Plans */}
                {recoveryTab === "plans" && (
                  <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6">
                    <div>
                      <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                        <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>target</span>
                        Published Rehabilitation & Recovery Plans
                      </h4>
                      <p className="text-xs text-[#707a6c] mt-1">Oversight panel to track, adjust, and report progress on ground execution.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {recoveryPlans.map((plan) => (
                        <div key={plan.id} className="bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] flex flex-col justify-between gap-4 shadow-sm text-left">
                          <div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-50 text-[#2E7D32] dark:bg-green-950/40 dark:text-[#81C784] border border-[#2E7D32]/10">{plan.status}</span>
                              <span className="text-[10px] text-[#707a6c] font-bold">Lead: {plan.lead}</span>
                            </div>
                            <h5 className="font-black text-sm text-[#1a1c19] dark:text-white mt-3.5 leading-snug">{plan.name}</h5>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#444743] dark:text-[#a0a39f]">Completion Progress</span>
                              <span className="font-black text-sm" style={{ color: phaseConfig.primaryColor }}>{plan.progress}%</span>
                            </div>
                            <div className="w-full bg-[#f4f4ef] dark:bg-[#232622] h-2.5 rounded-full overflow-hidden border border-[#dadad5] dark:border-[#3b3b3b]">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${plan.progress}%`, background: phaseConfig.primaryColor }}></div>
                            </div>
                            <div className="rounded-xl bg-[#f4f4ef] dark:bg-[#232622] px-3 py-2 text-[10px] font-bold text-[#444743] dark:text-[#a0a39f]">
                              Derived from live shelter, incident, inventory, and disaster-event records.
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab Content 4: System Auditing & Historical Logging */}
                {recoveryTab === "audit" && (
                  <div className="bg-[#f4f4ef] dark:bg-[#232622] p-6 md:p-8 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-6 animate-in fade-in duration-500">
                    <div className="text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-black flex items-center gap-2 text-[#1a1c19] dark:text-white">
                          <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>history</span>
                          System Auditing & Historical Incident Logs
                        </h4>
                        <p className="text-xs text-[#707a6c] mt-1">Review live operational activity and historical disaster events already stored in the backend.</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          const csvContent = "data:text/csv;charset=utf-8," 
                            + "Entry ID,Title,Timestamp,Source,Status,Note\n"
                            + operationalAuditEntries.map(entry => `${entry.id},"${entry.title}","${entry.timestamp}",${entry.source},${entry.status},"${entry.note}"`).join("\n");
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", "Damayan_Auditing_Activity_Log.csv");
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] hover:bg-[#eeeeea] dark:hover:bg-white/5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shrink-0 text-[#1a1c19] dark:text-white"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Export Auditing CSV
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left: Selected Historical Event */}
                      <div className="lg:col-span-4 bg-white dark:bg-[#1a1c19] p-6 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-5 text-left">
                        <div className="pb-3 border-b border-[#dadad5]/50 flex justify-between items-center">
                          <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">Historical Event Snapshot</h5>
                          <span className="bg-green-50 text-green-700 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-green-200/50">BACKEND SYNCED</span>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-[#707a6c]">Historical Disaster Event</label>
                            <CustomSelect 
                              value={selectedReportId || ""}
                              onChange={(val: any) => setSelectedReportId(val || null)}
                              placeholder="-- Select Historical Event --"
                              options={historicalDisasterReports.map(rpt => ({ value: rpt.id, label: rpt.name }))}
                            />
                          </div>

                          {selectedHistoricalReport ? (
                            <div className="space-y-3 rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] p-4 text-xs font-bold text-[#444743] dark:text-[#a0a39f]">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Severity</p>
                                <p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.severity}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Province</p>
                                <p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.province}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Affected Areas</p>
                                <p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.affectedAreas}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#707a6c]">Lifecycle Status</p>
                                <p className="mt-1 text-sm text-[#1a1c19] dark:text-white">{selectedHistoricalReport.status}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] p-4 text-xs font-bold text-[#707a6c]">
                              No historical disaster records are available from the backend yet.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Dynamic Historical Viewers & Logs */}
                      <div className="lg:col-span-8 space-y-6 text-left">
                        {/* Search and Tabs */}
                        <div className="bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">1. Operational Activity Feed</h5>
                            <span className="bg-[#2E7D32]/10 text-[#2E7D32] dark:text-[#81C784] text-[8px] font-black uppercase px-2 py-0.5 rounded border border-[#2E7D32]/20">{operationalAuditEntries.length} LIVE RECORDS</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[500px]">
                              <thead>
                                <tr className="border-b border-[#dadad5]/50 text-[#707a6c] font-black text-[9px] uppercase tracking-wider">
                                  <th className="pb-2">Activity</th>
                                  <th className="pb-2">Logged Time</th>
                                  <th className="pb-2 text-center">Source</th>
                                  <th className="pb-2 text-center">Status</th>
                                  <th className="pb-2 text-right">Rating</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#dadad5]/30">
                                {operationalAuditEntries.map((entry) => (
                                  <tr key={entry.id} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors font-bold">
                                    <td className="py-3">
                                      <p className="text-[#1a1c19] dark:text-white">{entry.title}</p>
                                      <p className="text-[9px] text-[#707a6c] font-mono mt-0.5">{entry.note}</p>
                                    </td>
                                    <td className="py-3 font-medium text-[#707a6c] whitespace-nowrap">{entry.timestamp}</td>
                                    <td className="py-3 text-center">{entry.source}</td>
                                    <td className="py-3 text-center">{entry.status}</td>
                                    <td className="py-3 text-right">
                                      <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${
                                        entry.status.toLowerCase() === 'resolved' || entry.status.toLowerCase() === 'checked_in' || entry.status.toLowerCase() === 'processed'
                                          ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                      }`}>
                                        {entry.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Historical Calamity Repository */}
                        <div className="bg-white dark:bg-[#1a1c19] p-5 rounded-2xl border border-[#dadad5] dark:border-[#3b3b3b] space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h5 className="font-black text-xs uppercase tracking-wider text-[#1a1c19] dark:text-white">2. Regional Historical Calamity Repository</h5>
                              <p className="text-[10px] text-[#707a6c] mt-0.5">Filter and reference response metrics of past tropical cyclones.</p>
                            </div>
                            <input 
                              type="text" 
                              value={historySearchQuery}
                              onChange={(e) => setHistorySearchQuery(e.target.value)}
                              placeholder="Search cyclones (e.g. Pepito)..."
                              className="bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] rounded-full px-4 py-1.5 text-xs font-bold outline-none w-full sm:w-48 text-[#1a1c19] dark:text-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {historicalDisasterReports
                              .filter(r => r.name.toLowerCase().includes(historySearchQuery.toLowerCase()))
                              .map(rpt => {
                                const isSelected = selectedReportId === rpt.id;
                                return (
                                  <div 
                                    key={rpt.id}
                                    onClick={() => setSelectedReportId(rpt.id)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'border-green-600 bg-green-50/20 dark:bg-green-950/10 shadow-sm' 
                                        : 'border-[#dadad5] dark:border-[#3b3b3b] bg-[#f4f4ef]/30 dark:bg-[#232622]/30 hover:border-green-600/50'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <p className="font-black text-xs text-[#1a1c19] dark:text-white leading-tight">{rpt.name}</p>
                                      <span className="text-[8px] font-black uppercase text-[#707a6c] shrink-0">{rpt.date}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-[#444743] dark:text-[#a0a39f] font-bold border-t border-[#dadad5]/50 pt-2.5">
                                      <div>
                                        <p className="text-[8px] uppercase tracking-wider text-[#707a6c]">Severity</p>
                                        <p className="font-black text-[#1a1c19] dark:text-white">{rpt.severity}</p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] uppercase tracking-wider text-[#707a6c]">Affected Areas</p>
                                        <p className="font-black text-[#1a1c19] dark:text-white">{rpt.affectedAreas}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          {selectedHistoricalReport && (
                            <div className="bg-[#f4f4ef]/50 dark:bg-[#232622]/50 border border-green-600/20 p-4 rounded-xl space-y-3 mt-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <div className="flex justify-between items-center pb-2 border-b border-[#dadad5]/50">
                                <span className="font-black text-[10px] uppercase text-green-700 tracking-wider">Lessons Learned File: {selectedHistoricalReport.name}</span>
                                <span className="material-symbols-outlined text-sm text-green-700">inventory</span>
                              </div>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[8px]">Lessons Learned & Recommendations</p>
                              <p className="text-[#1a1c19] dark:text-[#e2e3dd] italic leading-relaxed">
                                "{selectedHistoricalReport.lessonsLearned}"
                              </p>
                              <p className="font-bold text-[#444743] uppercase tracking-wider text-[8px] pt-1">Full Incident Report Log</p>
                              <p className="text-[#444743] dark:text-[#a0a39f] leading-relaxed">
                                {selectedHistoricalReport.fullText}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-10 rounded-2xl border-b-4 flex flex-col items-center text-center transition-all hover:shadow-md" style={{ borderColor: phaseConfig.primaryColor }}>
                <span className="material-symbols-outlined text-5xl mb-4" style={{ color: phaseConfig.primaryColor }}>
                  {phase === 'before' ? 'checklist' : phase === 'during' ? 'qr_code_scanner' : 'how_to_reg'}
                </span>
                <h4 className="font-bold text-lg mb-2">
                  {phase === 'before' ? 'Readiness Check' : phase === 'during' ? 'Identity Verification' : 'Final Aid Dispensing'}
                </h4>
                <p className="text-sm text-[#444743] mb-6">
                  {phase === 'before' ? 'Verify all staging protocols and personnel presence.' : phase === 'during' ? 'Active intake: scan QR codes for rapid shelter entry.' : 'Verify citizen relief ID for recovery kit distribution.'}
                </p>
                {phase === 'during' && (
                  <div className="w-full space-y-3 mb-4">
                    <div className="flex gap-2 bg-[#dadad5] p-1 rounded-lg">
                      <button
                        onClick={() => { setCheckInMode("scan"); setCheckInError(null); scanLockRef.current = false; }}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "scan" ? "bg-white shadow-sm" : "text-[#444743]"}`}
                      >Scan QR</button>
                      <button
                        onClick={() => { setCheckInMode("manual"); setCheckInError(null); scanLockRef.current = false; }}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${checkInMode === "manual" ? "bg-white shadow-sm" : "text-[#444743]"}`}
                      >Manual ID</button>
                    </div>

                    {checkInMode === "scan" && (
                      <div className="flex gap-2 bg-[#f0f0eb] p-1 rounded-lg">
                        <button
                          onClick={() => { setScanType("check-in"); setCheckInError(null); scanLockRef.current = false; }}
                          className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${scanType === "check-in" ? "bg-[#FFB300] text-white shadow-sm" : "text-[#444743]"}`}
                        >Check-In</button>
                        <button
                          onClick={() => { setScanType("check-out"); setCheckInError(null); scanLockRef.current = false; }}
                          className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${scanType === "check-out" ? "bg-[#2E7D32] text-white shadow-sm" : "text-[#444743]"}`}
                        >Check-Out</button>
                      </div>
                    )}
                    
                    {checkInMode === "scan" ? (
                      <div className="rounded-xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        {isScanLookingUp ? (
                          <div className="h-40 bg-black flex items-center justify-center">
                            <span className="text-white text-sm font-bold animate-pulse">Looking up citizen...</span>
                          </div>
                        ) : (
                          <Scanner
                            onScan={handleQrScanned}
                            onError={() => setCheckInError("Camera error. Check browser permissions.")}
                            styles={{ container: { height: 200 } }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-300 w-full overflow-hidden">
                        <input 
                          className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm focus:ring-2" 
                          style={{ outlineColor: phaseConfig.primaryColor } as any} 
                          placeholder="Citizen Name or ID..." 
                          type="text"
                          value={manualCheckInState.citizenName}
                          onChange={(e) => setManualCheckInState({ ...manualCheckInState, citizenName: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm" 
                            placeholder="Zone" 
                            type="text"
                            value={manualCheckInState.zone}
                            onChange={(e) => setManualCheckInState({ ...manualCheckInState, zone: e.target.value })}
                          />
                          <input 
                            className="w-full bg-white border border-[#dadad5] rounded-xl px-4 py-3 text-sm" 
                            placeholder="Group Size" 
                            type="number" 
                            min="0"
                            value={manualCheckInState.groupSize}
                            onChange={(e) => setManualCheckInState({ ...manualCheckInState, groupSize: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {phase === 'during' && checkInError && (
                  <p className="text-red-600 text-sm mb-3">{checkInError}</p>
                )}
                {phase === 'before' && readinessStatusMessage && (
                  <p className="text-[#0d631b] text-sm mb-3">{readinessStatusMessage}</p>
                )}
                {!(phase === 'during' && checkInMode === 'scan') && (
                  <button
                    onClick={() => {
                      if (phase === 'before') {
                        setCheckInError(null);
                        setReadinessStatusMessage('Readiness status logged successfully.');
                      }
                      else if (phase === 'during') handleSubmitManualCheckIn();
                      else setIsReceiveModalOpen(true);
                    }}
                    disabled={isSubmittingCheckIn || isClosingOperations}
                    className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                    style={{ background: phaseConfig.primaryColor }}
                  >
                    {isSubmittingCheckIn || isClosingOperations ? "Processing..." : (phase === 'before' ? 'Log Readiness Status' : phase === 'during' ? 'Confirm Check-in' : 'Verify & Log Aid')}
                  </button>
                )}
              </div>

              <div className="bg-[#f4f4ef] dark:bg-[#232622] px-6 py-8 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>list_alt</span>
                    Essential Tasks
                  </h4>
                  <ul className="space-y-4">
                    {essentialTasks.map((task, i) => (
                      <li key={i} className="flex justify-between items-center text-sm pb-2 border-b border-[#dadad5]/50">
                        <span className="font-medium">{task.t}</span>
                        <span className="bg-white/50 px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ color: phaseConfig.primaryColor }}>{task.s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[#dadad5]">
                  <p className="text-[10px] font-bold text-[#444743] uppercase tracking-widest mb-2">Protocol Note</p>
                  <p className="text-xs italic text-[#444743]">
                    {activityLogs.length > 0 ? activityLogs[0].m : "Waiting for latest operational updates from backend."}
                  </p>
                </div>
              </div>
            </div>
            )}

            {/* Incident Report Section (During Phase Only) */}
            {phase === 'during' && (
              <div className="mt-8 pt-8 border-t border-[#dadad5] animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Report Site Incident</h3>
                    <p className="text-[#444743] text-sm">Log critical events or medical emergencies immediately.</p>
                  </div>
                  <span className="bg-orange-100 text-[#FFB300] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{activeAlerts} active alerts</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Disaster Context</label>
                    <CustomSelect
                      value={incidentFormState.disasterId}
                      onChange={(val: any) => setIncidentFormState({ ...incidentFormState, disasterId: val })}
                      placeholder={incidentDisasterOptions.length > 0 ? "Select active disaster" : "No disaster events available"}
                      options={incidentDisasterOptions.map((event) => ({ value: event.id, label: event.name }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Location</label>
                    <CustomSelect
                      value={incidentFormState.location}
                      onChange={(val: any) => setIncidentFormState({ ...incidentFormState, location: val })}
                      placeholder={incidentLocationOptions.length > 0 ? "Select location" : "No center locations available"}
                      options={incidentLocationOptions.map((location) => ({ value: location, label: location }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Incident Type</label>
                    <CustomSelect 
                      value={incidentFormState.type}
                      onChange={(val: any) => setIncidentFormState({ ...incidentFormState, type: val })}
                      placeholder={incidentTypeOptions.length > 0 ? "Select incident type" : "No incident types available"}
                      options={incidentTypeOptions.map((option) => ({ value: option, label: option }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Severity</label>
                    <div className="flex gap-2">
                      {incidentSeverityOptions.slice(0, 3).map((severity) => {
                        const normalized = severity.toLowerCase();
                        const selected = incidentFormState.severity === severity;
                        const activeColor = normalized.includes("critical")
                          ? "#ba1a1a"
                          : normalized.includes("high")
                            ? "#FFB300"
                            : "#81C784";

                        return (
                          <button
                            key={severity}
                            onClick={() => setIncidentFormState({ ...incidentFormState, severity })}
                            className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl text-white shadow-md transition-all active:scale-95"
                            style={{ background: selected ? activeColor : "#dadad5", color: selected ? "white" : "#444743" }}
                          >
                            {severity}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#444743] ml-1">Detailed Description</label>
                    <textarea 
                      className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-sm min-h-[100px]" 
                      placeholder="Describe the situation..."
                      value={incidentFormState.description}
                      onChange={(e) => setIncidentFormState({ ...incidentFormState, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                {incidentSubmitError && (
                  <p className="text-red-600 text-sm mt-3">{incidentSubmitError}</p>
                )}
                <button 
                  onClick={handleSubmitIncidentReport}
                  disabled={isSubmittingIncident}
                  className="mt-4 w-full bg-[#1a1c19] text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed" 
                  style={{ background: '#1a1c19' }}
                >
                  {isSubmittingIncident ? 'Submitting...' : 'Submit Incident Report'}
                </button>
              </div>
            )}
          </section>

          {/* Sidebar Area */}
          <section className="md:col-span-4 space-y-6">
            <div className="bg-[#1a1c19] text-white rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>analytics</span>
                Live Activity
              </h3>
              <div className="space-y-4">
                {activityLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-1 h-10 rounded-full mt-1" style={{ background: phaseConfig.primaryColor }}></div>
                    <div>
                      <p className="text-[10px] font-bold text-[#dadad5] uppercase">{log.t}</p>
                      <p className="text-xs text-[#dadad5]/80">{log.m}</p>
                    </div>
                  </div>
                ))}
                {activityLogs.length === 0 && (
                  <p className="text-xs text-[#dadad5]/80">No recent activity logs available.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#232622] rounded-3xl p-6 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm relative overflow-hidden group min-h-[200px]">
              <div className="absolute inset-0 opacity-40 group-hover:opacity-80 transition-opacity">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpSvAOIIisjz13eQiOCstFnz3vVDhXSLsC2wkcR0gzF0aE74mgQ4wHIUPQxpjnjM9rNALymOt0yzw4BUqDzXDmvL68DiBEHgtwXcoRktsaAjW4XF8rQ9xFDqsWjQVCUV3lpc9WdLCHcs9vEn68r458YriOvYDyAOpkuQmDaQXPWqqt7wAiApmtFpPyTHIgyKDI39znTvbgGnTysMQr1Ezpxs0enh_BMJvFIA9nVdUBqndsA8qbD84JSmQa6tncbOhO9dg-xTC8Mwxc" alt="Map" />
              </div>
              <div className="relative z-10 flex flex-col justify-end h-full">
                <div className="bg-white/90 p-4 rounded-2xl shadow-lg">
                  <h4 className="font-bold text-sm">Interactive Site Map</h4>
                  <p className="text-[10px] text-[#444743] uppercase tracking-widest">Real-time zone activity monitor</p>
                </div>
              </div>
            </div>

            {/* Closing Operations (After Phase Only) */}
            {phase === 'after' && (
              <div className="bg-[#1a1c19] text-white rounded-3xl p-6 shadow-xl animate-in fade-in duration-700">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary-fixed">
                  <span className="material-symbols-outlined">exit_to_app</span>
                  Closing Operations
                </h3>
                <p className="text-[#dadad5]/80 text-xs mb-6">Finalize day-of operations and prepare site handover documentation.</p>
                <div className="space-y-3">
                  <button 
                    onClick={handleCloseOperations}
                    disabled={isClosingOperations}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">lock_clock</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">{isClosingOperations ? "Processing..." : "Initiate Check-out"}</p>
                      <p className="text-[10px] text-[#dadad5]/50 uppercase tracking-widest">Site Lockdown</p>
                    </div>
                  </button>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-400/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">{isGeneratingReport ? "Generating..." : "Site Summary Report"}</p>
                      <p className="text-[10px] text-[#dadad5]/50 uppercase tracking-widest">Generate PDF & Sync</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Inventory Table Section (After Phase Specific) */}
          {phase === 'after' ? (
            <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Post-Event Inventory Audit</h3>
                  <p className="text-[#444743] text-sm">Consolidating remaining relief goods and logging unusable items before site closure.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsReceiveModalOpen(true)}
                    className="bg-[#2196F3] text-white px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined">inventory</span>
                    Audit Remaining Stock
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f4f4ef] dark:bg-[#1a1c19] text-[#444743] text-[10px] uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Resource Category</th>
                      <th className="px-6 py-4">Stock Level</th>
                      <th className="px-6 py-4">Incoming</th>
                      <th className="px-6 py-4">ETA</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dadad5]/30">
                    {inventoryTable.map((row, i) => (
                      <tr key={i} className="hover:bg-[#f4f4ef]/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5 font-bold text-sm flex items-center gap-3">
                          <span className="material-symbols-outlined" style={{ color: phaseConfig.primaryColor }}>{row.icon}</span>
                          {row.category}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[#dadad5] rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: row.stock, background: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : phaseConfig.primaryColor }}></div>
                            </div>
                            <span className="text-xs font-bold" style={{ color: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : 'inherit' }}>{row.stock}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs font-medium text-[#444743]">{row.incoming}</td>
                        <td className="px-6 py-5 text-xs font-medium text-[#444743]">{row.eta}</td>
                        <td className="px-6 py-5">
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase" style={{ backgroundColor: row.tone === 'error' ? '#ffdad6' : row.tone === 'warning' ? '#fff3e0' : '#dadad5', color: row.tone === 'error' ? '#ba1a1a' : row.tone === 'warning' ? '#FFB300' : '#444743' }}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => {
                              setSelectedItem(row);
                              setIsActionPanelOpen(true);
                            }}
                            className="material-symbols-outlined text-[#444743] hover:text-[#0d631b] p-2 hover:bg-[#f4f4ef] rounded-full transition-all active:scale-90"
                          >
                            edit_note
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="md:col-span-12 bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-bold">Essential Supply Checklist</h3>
                <p className="text-[#444743] text-sm">Real-time inventory levels across regional staging areas.</p>
              </div>
              <button 
                onClick={() => router.push('/site-manager/inventory')}
                className="text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50" 
                style={{ background: phaseConfig.primaryColor }}
              >
                Update Site Inventory
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {inventoryData.map((item, i) => (
                <div key={i} className="p-5 rounded-2xl bg-[#f4f4ef] dark:bg-[#232622] border border-[#dadad5] dark:border-[#3b3b3b] group hover:scale-[1.02] transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md" style={{ background: item.tone === 'error' ? '#b91c1c' : item.tone === 'warning' ? '#d97706' : phaseConfig.primaryColor }}>
                      {item.name[0]}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${item.tone === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                  <p className="text-xs text-[#444743] mb-4">{item.detail}</p>
                  <div className="w-full h-1.5 bg-[#dadad5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: item.percent, background: item.tone === 'error' ? '#b91c1c' : phaseConfig.primaryColor }}></div>
                  </div>
                </div>
              ))}
            </div>
            </section>
          )}
        </div>
        )}

        {activeTab === "Inventory" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {inventoryCards.map((stat, i) => (
                <div key={i} className="bg-white dark:bg-[#232622] p-6 rounded-3xl border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#444743] mb-1">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h4 className="text-3xl font-black">{stat.value}</h4>
                    <span className="text-xs font-bold" style={{ color: stat.color }}>{stat.trend}</span>
                  </div>
                  <div className="w-full h-1 bg-[#f4f4ef] dark:bg-[#1a1c19] mt-4 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '70%', background: stat.color }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-[#232622] rounded-3xl p-8 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black">
                    {phase === 'before' ? 'Prepare Shelter Supplies' : phase === 'during' ? 'Distribute Relief Goods' : 'Final Inventory Check'}
                  </h3>
                  <p className="text-[#444743] text-sm mt-1">
                    {phase === 'before' ? 'Count your current items and add new deliveries before evacuees arrive.' : phase === 'during' ? 'Record items you give out to evacuees to keep your stock levels accurate.' : 'Count everything you have left so we can safely pack up the shelter.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExportCSV} className="bg-[#f4f4ef] dark:bg-[#1a1c19] px-4 py-2 rounded-xl text-xs font-bold border border-[#dadad5] hover:bg-[#dadad5] dark:hover:bg-[#3b3b3b] transition-colors active:scale-95">Export CSV</button>
                  <button 
                    onClick={handleCreateNewBatch}
                    disabled={isSubmittingNewBatch}
                    className="text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg disabled:opacity-50" 
                    style={{ background: phaseConfig.primaryColor }}
                  >
                    {isSubmittingNewBatch ? "Processing..." : (phase === 'before' ? 'Add to Supplies' : phase === 'during' ? 'Record Distribution' : 'Update Final Count')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <input
                  className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-xs font-bold"
                  placeholder={phase === 'before' ? 'Delivery or request name (optional)' : phase === 'during' ? 'Who/Where did you give this to?' : 'Notes or condition (optional)'}
                  value={newBatchState.name}
                  onChange={(e) => setNewBatchState({ ...newBatchState, name: e.target.value })}
                />
                <CustomSelect
                  value={newBatchState.itemId}
                  onChange={(val: any) => setNewBatchState({ ...newBatchState, itemId: val })}
                  options={inventoryItems.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder={phase === 'before' ? 'Select item to add' : phase === 'during' ? 'Select item to give out' : 'Select item to count'}
                />
                <input
                  className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-xl px-4 py-3 text-xs font-bold"
                  placeholder={phase === 'before' ? 'Quantity to add' : phase === 'during' ? 'Quantity given out' : 'Actual quantity left'}
                  type="number"
                  min="1"
                  value={newBatchState.quantity}
                  onChange={(e) => setNewBatchState({ ...newBatchState, quantity: e.target.value })}
                />
              </div>
              {newBatchError && <p className="text-red-600 text-xs mb-2">{newBatchError}</p>}
              {newBatchSuccess && <p className="text-[#2E7D32] text-xs mb-4">{newBatchSuccess}</p>}
              <div className="space-y-4">
                {inventoryTable.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[#f4f4ef]/50 dark:bg-white/5 border border-transparent hover:border-[#dadad5] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1a1c19] flex items-center justify-center border border-[#dadad5] dark:border-[#3b3b3b]">
                        <span className="material-symbols-outlined" style={{ color: item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32" }}>package_2</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.category}</p>
                        <p className="text-[10px] text-[#444743] uppercase tracking-widest">{item.quantity}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: item.tone === "error" ? "#ffdad6" : item.tone === "warning" ? "#fff3e0" : "#e8f5e9", color: item.tone === "error" ? "#ba1a1a" : item.tone === "warning" ? "#FFB300" : "#2E7D32" }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "SiteMap" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-[#232622] rounded-3xl p-6 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm min-h-[660px] relative overflow-hidden flex flex-col">
                <div className="bg-white dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b] rounded-[1.8rem] py-4 px-2 shadow-sm grid grid-cols-5 divide-x divide-[#dadad5] dark:divide-[#3b3b3b] mb-5 items-center w-full text-center">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Shelters</p>
                    <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                      {loadingData ? "..." : activeShelters ?? capacityCenters.length ?? "0"}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Population</p>
                    <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                      {loadingData ? "..." : totalPopulation != null ? totalPopulation.toLocaleString() : "0"}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Critical</p>
                    <p className="text-xl md:text-2xl font-black mt-1 text-[#ba1a1a] dark:text-[#ffb4ab]">
                      {loadingData ? "..." : highUtilizationCenters ?? "0"}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Avg Util.</p>
                    <p className="text-xl md:text-2xl font-black mt-1 text-[#2E7D32] dark:text-[#81C784]">
                      {loadingData ? "..." : `${capacityCenters.length > 0 
                        ? Math.round(capacityCenters.reduce((sum, c) => sum + c.utilizationRate, 0) / capacityCenters.length)
                        : 60}%`}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#707a6c]">Resources</p>
                    <p className="text-xl md:text-2xl font-black mt-1 text-[#1a1c19] dark:text-white">
                      {loadingData ? "..." : (overview?.inventory.totalCategories ?? (inventoryItems.length > 0 ? inventoryItems.length : 5))}
                    </p>
                  </div>
                </div>
                <div className="flex-grow rounded-2xl overflow-hidden">
                  <SiteManagerRegionalMap 
                    centers={capacityCenters} 
                    token={session?.accessToken ?? ""}
                    height={600} 
                    phase={phase} 
                    incidentReports={incidentReports}
                    structureDamageRecords={structureDamageRecords}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-[#232622] rounded-3xl p-5 border border-[#dadad5] dark:border-[#3b3b3b] shadow-sm">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-4">Shelter Directory</h4>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {capacityCenters.slice(0, 8).map((center) => (
                      <div key={center.id} className="p-4 rounded-2xl bg-[#f4f4ef] dark:bg-[#1a1c19] border border-[#dadad5] dark:border-[#3b3b3b]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-sm">{center.name}</p>
                            <p className="text-[10px] text-[#707a6c] uppercase tracking-widest">{center.barangay}, {center.municipality}</p>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full" style={{ background: center.utilizationRate >= 90 ? "#ffdad6" : center.utilizationRate >= 70 ? "#fff3e0" : "#e8f5e9", color: center.utilizationRate >= 90 ? "#ba1a1a" : center.utilizationRate >= 70 ? "#FFB300" : "#2E7D32" }}>
                            {Math.round(center.utilizationRate)}%
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#444743]">
                          <span>{center.currentOccupancy.toLocaleString()} Occupied</span>
                          <span>{center.availableSlots.toLocaleString()} Available</span>
                        </div>
                      </div>
                    ))}
                    {capacityCenters.length === 0 && (
                      <p className="text-sm text-[#707a6c]">No shelter records available yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* BottomNav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 bg-white/90 dark:bg-[#1a1c19]/90 backdrop-blur-2xl border-t border-[#dadad5] shadow-lg rounded-t-3xl">
          <Link href="/site-manager" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'Dashboard' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'Dashboard' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Dashboard</span>
          </Link>
          <Link href="/site-manager/inventory" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'Inventory' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'Inventory' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Inventory</span>
          </Link>
          <Link href="/site-manager/sitemap" className={`flex flex-col items-center justify-center p-3 transition-colors ${activeTab === 'SiteMap' && !showProfile ? 'rounded-2xl bg-[#dadad5]/50 dark:bg-[#3b3b3b]' : 'text-[#444743] dark:text-[#a0a39f]'}`} style={activeTab === 'SiteMap' && !showProfile ? { color: phaseConfig.primaryColor } : {}}>
            <span className="material-symbols-outlined">map</span>
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Site Map</span>
          </Link>
      </nav>

      {/* Item Action Side Panel */}
      {isActionPanelOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsActionPanelOpen(false)}></div>
          <aside className="relative w-full max-w-xl bg-white dark:bg-[#1a1c19] rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] p-12 animate-in zoom-in-95 duration-500 flex flex-col border border-white/20">
            <div className="flex justify-between items-start mb-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: phaseConfig.primaryColor }}></span>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#707a6c]">Internal Registry</span>
                </div>
                <h3 className="text-4xl font-black tracking-tight">Stock Adjustment</h3>
              </div>
              <button onClick={() => setIsActionPanelOpen(false)} className="w-12 h-12 flex items-center justify-center bg-[#f4f4ef] hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Premium Item Header */}
            <div className="bg-[#f4f4ef] dark:bg-[#232622] p-8 rounded-[2.5rem] mb-10 border border-[#dadad5] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <span className="material-symbols-outlined text-8xl rotate-12">{selectedItem.icon}</span>
              </div>
              
              <div className="flex items-center gap-6 mb-8 relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center border border-[#dadad5] shadow-xl">
                   <span className="material-symbols-outlined text-4xl" style={{ color: phaseConfig.primaryColor }}>{selectedItem.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black">{selectedItem.category}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#dadad5] text-[9px] font-black uppercase tracking-widest text-[#444743]">ID: {selectedItem.category.slice(0,3).toUpperCase()}-2026</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest" style={{ background: selectedItem.tone === 'error' ? '#ffdad6' : '#e8f5e9', color: selectedItem.tone === 'error' ? '#ba1a1a' : '#2E7D32' }}>{selectedItem.status}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white">
                   <p className="text-[10px] font-black text-[#707a6c] uppercase tracking-widest mb-1">Live Quantity</p>
                   <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-black">{selectedItem.stock}</span>
                     <span className="text-xs font-bold text-[#707a6c]">Available</span>
                   </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white">
                   <p className="text-[10px] font-black text-[#707a6c] uppercase tracking-widest mb-1">Impact Radius</p>
                   <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-black text-orange-600">High</span>
                     <span className="text-xs font-bold text-[#707a6c]">Zone A</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Input Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
               <div className="space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Manual Override</label>
                 <div className="flex items-center gap-3 bg-[#f4f4ef] p-2 rounded-2xl border border-[#dadad5] shadow-inner">
                   <button 
                     onClick={() => setStockAdjustmentState({ ...stockAdjustmentState, quantity: stockAdjustmentState.quantity - 1 })}
                     className="w-12 h-12 rounded-xl bg-white shadow-sm font-black text-xl hover:scale-105 active:scale-95 transition-all"
                   >-</button>
                   <div className="flex-grow flex flex-col items-center">
                     <input 
                       className="w-full bg-transparent border-none text-center font-black text-2xl focus:ring-0 p-0" 
                       type="number"
                       value={stockAdjustmentState.quantity}
                       onChange={(e) => setStockAdjustmentState({ ...stockAdjustmentState, quantity: parseInt(e.target.value) || 0 })}
                     />
                     <span className="text-[9px] font-black text-[#707a6c] uppercase tracking-tighter">Units</span>
                   </div>
                   <button 
                     onClick={() => setStockAdjustmentState({ ...stockAdjustmentState, quantity: stockAdjustmentState.quantity + 1 })}
                     className="w-12 h-12 rounded-xl bg-white shadow-sm font-black text-xl hover:scale-105 active:scale-95 transition-all"
                   >+</button>
                 </div>
               </div>

               <div className="space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Change Reason</label>
                 <div className="relative group">
                    <CustomSelect
                      value={stockAdjustmentState.reason}
                      onChange={(val: any) => setStockAdjustmentState({ ...stockAdjustmentState, reason: val })}
                      options={[
                        { value: "Distribution Update", label: "Distribution Update" },
                        { value: "Damaged Goods", label: "Damaged Goods" },
                        { value: "Correction/Audit", label: "Correction/Audit" },
                        { value: "Expiry Removal", label: "Expiry Removal" }
                      ]}
                      placeholder="Select reason"
                    />
                  </div>
               </div>

               <div className="md:col-span-2 space-y-3">
                 <label className="text-xs font-black uppercase tracking-[0.15em] text-[#444743] ml-1">Adjustment Notes</label>
                 <textarea 
                    className="w-full bg-[#f4f4ef] border border-[#dadad5] rounded-2xl p-5 text-sm font-medium focus:ring-2 min-h-[100px] transition-all" 
                    placeholder="Provide context for this registry update..."
                    value={stockAdjustmentState.notes}
                    onChange={(e) => setStockAdjustmentState({ ...stockAdjustmentState, notes: e.target.value })}
                    style={{ outlineColor: phaseConfig.primaryColor } as any}
                 ></textarea>
               </div>
            </div>

            {stockAdjustmentError && (
              <p className="text-red-600 text-sm mb-4">{stockAdjustmentError}</p>
            )}

            {/* Bottom Actions */}
            <div className="flex gap-4 mt-auto">
              <button 
                onClick={() => setIsActionPanelOpen(false)} 
                className="flex-1 bg-[#f4f4ef] text-[#444743] py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-[#eeeeea] active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmStockAdjustment}
                disabled={isSubmittingStockAdjustment}
                className="flex-[2] text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed" 
                style={{ background: `linear-gradient(135deg, ${phaseConfig.primaryColor}, ${phaseConfig.primaryContainer})` }}
              >
                {isSubmittingStockAdjustment ? 'Processing...' : 'Confirm Update'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* QR Scan Citizen Confirmation Modal */}
      {scanModalOpen && scannedCitizen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setScanModalOpen(false); scanLockRef.current = false; }} />
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
                {scannedCitizen.familySize && (
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setCheckOutModalOpen(false); scanLockRef.current = false; }} />
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

      {/* Receive Goods Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsReceiveModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-[#1a1c19] w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black mb-2">New Shipment Intake</h3>
                <p className="text-[#444743] text-sm font-medium">Scan or manually enter physical relief goods being received at this site.</p>
              </div>
              <button onClick={() => setIsReceiveModalOpen(false)} className="material-symbols-outlined p-2 hover:bg-[#f4f4ef] rounded-full">close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="h-64 bg-[#1a1c19] rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer border-4 border-dashed border-white/20 hover:border-white/40 transition-colors">
                  <span className="material-symbols-outlined text-5xl text-white/40 mb-4 group-hover:scale-110 transition-transform">qr_code_scanner</span>
                  <p className="text-white/60 font-black text-xs uppercase tracking-widest">Open Scanner</p>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Inventory Item</label>
                    <CustomSelect
                      value={receiveGoodsState.itemId}
                      onChange={(val: any) => setReceiveGoodsState({ ...receiveGoodsState, itemId: val })}
                      options={inventoryItems.map((item) => ({ value: item.id, label: item.name }))}
                      placeholder="Select item"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Quantity Received</label>
                    <input
                      className="w-full bg-[#f4f4ef] border-none rounded-xl h-12 px-4 font-bold"
                      placeholder="e.g. 50"
                      type="number"
                      min="1"
                      value={receiveGoodsState.quantity}
                      onChange={(e) => setReceiveGoodsState({ ...receiveGoodsState, quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Arrival Terminal</label>
                    <input 
                      className="w-full bg-[#f4f4ef] border-none rounded-xl h-12 px-4 font-bold" 
                      placeholder="e.g. North Dock 4"
                      value={receiveGoodsState.arrivalTerminal}
                      onChange={(e) => setReceiveGoodsState({ ...receiveGoodsState, arrivalTerminal: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Waybill Number</label>
                    <input 
                      className="w-full bg-[#f4f4ef] border-none rounded-xl h-12 px-4 font-bold" 
                      placeholder="WB-9982-X"
                      value={receiveGoodsState.waybillNumber}
                      onChange={(e) => setReceiveGoodsState({ ...receiveGoodsState, waybillNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444743] ml-1">Condition</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => setReceiveGoodsState({ ...receiveGoodsState, condition: "Intact" })}
                        className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          receiveGoodsState.condition === "Intact"
                            ? "bg-green-100 text-green-700 border-2 border-green-500"
                            : "bg-[#f4f4ef] text-[#444743]"
                        }`}
                      >
                        Intact
                      </button>
                      <button 
                        onClick={() => setReceiveGoodsState({ ...receiveGoodsState, condition: "Minor" })}
                        className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          receiveGoodsState.condition === "Minor"
                            ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-500"
                            : "bg-[#f4f4ef] text-[#444743]"
                        }`}
                      >
                        Minor
                      </button>
                      <button 
                        onClick={() => setReceiveGoodsState({ ...receiveGoodsState, condition: "Damaged" })}
                        className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          receiveGoodsState.condition === "Damaged"
                            ? "bg-red-100 text-red-700 border-2 border-red-500"
                            : "bg-[#f4f4ef] text-[#444743]"
                        }`}
                      >
                        Damaged
                      </button>
                    </div>
                  </div>
               </div>
            </div>

            {receiveGoodsError && (
              <p className="text-red-600 text-sm mb-4 mt-4">{receiveGoodsError}</p>
            )}

            <div className="mt-10 flex gap-4">
               <button 
                 onClick={() => setIsReceiveModalOpen(false)} 
                 className="flex-1 bg-[#f4f4ef] py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleReceiveGoods}
                 disabled={isSubmittingReceiveGoods}
                 className="flex-[2] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50" 
                 style={{ background: phaseConfig.primaryColor }}
               >
                 {isSubmittingReceiveGoods ? "Processing..." : "Log Physical Intake"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteManagerDashboard;
