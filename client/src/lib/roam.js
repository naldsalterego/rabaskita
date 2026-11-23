// Places, distances and fares for Roam. Pure functions with no browser or server code, so the pages (which preview) and the
// backend (which decides) always agree on the same distance and the same fare.
import { ROAM } from './policy.js';

// Approximate coordinates. Verify them before publishing. Airport: from the route map. Piers: waypoints.ph (Virac Pier, San Andres Pier).
export const HUBS = Object.freeze([
  { id: 'hub-airport', label: 'Virac Airport', lat: 13.5764, lng: 124.2064 },
  { id: 'hub-virac-port', label: 'Virac Port', lat: 13.5818, lng: 124.2337 },
  { id: 'hub-san-andres-port', label: 'San Andres Port', lat: 13.5979, lng: 124.0969 },
]);

// A box around Catanduanes. A point outside it is not on the island, so it is refused instead of priced.
const ISLAND = { south: 13.3, north: 14.3, west: 123.9, east: 124.6 };
export const onIsland = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= ISLAND.south && p.lat <= ISLAND.north && p.lng >= ISLAND.west && p.lng <= ISLAND.east;

const rad = (d) => (d * Math.PI) / 180;
/** Straight-line distance in km (haversine). */
export function straightKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Estimated distance by road in km, to one decimal: the straight line stretched by a detour factor. */
export const roadKm = (a, b) => Math.max(0.1, Math.round(straightKm(a, b) * ROAM.commute.detour * 10) / 10);

/** A driver's commute rates, or null when the vehicle does not offer commutes. `base` covers the first `baseKm` km. */
export const commuteRates = (v) => (v && v.commute_base != null && v.commute_per_km != null ? { base: Number(v.commute_base), baseKm: Number(v.commute_base_km ?? 0), perKm: Number(v.commute_per_km) } : null);
/** Fare in whole pesos: the base fare, plus the km beyond the base distance at the per-km rate. Never below the base fare. */
export const commuteFare = (rates, km) => Math.round(rates.base + Math.max(0, km - rates.baseKm) * rates.perKm);

/** Where an ID photo may live: this browser's photo store (demo), or the private ID store of the shared backend. Never the public album. */
export const idRefOk = (v) => typeof v === 'string' && /^(idb:[\w-]{8,64}|\/api\/idphotos\/[\w-]{8,64})$/.test(v);
