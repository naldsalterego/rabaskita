// Travel estimates are straight-line distance x road factor at an assumed average speed.
// They are rough estimates, not routing results; legs without coordinates return null.
export const HUB = { lat: 13.5818, lng: 124.23 }; // approx. Virac center; adjust if needed
const ROAD_FACTOR = 1.4, AVG_KMH = 30;
export function km(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const has = (p) => p && p.lat != null && p.lng != null;
export function legMinutes(a, b) {
  if (!has(a) || !has(b)) return null;
  const A = { lat: Number(a.lat), lng: Number(a.lng) }, B = { lat: Number(b.lat), lng: Number(b.lng) };
  return Math.max(1, Math.round(((km(A, B) * ROAD_FACTOR) / AVG_KMH) * 60));
}
export function nearestOrder(items, from = HUB) {
  const withC = items.filter(has).map(i => ({ ...i, lat: Number(i.lat), lng: Number(i.lng) })), rest = items.filter(i => !has(i)), out = [];
  let cur = from;
  while (withC.length) { let bi = 0; withC.forEach((p, i) => { if (km(cur, p) < km(cur, withC[bi])) bi = i; }); cur = withC.splice(bi, 1)[0]; out.push(cur); }
  return [...out, ...rest];
}
export function withLegs(items, budget) {
  const out = items.map((it, i) => {
    const prev = items[i - 1];
    return { ...it, travel_minutes: prev && prev.day_no === it.day_no ? legMinutes(prev, it) : null };
  });
  const priced = out.filter(i => i.est_cost != null);
  return { items: out, totals: { cost: priced.reduce((s, i) => s + Number(i.est_cost), 0), unpriced: out.length - priced.length, overBudget: budget != null && priced.reduce((s, i) => s + Number(i.est_cost), 0) > Number(budget) } };
}
