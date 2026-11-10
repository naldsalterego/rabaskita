import jsQR from 'jsqr';
// Pull the check-in code out of whatever the QR contains: our link (https://site/checkin/<code>) or a bare code.
export function tokenFromScan(text) {
  const t = String(text || '').trim();
  try { const m = new URL(t).pathname.match(/\/checkin\/([\w-]{4,80})\/?$/); if (m) return m[1]; } catch { /* not a URL */ }
  return /^[\w-]{6,80}$/.test(t) ? t : null;
}
// Decode a QR from raw RGBA pixels (a camera frame or a photo).
export function decodeFrame(data, width, height) { const r = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' }); return r ? r.data : null; }
