// Site branding (name, logo, developer badge) set by the admin. Cached so the header does not flash on reload.
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api.js';
import { useSyncVersion } from './sync.js';
export const DEFAULT_LOGO = '/logo-rabaskita.png', DEFAULT_PARTNER = '/logo-islatek.png';
const DEFAULTS = { siteName: 'Rabas Kita!', tagline: 'The Happy Island · Tourism platform', logo: '', partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' };
let cur = DEFAULTS; try { cur = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cat_branding')) }; } catch { /* use defaults */ }
const subs = new Set(); let fetching = null;
export const setBranding = (b) => { cur = { ...DEFAULTS, ...b }; try { localStorage.setItem('cat_branding', JSON.stringify(cur)); } catch { /* ignore */ } subs.forEach(f => f()); };
const refresh = () => { if (!fetching) fetching = api('/branding').then(setBranding).catch(() => {}).finally(() => { fetching = null; }); };
export function useBranding() { const ver = useSyncVersion(); useEffect(refresh, [ver]); return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => cur); }
