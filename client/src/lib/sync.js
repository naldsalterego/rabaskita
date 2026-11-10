// Live refresh for shared mode: polls a tiny revision number and tells pages to re-fetch when someone, anywhere, changes data.
import { useSyncExternalStore } from 'react';
import { mode } from './mode.js';
let ver = 0; const subs = new Set();
export const useSyncVersion = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => ver);
export const bump = () => { ver++; subs.forEach(f => f()); };
const EVERY = 15000, IDLE_AFTER = 5 * 60000; // gentle on the free plan: 15 s while the tab is visible, pause after 5 min without activity
export function startSync() {
  if (!mode.shared) return;
  let last = null, active = Date.now(), timer = null;
  const touch = () => { const wasIdle = Date.now() - active > IDLE_AFTER; active = Date.now(); if (wasIdle) tick(); };
  async function tick() {
    if (document.hidden || Date.now() - active > IDLE_AFTER) return;
    try { const r = await fetch('/api/sync', { cache: 'no-store' }); if (!r.ok) return; const { rev } = await r.json(); if (last !== null && rev !== last) bump(); last = rev; } catch { /* offline: try again next time */ }
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(e => addEventListener(e, touch, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick(); timer = setInterval(tick, EVERY); return () => clearInterval(timer);
}
