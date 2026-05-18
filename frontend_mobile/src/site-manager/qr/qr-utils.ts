// src/site-manager/qr/qr-utils.ts
//
// Pure utility functions for Damayan QR IDs.
// No browser APIs, no Node crypto — fully compatible with React Native / Expo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a unique QR code ID in the format: DMY-YYYYMMDD-XXXX
 * This value is stored in register_citizens.qr_code_id and encoded into the QR image.
 * The backend's scanQr() resolves this value back to an evacuee record.
 */
export function generateQrCodeId(): string {
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DMY-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Returns the value to encode in the QR image.
 * The backend's scanQr() accepts the raw qr_code_id directly.
 *
 * @param qrCodeId — the value stored in register_citizens.qr_code_id
 */
export function buildQRPayload(qrCodeId: string): string {
  return qrCodeId;
}

/**
 * Parses a raw string scanned from a QR image.
 * Strips the legacy "QR-" prefix if present (matches backend behaviour).
 *
 * @returns the clean qr_code_id string, or null if empty/invalid
 */
export function parseScannedPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("QR-") ? trimmed.slice(3) : trimmed;
}

/**
 * Returns initials for an avatar circle.
 * "Juan dela Cruz" → "JC"
 */
export function getInitials(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
