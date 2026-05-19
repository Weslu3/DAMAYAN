import React, { useState, useEffect, useRef, useCallback } from "react";
import { Alert, Animated, Text, TextInput, View, StyleSheet, ScrollView, Pressable, Modal, TouchableOpacity, Image, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native";
import { theme, fonts, lightTheme, darkTheme } from "../../theme";
import { createIncidentReport, createManualCheckIn, getInventory, getCitizenByQrCode, getCapacity, getCheckInByQrCode, checkOutById } from "../../api";
import { loadSession } from "../../session";
import { parseScannedPayload, getInitials } from "../qr/qr-utils";
import type { AuthSession } from "../../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const INCIDENT_TYPE_OPTIONS = [
  "Medical Emergency",
  "Supply Shortage",
  "Infrastructure Damage",
  "Security Issue",
  "Evacuation Request",
];

// ── Scan mode type ────────────────────────────────────────────────────────────
type ScanMode = "check-in" | "check-out";

export function SiteManagerDuringScreen({
  onBack,
  isDarkMode,
  onEnterRecovery,
}: {
  onBack: () => void;
  isDarkMode?: boolean;
  onEnterRecovery: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [incidentType, setIncidentType] = useState("Medical Emergency");
  const [severity, setSeverity] = useState<"CRITICAL" | "HIGH" | "MODERATE">("CRITICAL");
  const [manualId, setManualId] = useState("");
  const [manualZone, setManualZone] = useState("");
  const [manualGroupSize, setManualGroupSize] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  // ── Full-screen QR Scanner state (mirrors web version) ────────────────────
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>("check-in");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedCitizen, setScannedCitizen] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkOutRecord, setCheckOutRecord] = useState<any>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [isSubmittingCheckOut, setIsSubmittingCheckOut] = useState(false);
  const scanLockRef = useRef(false);

  // ── Evacuation Center & Scan Details state ───────────────────────────────
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [isCenterPickerOpen, setIsCenterPickerOpen] = useState(false);
  const [scannedGroupSize, setScannedGroupSize] = useState("");

  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const localStyles = getStyles(currentTheme);

  useEffect(() => {
    loadSession()
      .then((stored) => setSession(stored))
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (session?.accessToken) {
      getCapacity(session.accessToken)
        .then(setCenters)
        .catch(console.error);
    }
  }, [session]);

  // ── Open full-screen camera ───────────────────────────────────────────────
  const openCamera = useCallback(async (mode: ScanMode) => {
    if (mode === "check-in" && !selectedCenterId) {
      Alert.alert("Missing Information", "Please select an Evacuation Center first.");
      return;
    }

    const perm = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!perm?.granted) {
      Alert.alert("Camera denied", "Camera permission is required for QR scanning.");
      return;
    }
    setScanMode(mode);
    setScanError(null);
    setScannedCitizen(null);
    setScannedGroupSize("");
    scanLockRef.current = false;
    setIsCameraOpen(true);
  }, [cameraPermission, requestCameraPermission, selectedCenterId]);

  // ── Handle QR barcode scan (same logic as web handleScan) ─────────────────
  const onBarcodeScanned = useCallback(async (event: { data?: string }) => {
    if (scanLockRef.current || isProcessing) return;
    const raw = event.data?.trim();
    if (!raw) return;
    const qrCodeId = parseScannedPayload(raw);
    if (!qrCodeId) return;

    scanLockRef.current = true;
    setIsProcessing(true);
    setIsCameraOpen(false);

    if (!session?.accessToken) {
      Alert.alert("Session expired", "Please sign in again.");
      setIsProcessing(false);
      return;
    }

    try {
      // Look up citizen profile (same as web getCitizenByQrCode)
      const citizen = await getCitizenByQrCode(session.accessToken, qrCodeId);

      if (!citizen) {
        setScanError(`No citizen found for QR: ${qrCodeId}`);
        scanLockRef.current = false;
        setIsProcessing(false);
        return;
      }

      setScannedCitizen({ ...citizen, _qrCodeId: qrCodeId });
      setScanError(null);

      if (scanMode === "check-in") {
        setCheckInModalOpen(true);
      } else {
        const record = await getCheckInByQrCode(session.accessToken, qrCodeId);
        if (!record) {
          setScanError(`No active check-in found for QR: ${qrCodeId}`);
          scanLockRef.current = false;
          setIsProcessing(false);
          return;
        }
        setCheckOutRecord(record);
        setCheckOutModalOpen(true);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to look up citizen.");
      scanLockRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, session, scanMode]);

  // ── Confirm Check-In (mirrors web handleScan → handleSubmitManualCheckIn) ─
  const handleConfirmCheckIn = async () => {
    if (!session?.accessToken || !scannedCitizen) return;
    setIsSubmittingCheckIn(true);
    try {
      // Use the same endpoint as the web: createManualCheckIn with QR citizen data
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: scannedCitizen._qrCodeId,
        firstName: scannedCitizen.firstName || scannedCitizen.fullName?.split(" ")[0] || "",
        zone: scannedCitizen.zone || "",
        location: "Site Manager Mobile Check-in",
        centerId: selectedCenterId,
        familySize: parseInt(scannedGroupSize) || scannedCitizen.familySize || undefined,
      });
      const name = scannedCitizen.fullName || `${scannedCitizen.firstName} ${scannedCitizen.lastName}`;
      setCheckInModalOpen(false);
      setScannedCitizen(null);
      scanLockRef.current = false;
      Alert.alert("✅ Checked In", `${name} has been checked in successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check-in failed.";
      Alert.alert("Check-in failed", msg);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  // ── Confirm Check-Out ─────────────────────────────────────────────────────
  const handleConfirmCheckOut = async () => {
    if (!session?.accessToken || !scannedCitizen || !checkOutRecord) return;
    setIsSubmittingCheckOut(true);
    try {
      await checkOutById(session.accessToken, checkOutRecord.evacueeId);
      setCheckOutModalOpen(false);
      setScannedCitizen(null);
      setCheckOutRecord(null);
      scanLockRef.current = false;
      Alert.alert("✅ Checked Out", `${scannedCitizen.fullName || scannedCitizen.firstName} has been checked out.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check-out failed.";
      Alert.alert("Check-out failed", msg);
    } finally {
      setIsSubmittingCheckOut(false);
    }
  };

  const handleManualCheckIn = async () => {
    if (!session?.accessToken) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }
    if (!manualId.trim()) {
      Alert.alert("Missing ID", "Please enter a citizen name or ID.");
      return;
    }
    try {
      await createManualCheckIn(session.accessToken, {
        evacueeNumber: manualId.trim(),
        firstName: manualId.split(" ")[0] || "",
        zone: manualZone.trim() || "",
        location: "Site Manager Mobile Check-in",
        centerId: selectedCenterId || undefined,
        familySize: Number(manualGroupSize) > 0 ? Number(manualGroupSize) : undefined,
      });
      setManualId("");
      setManualZone("");
      setManualGroupSize("");
      Alert.alert("Success", "Check-in recorded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to record check-in";
      Alert.alert("Check-in failed", message);
    }
  };

  const handleSubmitIncident = async () => {
    if (!session?.accessToken || !session.user) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }

    if (!incidentDescription.trim()) {
      Alert.alert("Missing details", "Please add incident details before submitting.");
      return;
    }

    try {
      await createIncidentReport(session.accessToken, {
        disasterId: "current-disaster",
        reportedBy: session.user.email || "System",
        title: incidentType,
        content: incidentDescription,
        severity,
        location: "Central Site",
      });

      setIncidentDescription("");
      Alert.alert("Success", "Incident report submitted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit incident";
      Alert.alert("Submit failed", message);
    }
  };

  const handleRefreshInventory = async () => {
    if (!session?.accessToken) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }

    try {
      const inventory = await getInventory("site-manager", session.accessToken);
      Alert.alert("Inventory updated", `${inventory.length} items synced.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update inventory";
      Alert.alert("Update failed", message);
    }
  };

  return (
    <ScrollView
      style={localStyles.container}
      contentContainerStyle={localStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={localStyles.headerRow}>
        <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={localStyles.statusBadge}>
            <View style={localStyles.statusDot} />
            <Text style={localStyles.statusBadgeText}>ACTIVE RESPONSE MODE</Text>
          </View>
          <Text style={localStyles.dashboardTitle}>Live Status Map{"\n"}& Command</Text>
          <Text style={localStyles.dashboardSub}>
            Live operational view of Typhoon 09B impact zone. Resources are being prioritized for Zone A-4 flooding.
          </Text>
        </View>
        <View style={localStyles.scoreCard}>
          <Text style={localStyles.scoreValue}>04:22</Text>
          <Text style={localStyles.scoreLabel}>CRITICAL WINDOW</Text>
        </View>
      </View>

      <View style={localStyles.mainSection}>
        {/* Emergency Operational Guide */}
        <View style={localStyles.checklistSection}>
          <View style={localStyles.sectionHeaderRow}>
            <View>
              <Text style={localStyles.sectionTitle}>Emergency Operational Guide</Text>
              <Text style={localStyles.sectionSub}>This view follows the daily process: evacuee arrival, identity capture, and relief distribution.</Text>
            </View>
            <View style={localStyles.priorityBadge}>
              <Ionicons name="shield-checkmark" size={14} color={currentTheme.warning} />
              <Text style={localStyles.priorityText}>Priority Status</Text>
            </View>
          </View>

          <View style={localStyles.checklistGrid}>
            <View style={localStyles.readinessCheckCard}>
              <View style={localStyles.checkIconWrap}>
                <Ionicons name="qr-code" size={32} color={currentTheme.warning} />
              </View>
              <Text style={localStyles.checkTitle}>Identity Verification</Text>
              <Text style={localStyles.checkDesc}>Active intake: select your center and scan QR codes.</Text>

              {/* Evacuation Center Selector */}
              <View style={{ width: "100%", marginTop: 8 }}>
                <Text style={{ fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 6 }}>EVACUATION CENTER</Text>
                <TouchableOpacity
                  style={{ height: 50, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: theme.line, justifyContent: "center", paddingHorizontal: 16 }}
                  onPress={() => setIsCenterPickerOpen(true)}
                >
                  <Text style={{ fontSize: 13, ...fonts.bold, color: selectedCenterId ? theme.text : theme.textLight }}>
                    {selectedCenterId ? centers.find(c => c.id === selectedCenterId)?.name || "Unknown Center" : "Select Evacuation Center"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={localStyles.scannerTabs}>
                <TouchableOpacity
                  onPress={() => {
                    setActiveTab("scan");
                  }}
                  style={activeTab === "scan" ? localStyles.scannerTabActive : localStyles.scannerTab}
                >
                  <Text style={activeTab === "scan" ? localStyles.scannerTabTextActive : localStyles.scannerTabText}>Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setActiveTab("manual");
                    setIsCameraOpen(false);
                  }}
                  style={activeTab === "manual" ? localStyles.scannerTabActive : localStyles.scannerTab}
                >
                  <Text style={activeTab === "manual" ? localStyles.scannerTabTextActive : localStyles.scannerTabText}>Manual ID</Text>
                </TouchableOpacity>
              </View>

              {activeTab === "scan" ? (
                <>
                  {/* Error message */}
                  {scanError && (
                    <View style={{ backgroundColor: "#FFEBEE", padding: 12, borderRadius: 12, marginBottom: 12, width: "100%" }}>
                      <Text style={{ color: "#D32F2F", ...fonts.medium, textAlign: "center" }}>{scanError}</Text>
                      <TouchableOpacity onPress={() => { setScanError(null); scanLockRef.current = false; }} style={{ marginTop: 8 }}>
                        <Text style={{ color: "#D32F2F", ...fonts.bold, textAlign: "center" }}>Try Again</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Processing state */}
                  {isProcessing && (
                    <View style={{ backgroundColor: "#E3F2FD", padding: 12, borderRadius: 12, marginBottom: 12, width: "100%", alignItems: "center" }}>
                      <Text style={{ color: "#1565C0", ...fonts.bold }}>Looking up citizen...</Text>
                    </View>
                  )}

                  {/* Check-In scanner button */}
                  <TouchableOpacity
                    style={[localStyles.scanActionButton, { width: "100%", backgroundColor: "#FFB300", flexDirection: "row", justifyContent: "center", gap: 8 }]}
                    onPress={() => openCamera("check-in")}
                  >
                    <Ionicons name="qr-code-outline" size={18} color="#fff" />
                    <Text style={localStyles.scanActionButtonText}>SCAN QR TO CHECK-IN</Text>
                  </TouchableOpacity>

                  {/* Check-Out scanner button */}
                  <TouchableOpacity
                    style={[localStyles.scanActionButton, { width: "100%", marginTop: 10, backgroundColor: "#1A1C1A", flexDirection: "row", justifyContent: "center", gap: 8 }]}
                    onPress={() => openCamera("check-out")}
                  >
                    <Ionicons name="exit-outline" size={18} color="#fff" />
                    <Text style={localStyles.scanActionButtonText}>SCAN QR TO CHECK-OUT</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={localStyles.manualForm}>
                  <View style={localStyles.inputWrapper}>
                    <TextInput
                      value={manualId}
                      onChangeText={setManualId}
                      placeholder="Citizen Name or ID..."
                      placeholderTextColor={currentTheme.textLight}
                      style={localStyles.manualInput}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[localStyles.inputWrapper, { flex: 1 }]}>
                      <TextInput
                        value={manualZone}
                        onChangeText={setManualZone}
                        placeholder="Zone"
                        placeholderTextColor={currentTheme.textLight}
                        style={localStyles.manualInput}
                      />
                    </View>
                    <View style={[localStyles.inputWrapper, { flex: 1 }]}>
                      <TextInput
                        value={manualGroupSize}
                        onChangeText={setManualGroupSize}
                        placeholder="Group Size"
                        placeholderTextColor={currentTheme.textLight}
                        keyboardType="numeric"
                        style={localStyles.manualInput}
                      />
                    </View>
                  </View>
                </View>
              )}

              {activeTab === "manual" && (
                <TouchableOpacity style={localStyles.logStatusBtn} onPress={handleManualCheckIn}>
                  <Text style={localStyles.logStatusText}>Confirm Check-in</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={localStyles.essentialTasksCard}>
              <View style={localStyles.tasksHeader}>
                <Ionicons name="list" size={20} color={currentTheme.warning} />
                <Text style={localStyles.tasksTitle}>Essential Tasks</Text>
              </View>
              <View style={localStyles.taskRow}>
                <Text style={localStyles.taskLabel}>Inventory Validation</Text>
                <View style={[localStyles.taskPill, { backgroundColor: '#E8F5E9' }]}><Text style={[localStyles.taskPillText, { color: '#2E7D32' }]}>READY</Text></View>
              </View>
              <View style={localStyles.taskRow}>
                <Text style={localStyles.taskLabel}>Comms Stabilization</Text>
                <View style={[localStyles.taskPill, { backgroundColor: '#E3F2FD' }]}><Text style={[localStyles.taskPillText, { color: '#1976D2' }]}>ACTIVE</Text></View>
              </View>
              <View style={localStyles.taskRow}>
                <Text style={localStyles.taskLabel}>Volunteer Briefing</Text>
                <View style={[localStyles.taskPill, { backgroundColor: '#F1F8E9' }]}><Text style={[localStyles.taskPillText, { color: '#689F38' }]}>COMPLETE</Text></View>
              </View>
              <View style={localStyles.divider} />
              <Text style={localStyles.protocolLabel}>PROTOCOL NOTE</Text>
              <Text style={localStyles.protocolText}>"All resource reallocations must be synced to the central hub within 5 minutes of physical movement."</Text>
            </View>
          </View>
        </View>

        {/* Side Content */}
        <View style={localStyles.sideContent}>
          <View style={localStyles.liveActivityCard}>
            <View style={localStyles.liveHeader}>
              <Ionicons name="stats-chart" size={18} color={currentTheme.warning} />
              <Text style={localStyles.liveTitle}>Live Activity</Text>
            </View>
            <View style={localStyles.activityItem}>
              <View style={localStyles.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={localStyles.activityTime}>08:45 AM</Text>
                <Text style={localStyles.activityDesc}>Convoy Gamma arrived at Northern Staging.</Text>
              </View>
            </View>
            <View style={localStyles.activityItem}>
              <View style={localStyles.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={localStyles.activityTime}>07:12 AM</Text>
                <Text style={localStyles.activityDesc}>Satellite uplink stabilized at Sector 4.</Text>
              </View>
            </View>
            <View style={localStyles.activityItem}>
              <View style={[localStyles.activityDot, { backgroundColor: '#7D867B' }]} />
              <View style={{ flex: 1 }}>
                <Text style={localStyles.activityTime}>YESTERDAY</Text>
                <Text style={localStyles.activityDesc}>Evacuation initiated for Cluster B.</Text>
              </View>
            </View>
          </View>

          <View style={localStyles.siteMapCard}>
            <View style={localStyles.siteMapContent}>
              <Text style={localStyles.siteMapTitle}>Interactive Site Map</Text>
              <Text style={localStyles.siteMapSub}>REAL-TIME ZONE ACTIVITY MONITOR</Text>
            </View>
            <Image
              source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3K_4K9H0L_9E_9N_K7L9B8v8V-p_H_p7h-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v" }}
              style={localStyles.siteMapImage}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>

      {/* Report Site Incident */}
      <View style={localStyles.incidentSection}>
        <View style={localStyles.sectionHeaderRow}>
          <View>
            <Text style={localStyles.sectionTitle}>Report Site Incident</Text>
            <Text style={localStyles.sectionSub}>Log critical events or medical emergencies immediately.</Text>
          </View>
          <View style={localStyles.activeAlertsBadge}>
            <Text style={localStyles.activeAlertsText}>3 ACTIVE ALERTS</Text>
          </View>
        </View>

        <View style={localStyles.incidentFormRow}>
          <View style={localStyles.pickerContainer}>
            <Text style={localStyles.inputLabel}>INCIDENT TYPE</Text>
            <TouchableOpacity style={localStyles.pickerBox} onPress={() => setIsTypeModalOpen(true)}>
              <Text style={localStyles.pickerText}>{incidentType}</Text>
              <Text style={localStyles.pickerHint}>Tap to select</Text>
            </TouchableOpacity>
          </View>

          <View style={localStyles.severityContainer}>
            <Text style={localStyles.inputLabel}>SEVERITY</Text>
            <View style={localStyles.severityRow}>
              {["CRITICAL", "HIGH", "MODERATE"].map((s) => {
                const isActive = severity === s;
                const color = s === 'CRITICAL' ? '#D32F2F' : s === 'HIGH' ? '#FFB300' : '#2E7D32';
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSeverity(s as any)}
                    style={[
                      localStyles.severityBtn,
                      { backgroundColor: isActive ? color : currentTheme.surfaceAlt, borderColor: isActive ? color : currentTheme.line, borderWidth: 1 },
                      isActive && { shadowColor: color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }
                    ]}
                  >
                    <Text style={[
                      localStyles.severityBtnText,
                      { color: isActive ? "#fff" : currentTheme.textLight }
                    ]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={localStyles.inputLabel}>DETAILED DESCRIPTION</Text>
          <View style={localStyles.textArea}>
            <TextInput
              value={incidentDescription}
              onChangeText={setIncidentDescription}
              placeholder="Describe the situation..."
              placeholderTextColor={currentTheme.textLight}
              multiline
              style={localStyles.textAreaInput}
            />
          </View>
        </View>

        <TouchableOpacity style={[localStyles.submitBtn, { flexDirection: 'row' }]} onPress={handleSubmitIncident}>
          <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 10 }} />
          <Text style={localStyles.submitBtnText}>Submit Incident Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[localStyles.submitBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: currentTheme.line, marginTop: 12, flexDirection: 'row' }]}
          onPress={onEnterRecovery}
        >
          <Ionicons name="arrow-forward" size={16} color={currentTheme.text} style={{ marginRight: 10 }} />
          <Text style={[localStyles.submitBtnText, { color: currentTheme.text }]}>Transition to Recovery Mode</Text>
        </TouchableOpacity>
      </View>

      {/* Supply Checklist */}
      <View style={[localStyles.supplySection, { marginTop: 24 }]}>
        <View style={localStyles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.sectionTitle}>Essential Supply Checklist</Text>
            <Text style={localStyles.sectionSub}>Real-time inventory levels across regional staging areas.</Text>
          </View>
          <TouchableOpacity style={[localStyles.updateInventoryBtn, { backgroundColor: '#FFB300' }]} onPress={handleRefreshInventory}>
            <Text style={localStyles.updateInventoryText}>Update Inventory</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.supplyScroll}>
          {[
            { label: "P", name: "Potable Water", status: "SECURE", val: "92% AVAIL", progress: 0.92, color: "#FFB300" },
            { label: "T", name: "Trauma Kits", status: "CRITICAL", val: "12% LOW", progress: 0.12, color: "#D32F2F" },
            { label: "M", name: "Mobile Power", status: "SECURE", val: "84% AVAIL", progress: 0.84, color: "#FFB300" },
          ].map((item, idx) => (
            <View key={idx} style={localStyles.supplyCard}>
              <View style={localStyles.supplyCardTop}>
                <View style={[localStyles.supplyLabelBox, { backgroundColor: item.color }]}>
                  <Text style={localStyles.supplyLabelText}>{item.label}</Text>
                </View>
                <View style={[localStyles.supplyStatusBadge, { backgroundColor: item.status === "SECURE" ? "#E8F5E9" : "#FFEBEE" }]}>
                  <Text style={[localStyles.supplyStatusText, { color: item.status === "SECURE" ? "#2E7D32" : "#D32F2F" }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={localStyles.supplyCardName}>{item.name}</Text>
              <Text style={localStyles.supplyCardVal}>{item.val}</Text>
              <View style={localStyles.supplyProgressTrack}>
                <View style={[localStyles.supplyProgressFill, { width: `${item.progress * 100}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <Modal visible={isTypeModalOpen} transparent animationType="fade">
        <Pressable style={localStyles.typePickerOverlay} onPress={() => setIsTypeModalOpen(false)}>
          <View style={localStyles.typePickerCard}>
            <Text style={localStyles.typePickerTitle}>Select Incident Type</Text>
            {INCIDENT_TYPE_OPTIONS.map((option) => {
              const selected = option === incidentType;
              return (
                <TouchableOpacity
                  key={option}
                  style={[localStyles.typePickerOption, selected && localStyles.typePickerOptionActive]}
                  onPress={() => {
                    setIncidentType(option);
                    setIsTypeModalOpen(false);
                  }}
                >
                  <Text style={[localStyles.typePickerOptionText, selected && localStyles.typePickerOptionTextActive]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ── Evacuation Center Picker Modal ──────────────────────────────── */}
      <Modal visible={isCenterPickerOpen} transparent animationType="fade">
        <Pressable style={localStyles.typePickerOverlay} onPress={() => setIsCenterPickerOpen(false)}>
          <View style={localStyles.typePickerCard}>
            <Text style={localStyles.typePickerTitle}>Select Evacuation Center</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {centers.map((center) => {
                const selected = center.id === selectedCenterId;
                return (
                  <TouchableOpacity
                    key={center.id}
                    style={[localStyles.typePickerOption, selected && localStyles.typePickerOptionActive]}
                    onPress={() => {
                      setSelectedCenterId(center.id);
                      setIsCenterPickerOpen(false);
                    }}
                  >
                    <Text style={[localStyles.typePickerOptionText, selected && localStyles.typePickerOptionTextActive]}>{center.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {centers.length === 0 && (
                <Text style={{ textAlign: "center", color: theme.textMuted, marginVertical: 20 }}>No evacuation centers found.</Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── Full-Screen QR Camera Modal ─────────────────────────────────── */}
      <Modal visible={isCameraOpen} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <StatusBar style="light" />
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          {/* Overlay UI */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
          }}>
            {/* Corner frame */}
            <View style={{
              width: 260, height: 260,
              borderRadius: 24,
              borderWidth: 3,
              borderColor: scanMode === "check-in" ? "#FFB300" : "#81C784",
              shadowColor: scanMode === "check-in" ? "#FFB300" : "#81C784",
              shadowOpacity: 0.8,
              shadowRadius: 20,
            }} />
            <Text style={{
              marginTop: 24,
              color: "#fff",
              fontSize: 14,
              fontWeight: "700",
              letterSpacing: 1,
              textAlign: "center",
            }}>
              {scanMode === "check-in" ? "SCAN CITIZEN QR TO CHECK IN" : "SCAN CITIZEN QR TO CHECK OUT"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 6 }}>
              Point camera at the citizen's QR code
            </Text>
          </View>
          {/* Close button */}
          <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <TouchableOpacity
              onPress={() => { setIsCameraOpen(false); scanLockRef.current = false; }}
              style={{
                margin: 20,
                width: 48, height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Check-In Confirm Modal ──────────────────────────────────────── */}
      <Modal visible={checkInModalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            padding: 32,
            paddingBottom: 48,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "900", letterSpacing: 2, color: "#FFB300", marginBottom: 16 }}>CHECK-IN CONFIRMATION</Text>
            {scannedCitizen && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, padding: 16, backgroundColor: "#F9FBE7", borderRadius: 20 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFB300", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
                    {getInitials(scannedCitizen.fullName || `${scannedCitizen.firstName} ${scannedCitizen.lastName}`)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#1A1C1A" }}>
                    {scannedCitizen.fullName || `${scannedCitizen.firstName} ${scannedCitizen.lastName}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>QR: {scannedCitizen._qrCodeId}</Text>
                  {scannedCitizen.registrationType && (
                    <Text style={{ fontSize: 11, color: "#FFB300", fontWeight: "700", marginTop: 4 }}>{scannedCitizen.registrationType.toUpperCase()}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Group Size Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 10, ...fonts.black, color: "#666", letterSpacing: 1, marginBottom: 8 }}>GROUP SIZE (INCLUDING HEAD)</Text>
              <TextInput
                value={scannedGroupSize}
                onChangeText={setScannedGroupSize}
                placeholder={scannedCitizen?.familySize ? String(scannedCitizen.familySize) : "1"}
                placeholderTextColor="#999"
                keyboardType="numeric"
                style={{
                  backgroundColor: "#F5F5F5",
                  height: 56,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  fontSize: 16,
                  ...fonts.bold,
                  color: "#1A1C1A",
                }}
              />
            </View>

            <TouchableOpacity
              onPress={handleConfirmCheckIn}
              disabled={isSubmittingCheckIn}
              style={{
                backgroundColor: "#FFB300",
                padding: 18,
                borderRadius: 20,
                alignItems: "center",
                opacity: isSubmittingCheckIn ? 0.6 : 1,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 }}>
                {isSubmittingCheckIn ? "CHECKING IN..." : "CONFIRM CHECK-IN"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setCheckInModalOpen(false); setScannedCitizen(null); scanLockRef.current = false; }}
              style={{ padding: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#666", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Check-Out Confirm Modal ─────────────────────────────────────── */}
      <Modal visible={checkOutModalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            padding: 32,
            paddingBottom: 48,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "900", letterSpacing: 2, color: "#2E7D32", marginBottom: 16 }}>CHECK-OUT CONFIRMATION</Text>
            {scannedCitizen && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, padding: 16, backgroundColor: "#E8F5E9", borderRadius: 20 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#4CAF50", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
                    {getInitials(scannedCitizen.fullName || `${scannedCitizen.firstName} ${scannedCitizen.lastName}`)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#1A1C1A" }}>
                    {scannedCitizen.fullName || `${scannedCitizen.firstName} ${scannedCitizen.lastName}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>QR: {scannedCitizen._qrCodeId}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              onPress={handleConfirmCheckOut}
              disabled={isSubmittingCheckOut}
              style={{
                backgroundColor: "#4CAF50",
                padding: 18,
                borderRadius: 20,
                alignItems: "center",
                opacity: isSubmittingCheckOut ? 0.6 : 1,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 }}>
                {isSubmittingCheckOut ? "CHECKING OUT..." : "CONFIRM CHECK-OUT"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setCheckOutModalOpen(false); setScannedCitizen(null); scanLockRef.current = false; }}
              style={{ padding: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#666", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 160 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 32 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center", marginTop: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.warning },
  statusBadgeText: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1 },
  dashboardTitle: { fontSize: 36, ...fonts.black, color: theme.text, letterSpacing: -1.5, lineHeight: 42 },
  dashboardSub: { fontSize: 14, ...fonts.medium, color: theme.textMuted, marginTop: 8, lineHeight: 20 },
  scoreCard: { backgroundColor: "#fff", padding: 16, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line, width: 110 },
  scoreValue: { fontSize: 22, ...fonts.black, color: theme.warning },
  scoreLabel: { fontSize: 8, ...fonts.black, color: theme.textLight, letterSpacing: 1, textAlign: "center" },

  mainSection: { gap: 24, marginBottom: 40 },
  checklistSection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  sectionTitle: { fontSize: 22, ...fonts.black, color: theme.text },
  sectionSub: { fontSize: 13, ...fonts.medium, color: theme.textMuted, marginTop: 4 },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  priorityText: { fontSize: 10, ...fonts.black, color: theme.text, letterSpacing: 0.5 },

  checklistGrid: { flexDirection: "column", gap: 16 },
  readinessCheckCard: { backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, alignItems: "center", gap: 12 },
  checkIconWrap: { width: 64, height: 64, borderRadius: 24, backgroundColor: "rgba(255, 179, 0, 0.05)", alignItems: "center", justifyContent: "center" },
  checkTitle: { fontSize: 18, ...fonts.black, color: theme.text },
  checkDesc: { fontSize: 12, ...fonts.medium, color: theme.textMuted, textAlign: "center", lineHeight: 18 },

  scannerTabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 12, padding: 4, width: "100%", marginTop: 8 },
  scannerTabActive: { flex: 1, backgroundColor: "#fff", paddingVertical: 8, borderRadius: 8, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  scannerTab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  scannerTabTextActive: { fontSize: 11, ...fonts.black, color: theme.text },
  scannerTabText: { fontSize: 11, ...fonts.bold, color: theme.textLight },

  viewfinder: { width: "100%", height: 120, backgroundColor: "#000", borderRadius: 16, marginTop: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cameraView: { width: "100%", height: "100%" },
  viewfinderFrame: { width: "80%", height: "60%", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderStyle: "dashed", borderRadius: 8 },
  scannerBeam: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "red", shadowColor: "red", shadowOpacity: 1, shadowRadius: 10 },
  viewfinderText: { position: "absolute", bottom: 10, fontSize: 8, ...fonts.black, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  scanActionButton: { marginTop: 10, backgroundColor: "#1A1C1A", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  scanActionButtonText: { color: "#fff", fontSize: 11, ...fonts.black, letterSpacing: 0.6, textTransform: "uppercase" },

  logStatusBtn: { backgroundColor: "#FFB300", paddingHorizontal: 20, paddingVertical: 18, borderRadius: 16, width: "100%", alignItems: "center", marginTop: 12, shadowColor: "#FFB300", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logStatusText: { color: "#fff", ...fonts.black, fontSize: 14, letterSpacing: 0.5 },

  manualForm: { width: "100%", gap: 12, marginTop: 12 },
  inputWrapper: { height: 56, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: theme.line, justifyContent: "center", paddingHorizontal: 20 },
  manualInput: { fontSize: 14, color: theme.text, ...fonts.medium },
  manualInputPlaceholder: { fontSize: 14, color: theme.textLight, ...fonts.medium },

  essentialTasksCard: { backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, marginTop: 12 },
  tasksHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  tasksTitle: { fontSize: 16, ...fonts.black, color: theme.text },
  taskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 },
  taskLabel: { fontSize: 13, ...fonts.medium, color: theme.text, flex: 1 },
  taskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  taskPillText: { fontSize: 9, ...fonts.black },
  divider: { height: 1, backgroundColor: theme.line, marginVertical: 16 },
  protocolLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 8 },
  protocolText: { fontSize: 11, ...fonts.medium, color: theme.textMuted, fontStyle: "italic", lineHeight: 16 },

  sideContent: { gap: 24 },
  liveActivityCard: { backgroundColor: "#1A1C1A", borderRadius: 40, padding: 32 },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  liveTitle: { fontSize: 18, ...fonts.black, color: "#fff" },
  activityItem: { flexDirection: "row", gap: 16, marginBottom: 20 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.warning, marginTop: 6 },
  activityTime: { fontSize: 12, ...fonts.black, color: "#fff" },
  activityDesc: { fontSize: 13, color: "rgba(255,255,255,0.7)", ...fonts.medium, marginTop: 2 },

  siteMapCard: { borderRadius: 40, overflow: "hidden", height: 200, backgroundColor: theme.surfaceAlt },
  siteMapContent: { position: "absolute", zIndex: 1, top: 24, left: 24, backgroundColor: "rgba(255,255,255,0.9)", padding: 16, borderRadius: 16 },
  siteMapTitle: { fontSize: 15, ...fonts.black, color: theme.text },
  siteMapSub: { fontSize: 9, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginTop: 4 },
  siteMapImage: { width: "100%", height: "100%", opacity: 0.8 },

  incidentSection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  activeAlertsBadge: { backgroundColor: "#FFF3E0", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  activeAlertsText: { fontSize: 10, ...fonts.black, color: "#E65100", letterSpacing: 0.5 },
  incidentFormRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 24 },
  inputLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 8 },
  pickerContainer: { flex: 1.5, minWidth: 200 },
  pickerBox: { height: 56, backgroundColor: theme.surfaceAlt, borderRadius: 16, justifyContent: "center", paddingHorizontal: 20, borderWidth: 1, borderColor: theme.line },
  pickerText: { fontSize: 14, ...fonts.bold, color: theme.text },
  pickerHint: { fontSize: 9, ...fonts.black, color: theme.textLight, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  typePickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 24 },
  typePickerCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: theme.line },
  typePickerTitle: { fontSize: 14, ...fonts.black, color: theme.text, marginBottom: 12 },
  typePickerOption: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.line },
  typePickerOptionActive: { backgroundColor: "#E3F2FD", borderColor: "#90CAF9" },
  typePickerOptionText: { fontSize: 13, ...fonts.medium, color: theme.text },
  typePickerOptionTextActive: { ...fonts.black },
  severityContainer: { flex: 1, minWidth: 160 },
  severityRow: { flexDirection: "row", gap: 6 },
  severityBtn: { flex: 1, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  severityBtnText: { fontSize: 8, ...fonts.black, textAlign: "center" },
  textArea: { height: 120, backgroundColor: theme.surfaceAlt, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.line },
  textAreaInput: { flex: 1, color: theme.text, fontSize: 14, ...fonts.medium, textAlignVertical: "top" },
  placeholderText: { fontSize: 14, color: theme.textLight, ...fonts.medium },
  submitBtn: { height: 64, backgroundColor: "#1A1C1A", borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 32 },
  submitBtnText: { color: "#fff", fontSize: 14, ...fonts.black, letterSpacing: 1.5 },

  supplySection: { backgroundColor: theme.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: theme.line },
  updateInventoryBtn: { backgroundColor: "#81C784", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  updateInventoryText: { color: "#fff", ...fonts.black, fontSize: 11 },
  supplyScroll: { marginTop: 24, marginHorizontal: -12 },
  supplyCard: { width: 220, backgroundColor: theme.surfaceAlt, borderRadius: 32, padding: 24, marginHorizontal: 12 },
  supplyCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  supplyLabelBox: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  supplyLabelText: { color: "#fff", fontSize: 18, ...fonts.black },
  supplyStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  supplyStatusText: { fontSize: 9, ...fonts.black },
  supplyCardName: { fontSize: 15, ...fonts.black, color: theme.text, marginBottom: 4 },
  supplyCardVal: { fontSize: 12, ...fonts.medium, color: theme.textMuted, marginBottom: 16 },
  supplyProgressTrack: { height: 6, backgroundColor: theme.line, borderRadius: 3, overflow: "hidden" },
  supplyProgressFill: { height: "100%", borderRadius: 3 },
});
