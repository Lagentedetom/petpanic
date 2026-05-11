export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

export function formatDistance(km: number) {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Validates that a string is a UUID v1-v5 format. Used as a defensive guard
 * before interpolating UUIDs into PostgREST `.or(...)` filters where the
 * comma syntax could otherwise be split by a malicious string. Today we only
 * pass JWT-derived UUIDs (always trusted), but this guards against future
 * footguns. (ME-08 fix.)
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Cross-platform UUID v4 generator (ME-06 fix).
 *
 * `crypto.randomUUID()` is supported on Android System WebView 92+ but
 * older devices on Android 8/9 with outdated WebView crash. For an emergency
 * pet-recovery app (panic flow + photo upload paths), we cannot afford a
 * crash on first-tap. Falls back to a manual UUID v4 built from
 * `crypto.getRandomValues` (supported much further back) when randomUUID is
 * unavailable. The fallback layout follows RFC 4122 §4.4.
 */
export function safeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Some embedded browsers throw on insecure contexts even though the
      // function exists. Fall through to manual implementation.
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Per RFC 4122: set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
