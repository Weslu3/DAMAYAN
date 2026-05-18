// src/site-manager/qr/useQRScanner.ts
//
// Drop-in replacement / companion to the scan logic in SiteManagerDuringScreen.
// Wraps expo-camera barcode scanning, calls the backend check-in endpoint,
// and also fetches the full citizen profile to display after a scan.
//
// expo-camera is already installed in your project.
//
// Usage:
//   const scanner = useQRScanner();
//
//   // In JSX:
//   {scanner.isCameraOpen && (
//     <CameraView
//       style={styles.camera}
//       facing="back"
//       barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
//       onBarcodeScanned={scanner.onBarcodeScanned}
//     />
//   )}
//   <TouchableOpacity onPress={scanner.openCamera}>Open Scanner</TouchableOpacity>
//
//   // After a successful scan:
//   scanner.checkIn        — the CheckInRecord returned by the backend
//   scanner.citizenProfile — the full citizen profile fetched after check-in
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { scanCheckIn, getCitizenByQrCode } from "../../api";
import { loadSession }                      from "../../session";
import { parseScannedPayload }              from "./qr-utils";
import type { CheckInRecord }               from "../../types";
import type { CitizenProfile }              from "./useQRGenerator";

export type ScanStatus =
  | "idle"          // camera closed, no result
  | "scanning"      // camera open, waiting for QR
  | "processing"    // QR captured, calling backend
  | "done"          // check-in + profile fetch complete
  | "error";        // something went wrong

type ScannerState = {
  status:         ScanStatus;
  isCameraOpen:   boolean;
  checkIn:        CheckInRecord | null;
  citizenProfile: CitizenProfile | null;
  error:          string | null;
};

export function useQRScanner() {
  const [state, setState] = useState<ScannerState>({
    status:         "idle",
    isCameraOpen:   false,
    checkIn:        null,
    citizenProfile: null,
    error:          null,
  });

  // Prevents processing the same QR frame multiple times
  const scanLockRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ── Open camera ────────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      Alert.alert("Camera denied", "Camera permission is required for QR scanning.");
      return;
    }

    scanLockRef.current = false;
    setState((prev) => ({
      ...prev,
      isCameraOpen:   true,
      status:         "scanning",
      checkIn:        null,
      citizenProfile: null,
      error:          null,
    }));
  }, [cameraPermission, requestCameraPermission]);

  // ── Close camera without scanning ──────────────────────────────────────────

  const closeCamera = useCallback(() => {
    scanLockRef.current = false;
    setState((prev) => ({
      ...prev,
      isCameraOpen: false,
      status:       prev.status === "scanning" ? "idle" : prev.status,
    }));
  }, []);

  // ── Called by <CameraView onBarcodeScanned={...}> ─────────────────────────

  const onBarcodeScanned = useCallback(
    async (event: { data?: string }) => {
      if (scanLockRef.current) return;

      const raw = event.data?.trim();
      if (!raw) return;

      const qrCodeId = parseScannedPayload(raw);
      if (!qrCodeId) return;

      // Lock so rapid frames don't trigger duplicate requests
      scanLockRef.current = true;

      setState((prev) => ({
        ...prev,
        isCameraOpen: false,
        status:       "processing",
        error:        null,
      }));

      try {
        const session = await loadSession();
        if (!session?.accessToken) throw new Error("Session expired. Please sign in again.");

        // 1. Record the check-in via the existing backend endpoint
        const checkIn = await scanCheckIn(session.accessToken, { qrCode: qrCodeId });

        // 2. Fetch the full citizen profile to show in the UI
        //    Non-fatal: check-in already succeeded even if profile lookup fails.
        let citizenProfile: CitizenProfile | null = null;
        try {
          citizenProfile = await getCitizenByQrCode(session.accessToken, qrCodeId);
        } catch {
          // profile fetch failure is non-blocking
        }

        setState({
          status:         "done",
          isCameraOpen:   false,
          checkIn,
          citizenProfile,
          error:          null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Check-in failed.";
        setState((prev) => ({
          ...prev,
          status: "error",
          error:  message,
        }));
        // Release lock so the user can try again
        scanLockRef.current = false;
      }
    },
    [],
  );

  // ── Reset to idle so the next scan can begin ───────────────────────────────

  const reset = useCallback(() => {
    scanLockRef.current = false;
    setState({
      status:         "idle",
      isCameraOpen:   false,
      checkIn:        null,
      citizenProfile: null,
      error:          null,
    });
  }, []);

  return {
    ...state,
    openCamera,
    closeCamera,
    onBarcodeScanned,
    reset,
  };
}
