import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { theme, fonts } from "../../theme";
import { lookupCitizenByQr } from "../../api";
import { loadSession } from "../../session";

interface CitizenFamilyGroupScannerScreenProps {
  onBack: () => void;
  onScanned: (qrCode: string, fullName: string) => void;
}

type ScanStatus = "idle" | "scanning" | "processing" | "preview" | "error";

export function CitizenFamilyGroupScannerScreen({
  onBack,
  onScanned,
}: CitizenFamilyGroupScannerScreenProps) {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [scannedName, setScannedName] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("");
  const scanLockRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const openCamera = useCallback(async () => {
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      setError("Camera permission is required to scan QR codes.");
      return;
    }

    scanLockRef.current = false;
    setStatus("scanning");
    setError(null);
    setScannedQr(null);
    setScannedName(null);
  }, [cameraPermission, requestCameraPermission]);

  const onBarcodeScanned = useCallback(async (event: { data?: string }) => {
    if (scanLockRef.current || status !== "scanning") return;
    const raw = event.data?.trim();
    if (!raw) return;

    // Block scanning a family group QR — only individual citizen QRs should be added
    if (raw.startsWith("FAM-")) {
      setError("Cannot add a family group QR as a member. Please scan an individual citizen QR.");
      setStatus("error");
      return;
    }

    scanLockRef.current = true;
    setStatus("processing");

    try {
      const session = await loadSession();
      if (!session?.accessToken) throw new Error("Session expired.");

      const citizen = await lookupCitizenByQr(session.accessToken, raw);
      if (!citizen || !citizen.qrCodeId) {
        throw new Error("No registered citizen found for this QR code. Make sure the person has completed individual registration.");
      }

      setScannedQr(citizen.qrCodeId);
      setScannedName(citizen.fullName ?? "Unknown Citizen");
      setStatus("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
      setStatus("error");
      scanLockRef.current = false;
    }
  }, [status]);

  const handleConfirm = () => {
    if (scannedQr && scannedName) {
      onScanned(scannedQr, scannedName);
    }
  };

  const handleRetry = () => {
    scanLockRef.current = false;
    setStatus("idle");
    setError(null);
    setScannedQr(null);
    setScannedName(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Family Member</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Camera / Idle / Preview */}
      {status === "scanning" ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.scanHint}>Point at a family member's individual QR code</Text>
          </View>
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setStatus("idle")}>
            <Text style={styles.cancelScanText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      ) : status === "processing" ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.processingText}>Looking up citizen...</Text>
        </View>
      ) : status === "preview" && scannedQr ? (
        <View style={styles.previewContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#2E7D32" />
          </View>
          <Text style={styles.previewLabel}>CITIZEN FOUND</Text>
          <Text style={styles.previewName}>{scannedName}</Text>
          <Text style={styles.previewQr}>{scannedQr}</Text>

          <View style={styles.relationshipSection}>
            <Text style={styles.relationshipLabel}>RELATIONSHIP (optional)</Text>
            <View style={styles.relationshipGrid}>
              {["Spouse", "Child", "Parent", "Sibling", "Other"].map((rel) => (
                <TouchableOpacity
                  key={rel}
                  onPress={() => setRelationship(rel === relationship ? "" : rel)}
                  style={[styles.relChip, relationship === rel && styles.relChipActive]}
                >
                  <Text style={[styles.relChipText, relationship === rel && styles.relChipTextActive]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>ADD TO FAMILY GROUP</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rescanBtn} onPress={handleRetry}>
            <Text style={styles.rescanText}>Scan a different QR</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Idle or error state
        <View style={styles.centered}>
          {status === "error" && error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={32} color="#C0392B" style={{ marginBottom: 12 }} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.idleIcon}>
                <Ionicons name="qr-code" size={64} color={theme.primary} />
              </View>
              <Text style={styles.idleTitle}>Ready to Scan</Text>
              <Text style={styles.idleDesc}>
                Ask your family member to show their individual QR code from their Damayan Digital ID.
              </Text>
              <TouchableOpacity style={styles.openCameraBtn} onPress={openCamera}>
                <Ionicons name="camera" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.openCameraBtnText}>OPEN CAMERA</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === "android" ? 40 : 0,
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: "#fff",
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: {
    ...fonts.bold,
    fontSize: 13,
    color: "#fff",
    textAlign: "center",
    marginTop: 28,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  cancelScanBtn: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelScanText: {
    ...fonts.black,
    fontSize: 13,
    color: "#fff",
    letterSpacing: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  processingText: {
    ...fonts.bold,
    fontSize: 16,
    color: theme.textMuted,
    marginTop: 16,
  },
  previewContainer: {
    flex: 1,
    padding: 28,
    alignItems: "center",
  },
  successIcon: {
    marginTop: 20,
    marginBottom: 12,
  },
  previewLabel: {
    ...fonts.black,
    fontSize: 10,
    color: "#2E7D32",
    letterSpacing: 2,
    marginBottom: 8,
  },
  previewName: {
    ...fonts.black,
    fontSize: 28,
    color: theme.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  previewQr: {
    ...fonts.bold,
    fontSize: 13,
    color: theme.textLight,
    marginTop: 4,
    marginBottom: 28,
  },
  relationshipSection: {
    width: "100%",
    marginBottom: 28,
  },
  relationshipLabel: {
    ...fonts.black,
    fontSize: 10,
    color: theme.textLight,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  relationshipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  relChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  relChipActive: {
    backgroundColor: "#E8F5E9",
    borderColor: "#2E7D32",
  },
  relChipText: {
    ...fonts.bold,
    fontSize: 14,
    color: theme.textMuted,
  },
  relChipTextActive: {
    color: "#2E7D32",
  },
  confirmBtn: {
    width: "100%",
    height: 64,
    backgroundColor: "#004D40",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#004D40",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  confirmBtnText: {
    ...fonts.black,
    fontSize: 16,
    color: "#fff",
    letterSpacing: 1,
  },
  rescanBtn: {
    marginTop: 16,
    paddingVertical: 12,
  },
  rescanText: {
    ...fonts.bold,
    fontSize: 14,
    color: theme.textMuted,
  },
  idleIcon: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  idleTitle: {
    ...fonts.black,
    fontSize: 26,
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  idleDesc: {
    ...fonts.medium,
    fontSize: 15,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  openCameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#004D40",
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: "#004D40",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  openCameraBtnText: {
    ...fonts.black,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 1,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFCCCC",
    width: "100%",
  },
  errorText: {
    ...fonts.bold,
    fontSize: 15,
    color: "#C0392B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "#C0392B",
    borderRadius: 20,
  },
  retryText: {
    ...fonts.black,
    fontSize: 14,
    color: "#fff",
    letterSpacing: 0.5,
  },
});
