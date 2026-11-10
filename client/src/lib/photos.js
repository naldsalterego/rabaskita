// Photo storage for the demo: images are resized in the browser and kept in IndexedDB (far larger quota than localStorage).
// A photo is referenced as "idb:<id>"; anything else (http(s) or /img/...) is used as-is.
import { mode } from './mode.js';
const DB = 'cat_photos'; let dbp; const urls = new Map();
const open = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('p', mode), q = fn(t.objectStore('p')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
const newId = () => globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);
async function shrink(file, max = 1600, type = 'image/jpeg') {
  let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error("That image format can't be read. Please use JPG, PNG or WebP."); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not process that image'))), type, 0.82));
}
export async function savePhoto(file, opts = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).');
  if (file.size > 20e6) throw new Error('That image is over 20 MB. Please choose a smaller one.');
  const blob = await shrink(file, opts.max || 1600, opts.keepAlpha ? 'image/png' : 'image/jpeg');
  if (mode.shared) { // shared mode: upload so every visitor can see it
    const r = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }, body: blob }), j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Photo upload failed. Please try again.'); return j.url;
  }
  const id = newId(); await run('readwrite', s => s.put(blob, id)); return 'idb:' + id;
}
// Documents (permits, registrations): photos of papers are shrunk like pictures; PDFs are stored as they are.
export async function saveDocument(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return savePhoto(file, { max: 1800 });
  if (file.size > 4.5e6) throw new Error('That PDF is over 4.5 MB. Please compress it or upload clear photos of the pages instead.');
  const blob = file.type === 'application/pdf' ? file : new Blob([file], { type: 'application/pdf' });
  if (mode.shared) { const r = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': 'application/pdf', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }, body: blob }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Upload failed. Please try again.'); return j.url; }
  const id = newId(); await run('readwrite', s => s.put(blob, id)); return 'idb:' + id;
}
export function deletePhoto(ref) { if (typeof indexedDB === 'undefined' || !ref?.startsWith('idb:')) return; urls.delete(ref); run('readwrite', s => s.delete(ref.slice(4))).catch(() => {}); }
export async function photoUrl(ref) {
  if (!ref) return null; if (!ref.startsWith('idb:')) return ref; if (urls.has(ref)) return urls.get(ref);
  const blob = await run('readonly', s => s.get(ref.slice(4))); if (!blob) return null; const u = URL.createObjectURL(blob); urls.set(ref, u); return u;
}
export const wipePhotos = () => { try { indexedDB.deleteDatabase(DB); } catch { /* ignore */ } };
