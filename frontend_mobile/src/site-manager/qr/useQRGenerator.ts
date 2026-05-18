// src/site-manager/qr/useQRGenerator.ts
//
// Hook for generating and displaying a Damayan QR ID for a citizen.
//
// Install dependency:
//   npx expo install react-native-qrcode-svg react-native-svg
//
// Usage in your component:
//   import QRCode from "react-native-qrcode-svg";
//   const { qrValue, citizen, generate, loading, error, reset } = useQRGenerator();
//
//   <QRCode value={qrValue} size={200} color="#0F6E56" backgroundColor="#fff" />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { getCitizenByQrCode, registerCitizenWithQR } from "../../api";
import { loadSession }            from "../../session";
import { generateQrCodeId, buildQRPayload } from "./qr-utils";

export type CitizenProfile = {
  userId:            string;
  fullName?:         string;
  firstName:         string;
  lastName:          string;
  birthDate?:        string;
  gender?:           string;
  registrationType?: string;
  qrCodeId?:         string;
  bloodType?:        string;
  medicalConditions?:string;
};

type GeneratorState = {
  qrValue:   string | null;      // value to pass to <QRCode value={qrValue} />
  citizen:   CitizenProfile | null;
  loading:   boolean;
  error:     string | null;
};

// ─── Option A: display QR for an already-registered citizen ──────────────────

/**
 * Load an existing citizen's QR code by their qr_code_id.
 * Use this when the citizen is already registered in the system.
 */
export function useQRDisplay() {
  const [state, setState] = useState<GeneratorState>({
    qrValue: null,
    citizen: null,
    loading: false,
    error:   null,
  });

  const loadForCitizen = useCallback(async (qrCodeId: string) => {
    setState({ qrValue: null, citizen: null, loading: true, error: null });

    try {
      const session = await loadSession();
      if (!session?.accessToken) throw new Error("Session expired. Please sign in again.");

      const profile = await getCitizenByQrCode(session.accessToken, qrCodeId);
      if (!profile) throw new Error(`No citizen found with QR code: ${qrCodeId}`);

      setState({
        qrValue:  buildQRPayload(qrCodeId),
        citizen:  profile,
        loading:  false,
        error:    null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:   err instanceof Error ? err.message : "Failed to load QR code.",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ qrValue: null, citizen: null, loading: false, error: null });
  }, []);

  return { ...state, loadForCitizen, reset };
}

// ─── Option B: register a new citizen and generate their QR on the spot ──────

export type NewCitizenForm = {
  userId:            string;       // auth.users UUID — must already exist
  fullName:          string;
  registrationType:  "Individual" | "Family";
  birthDate?:        string;       // YYYY-MM-DD
  gender?:           string;
  bloodType?:        string;
  medicalConditions?:string;
  familyId?:         string;
};

/**
 * Register a new citizen and immediately produce their QR code.
 * Generates a unique qr_code_id, posts to /site-manager/citizens,
 * then returns the QR value and citizen profile.
 */
export function useQRGenerator() {
  const [state, setState] = useState<GeneratorState>({
    qrValue:  null,
    citizen:  null,
    loading:  false,
    error:    null,
  });

  const generate = useCallback(async (form: NewCitizenForm) => {
    if (!form.fullName?.trim()) {
      setState((prev) => ({ ...prev, error: "Full name is required." }));
      return;
    }

    setState({ qrValue: null, citizen: null, loading: true, error: null });

    try {
      const session = await loadSession();
      if (!session?.accessToken) throw new Error("Session expired. Please sign in again.");

      const qrCodeId = generateQrCodeId();

      await registerCitizenWithQR(session.accessToken, {
        userId:            form.userId,
        fullName:          form.fullName.trim(),
        qrCodeId,
        registrationType:  form.registrationType,
        birthDate:         form.birthDate,
        gender:            form.gender,
        bloodType:         form.bloodType,
        medicalConditions: form.medicalConditions,
        familyId:          form.familyId,
      });

      setState({
        qrValue: buildQRPayload(qrCodeId),
        citizen: {
          userId:            form.userId,
          fullName:          form.fullName.trim(),
          firstName:         form.fullName.trim().split(" ")[0],
          lastName:          form.fullName.trim().split(" ").slice(1).join(" "),
          qrCodeId,
          registrationType:  form.registrationType,
          birthDate:         form.birthDate,
          gender:            form.gender,
          bloodType:         form.bloodType,
          medicalConditions: form.medicalConditions,
        },
        loading: false,
        error:   null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:   err instanceof Error ? err.message : "Failed to generate QR code.",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ qrValue: null, citizen: null, loading: false, error: null });
  }, []);

  return { ...state, generate, reset };
}
