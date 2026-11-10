import QRCode from 'qrcode';
import { handle, qrToken, resetDemo } from './mock.js';
import { mode } from './mode.js';
// Demo mode (default): everything runs in the browser. Set VITE_API_URL to use the real Express server instead.
const REAL = import.meta.env.VITE_API_URL;
export const isDemo = !REAL;
const BASE = (REAL || '') + '/api';
export async function api(path, { method = 'GET', body } = {}) {
  if (isDemo && !mode.shared) return handle(method, path, body);
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export async function openQr(id, scope = 'admin') {
  const w = window.open('', '_blank'); if (!w) return alert('Please allow pop-ups to view the QR code.');
  try {
    const token = isDemo ? (mode.shared ? (await api(`/qr-token/${id}`)).token : qrToken(id)) : null;
    const src = isDemo ? await QRCode.toDataURL(`${location.origin}/checkin/${token}`, { width: 480, margin: 2 })
      : URL.createObjectURL(await (await fetch(`${BASE}/${scope}/qr/${id}.png`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).blob());
    w.document.write(`<title>Check-in QR</title><body style="margin:0;display:grid;place-items:center;min-height:100vh"><img src="${src}" alt="QR code" style="max-width:90vmin"></body>`);
  } catch { w.close(); alert('Could not make the QR code.'); }
}

// A printable A4 sheet with one QR per place, for sticking up at each location.
export async function printQrSheet(rows, title = 'Check-in QR codes') {
  const w = window.open('', '_blank'); if (!w) return alert('Please allow pop-ups to print the QR sheet.');
  const cards = await Promise.all(rows.map(async r => `<div class="c"><h2>${String(r.name || 'Place').replace(/</g, '&lt;')}</h2><p>${r.listing_type}</p><img src="${await QRCode.toDataURL(`${location.origin}/checkin/${r.token}`, { width: 480, margin: 1 })}" alt="QR code"><p class="s">Scan with ${document.title} to collect points</p></div>`));
  w.document.write(`<!doctype html><title>${title}</title><style>body{font-family:sans-serif;margin:16px}h1{font-size:18px}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}.c{border:2px solid #25308F;border-radius:14px;padding:12px;text-align:center;break-inside:avoid}.c h2{margin:0;font-size:17px;color:#25308F}.c p{margin:2px 0;color:#555;font-size:12px;text-transform:capitalize}.c img{width:7cm;height:7cm}.s{font-size:11px!important;text-transform:none!important}@media print{button{display:none}}</style><button onclick="print()">Print</button><h1>${title}</h1><div class="g">${cards.join('')}</div>`); w.document.close();
}
// Reset sample data (admin). In shared mode this resets the data for every visitor.
export async function resetAll() { if (mode.shared) { await api('/admin/reset', { method: 'POST' }); location.href = '/'; } else resetDemo(); }
