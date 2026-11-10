// Demo backend core. Same endpoints and response shapes as the Express server.
// It runs in the browser (data in localStorage) or in a Netlify function (data in Netlify Blobs), through the `io` adapter.
// All listings below are SAMPLE data for a prototype. Nothing here is real or verified.
import { nearestOrder, withLegs } from './itinerary.js';
function seedBranding() { return { siteName: 'Rabas Kita!', tagline: 'The Happy Island · Tourism platform', logo: '', partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' }; }
function seedCredits() { return { company: 'IslaTek', members: ['Engr. Morris Aquino', 'Engr. John Ronald Rodriguez', 'Engr. John Patrick Valledor', 'Engr. Benz Art Wayne Lagsilon'].map(name => ({ id: uid(), name, role: '', photo: '' })) }; }
const uid = () => globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const now = () => new Date().toISOString();
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

const sampleDocs = (types) => types.map(type => ({ id: uid(), type, number: 'SAMPLE-' + type.toUpperCase(), expires: '', file: '', fileName: '', public: true, verified: true, verifiedAt: now(), uploadedAt: now(), by: 'Demo Admin' }));
export function seed(adminPassword = 'demo1234') {
  const munis = ['Virac', 'San Andres', 'Baras', 'Bato', 'Caramoran', 'Gigmoto', 'Pandan', 'Panganiban', 'San Miguel', 'Viga', 'Bagamanoc'].map((name, i) => ({ id: i + 1, name }));
  const M = (n) => munis.find(m => m.name === n).id;
  const d = { municipalities: munis, tiers: [{ id: 1, name: 'Easy', points: 10 }, { id: 2, name: 'Moderate', points: 25 }, { id: 3, name: 'Difficult', points: 50 }, { id: 4, name: 'Remote', points: 100 }],
    users: [], destinations: [], businesses: [], accommodations: [], rooms: [], restaurants: [], menus: [], providers: [], vehicles: [], routes: [], payments: [], stays: [], rides: [], tables: [],
    qr: [], checkins: [], points: [], rewards: [], redemptions: [], itineraries: [], reviews: [], audit: [], rentals: [], credits: seedCredits(), branding: seedBranding() };
  const user = (role, email, name) => { const u = { id: uid(), email, password: role === 'admin' ? adminPassword : 'demo1234', full_name: name, role, is_active: true, created_at: now() }; d.users.push(u); return u; };
  const admin = user('admin', 'admin@demo.test', 'Demo Admin'), owner = user('business_owner', 'owner@demo.test', 'Demo Owner'), prov = user('transport_provider', 'provider@demo.test', 'Demo Provider'), tourist = user('tourist', 'tourist@demo.test', 'Demo Tourist');
  const ownerB = user('business_owner', 'owner2@demo.test', 'Sample Owner 2'), ownerC = user('business_owner', 'owner3@demo.test', 'Sample Owner 3'), ownerD = user('business_owner', 'owner4@demo.test', 'Sample Owner 4'), prov2 = user('transport_provider', 'provider2@demo.test', 'Sample Provider 2');
  [['Sample Explorer A', 120], ['Sample Explorer B', 75]].forEach(([n, p]) => { const u = user('tourist', n.replace(/ /g, '').toLowerCase() + '@demo.test', n); d.points.push({ id: uid(), user_id: u.id, delta: p, reason: 'check-in', verified: true, created_at: now() }); });
  const note = 'Sample description for the demo. Coordinates are approximate.';
  [['Puraran Beach', 'Baras', 13.7, 124.37, 2, 'Beach destination. ' + note], ['Binurong Point', 'Baras', 13.76, 124.4, 3, 'Coastal viewpoint. ' + note], ['Maribina Falls', 'Bato', 13.6, 124.3, 1, 'Waterfall destination. ' + note], ['Sample Island Cove (fictional)', 'San Andres', 13.6, 124.1, 4, 'Fictional remote spot to show the highest point tier.']].forEach(([name, m, lat, lng, tier, description], i) => {
    const x = { id: uid(), name, municipality_id: M(m), description, history: '', address: m, lat, lng, entrance_fee: [20, 0, 30, null][i], hours: { 'Daily': '8:00 to 17:00 (sample)' }, facilities: ['Parking (sample)'], safety_notes: 'Follow local guidance. Sample text.', accessibility_notes: 'Sample accessibility note.', travel_minutes_from_virac: [75, 90, 40, 120][i], point_tier_id: tier, is_published: true };
    d.destinations.push(x); d.qr.push({ id: uid(), listing_type: 'destination', listing_id: x.id, token: 'demo-' + rnd(8).toLowerCase(), points_override: null, cooldown_hours: 24, is_active: true });
  });
  const biz = (name, m, desc, lat, lng, category, own = owner) => { const b = { id: uid(), owner_id: own.id, name: name + ' (sample)', municipality_id: M(m), description: desc, address: m + ' (sample address)', lat, lng, phone: '000-000-0000 (sample)', hours: { 'Daily': '8:00 to 20:00 (sample)' }, status: 'approved', category, created_at: now(), documents: [] }; d.businesses.push(b); return b; };
  const inn = biz('Seaside Inn', 'Virac', 'Sample inn for demo bookings.', 13.58, 124.23, 'Hotels and resorts'), home = biz('Bayview Homestay', 'Bato', 'Sample homestay for demo bookings.', 13.6, 124.3, 'Staycation houses', ownerB);
  inn.documents = sampleDocs(['bir', 'registration', 'permit', 'fire']); // a sample listing with complete papers, to show what tourists see
  [[inn, 'inn', [['Standard room', 2, 1500, 2], ['Family room', 4, 2500, 1]]], [home, 'homestay', [['Whole house', 6, 3200, 1]]]].forEach(([b, type, rooms]) => { const a = { id: uid(), business_id: b.id, type, amenities: ['Wi-Fi (sample)', 'Breakfast (sample)'] }; d.accommodations.push(a); rooms.forEach(([name, capacity, price, quantity]) => d.rooms.push({ id: uid(), accommodation_id: a.id, name, capacity, price_per_night: price, quantity })); });
  [[biz('Seafood Grill', 'Virac', 'Sample seafood restaurant.', 13.585, 124.235, 'Restaurants', ownerC), ['Seafood', 'Filipino'], 2, false, [['Grilled fish', 280], ['Seafood soup', 180], ['Rice', 30]]], [biz('Island Cafe', 'Virac', 'Sample cafe that takes reservations.', 13.582, 124.228, 'Cafes', ownerC), ['Cafes', 'Local delicacies'], 1, true, [['Coffee', 90], ['Pastry', 70]]]].forEach(([b, cuisines, pr, res, menu]) => { const r = { id: uid(), business_id: b.id, cuisines, price_range: pr, accepts_reservations: res }; d.restaurants.push(r); menu.forEach(([item_name, price]) => d.menus.push({ id: uid(), restaurant_id: r.id, item_name, description: '', price })); });
  biz('Island Souvenirs', 'Virac', 'Sample souvenir shop with local crafts and gifts.', 13.5815, 124.232, 'Souvenir shops', ownerD); biz('Barangay Grocery', 'Bato', 'Sample grocery for travel supplies and snacks.', 13.601, 124.301, 'Groceries', ownerD);
  const p = { id: uid(), owner_id: prov.id, name: 'Sample Airport Vans', phone: '000-000-0000 (sample)', status: 'approved', created_at: now(), documents: [] }, p2 = { id: uid(), owner_id: prov2.id, name: 'Sample Island Rentals', phone: '000-000-0001 (sample)', status: 'approved', created_at: now(), documents: [] }; d.providers.push(p, p2); p.documents = sampleDocs(['bir', 'registration', 'permit', 'franchise']);
  const veh = (pr, name, type, capacity, driver, self, withDriver, description) => d.vehicles.push({ id: uid(), provider_id: pr.id, name: name + ' (sample)', type, capacity, plate_no: 'SAMPLE', driver_name: driver, description: description + ' Sample listing and sample price.', rent_self: self, rent_driver: withDriver, is_available: true });
  veh(p, 'Passenger van', 'van', 8, 'Demo Driver', null, 3500, 'Roomy van for groups and long island trips.'); veh(p, 'Compact car', 'car', 4, 'Demo Driver', 2200, 3000, 'Comfortable car for small groups.');
  veh(p2, 'Scooter', 'motorcycle', 2, 'Sample Guide', 600, 900, 'Easy way to reach beaches and viewpoints.'); veh(p2, 'Tricycle', 'tricycle', 3, 'Sample Driver', null, 1200, 'Local tricycle with a driver for short hops.');
  veh(p2, 'Multicab', 'multicab', 6, 'Sample Driver', null, 2600, 'Small group transport with a driver.'); veh(p2, 'Pickup SUV', 'car', 5, 'Sample Driver', 3200, 4200, 'Higher clearance for rougher roads.');
  [['Virac Airport', 'Seaside Inn (sample)', 300, 15], ['Virac Airport', 'Maribina Falls', 1200, 60], ['San Andres Port', 'Virac town', 900, 60], ['Virac Port', 'Seaside Inn (sample)', 250, 10]].forEach(([origin, destination, fare, est_minutes]) => d.routes.push({ id: uid(), provider_id: p.id, origin, destination, fare, est_minutes }));
  [['Sample Magnet', 15, 20], ['Sample Tourism Cap', 30, 10], ['Sample Coffee Voucher', 40, null]].forEach(([name, points_cost, stock]) => d.rewards.push({ id: uid(), name, description: 'Sample reward for the demo.', points_cost, stock, is_active: true }));
  return d;
}

export function createBackend(io) {
  let db;
  const deletePhoto = (r) => { try { const p = io.deletePhoto?.(r); if (p?.then) pending.push(p.catch(() => {})); } catch { /* ignore */ } };
  const loadDb = async () => { let d = await io.load(); if (!d) { d = seed(io.adminPassword?.()); await io.save(d); } d.rentals ||= []; d.credits ||= seedCredits(); d.branding ||= seedBranding(); return d; };
  const mn = (id) => db.municipalities.find(m => m.id == id)?.name;
  const tierPts = (id) => db.tiers.find(t => t.id == id)?.points ?? null;
  const biz = (id) => db.businesses.find(b => b.id === id);
  const balance = (uid_) => db.points.filter(p => p.user_id === uid_).reduce((s, p) => s + p.delta, 0);
  const log = (user, action, entity_id = '') => db.audit.unshift({ created_at: now(), actor: user?.email, action, entity_id });
  const dest = (x) => ({ ...x, municipality: mn(x.municipality_id), points: tierPts(x.point_tier_id) });
  // ---- business papers (documents). The tourism office decides which papers are required; adjust REQUIRED to match its rules.
  const DOC_LABELS = { bir: 'BIR Certificate of Registration (Form 2303)', registration: 'Business registration (DTI / SEC / CDA)', permit: "Mayor's / business permit", sanitary: 'Sanitary permit', fire: 'Fire safety inspection certificate', franchise: 'Transport franchise or permit, and vehicle registration (OR/CR)', dot: 'DOT accreditation (if any)', other: 'Other supporting document' };
  const REQUIRED = { stays: ['bir', 'registration', 'permit', 'fire'], restaurants: ['bir', 'registration', 'permit', 'sanitary', 'fire'], transport: ['bir', 'registration', 'permit', 'franchise'], shops: ['bir', 'registration', 'permit'] };
  const docState = (d) => (d.expires && d.expires < now().slice(0, 10) ? 'expired' : d.verified ? 'verified' : 'review');
  const RANK = { verified: 3, review: 2, expired: 1 };
  const typeState = (docs, type) => ((docs || []).filter(d => d.type === type).map(docState).sort((a, b) => RANK[b] - RANK[a])[0]) || 'missing';
  const overall = (docs, kind) => { const st = REQUIRED[kind].map(t => typeState(docs, t)); return st.every(x => x === 'verified') ? 'complete' : st.every(x => x === 'verified' || x === 'review') ? 'review' : 'incomplete'; };
  const paperSummary = (o, kind) => ({ status: overall(o?.documents, kind), have: REQUIRED[kind].filter(t => typeState(o?.documents, t) === 'verified').length, need: REQUIRED[kind].length });
  const docOut = (d, admin) => ({ id: d.id, type: d.type, label: DOC_LABELS[d.type], state: docState(d), number: admin || d.public ? d.number : '', expires: d.expires || '', verified: !!d.verified, verifiedAt: d.verifiedAt || null, public: !!d.public, fileName: d.fileName || '', file: admin || d.public ? d.file : '', hasFile: !!d.file, uploadedAt: d.uploadedAt, by: d.by });
  const papersView = (o, kind, admin = false) => { const docs = o?.documents || []; return { status: overall(docs, kind), required: REQUIRED[kind].map(t => ({ type: t, label: DOC_LABELS[t], state: typeState(docs, t), docs: docs.filter(d => d.type === t).map(d => docOut(d, admin)) })), other: docs.filter(d => !REQUIRED[kind].includes(d.type)).map(d => docOut(d, admin)), types: [...REQUIRED[kind], ...Object.keys(DOC_LABELS).filter(t => !REQUIRED[kind].includes(t))].map(t => ({ id: t, label: DOC_LABELS[t], required: REQUIRED[kind].includes(t) })) }; };
  const kindOfBiz = (b) => (db.accommodations.some(a => a.business_id === b.id) ? 'stays' : db.restaurants.some(r => r.business_id === b.id) ? 'restaurants' : 'shops');
  const docTarget = (kind, id) => {
    if (kind === 'transport') { const o = db.providers.find(x => x.id === id); return o && { obj: o, kind: 'transport' }; }
    if (kind === 'stays') { const a = db.accommodations.find(x => x.id === id); return a && { obj: biz(a.business_id), kind: 'stays' }; }
    if (kind === 'restaurants') { const r = db.restaurants.find(x => x.id === id); return r && { obj: biz(r.business_id), kind: 'restaurants' }; }
    if (kind === 'businesses') { const o = biz(id); return o && { obj: o, kind: kindOfBiz(o) }; }
    return null;
  };
  const bizPub = (b) => ({ cover_photo: b.cover_photo || null, photos: b.photos || [], id: b.id, name: b.name, description: b.description, address: b.address, lat: b.lat, lng: b.lng, phone: b.phone, hours: b.hours, municipality: mn(b.municipality_id), category: b.category });
  const restRow = (r) => ({ ...bizPub(biz(r.business_id)), papers_status: overall(biz(r.business_id).documents, 'restaurants'), restaurant_id: r.id, cuisines: r.cuisines, price_range: r.price_range, accepts_reservations: r.accepts_reservations });
  const accRow = (a) => { const rs = db.rooms.filter(r => r.accommodation_id === a.id); return { ...bizPub(biz(a.business_id)), papers_status: overall(biz(a.business_id).documents, 'stays'), accommodation_id: a.id, type: a.type, amenities: a.amenities, from_price: rs.length ? Math.min(...rs.map(r => r.price_per_night)) : null }; };
  const need = (ok, msg) => { if (!ok) throw new Error(msg); };
  const mine = (user, bid) => db.businesses.find(b => b.id === bid && b.owner_id === user.id && b.status === 'approved');
  const provOf = (user, approved = true) => db.providers.find(p => p.owner_id === user.id && (!approved || p.status === 'approved'));
  const monthly = (arr) => Object.entries(arr.reduce((m, d) => { const k = d.slice(0, 7); m[k] = (m[k] || 0) + 1; return m; }, {})).sort().reverse().slice(0, 12).map(([month, n]) => ({ month, n }));

  const routes = [];
  const R = (m, p, fn, roles) => routes.push([m, new RegExp('^' + p.replace(/:\w+/g, '([^/]+)') + '$'), fn, roles]);
  const currentUser = () => { const t = io.token() || ''; return t.startsWith('demo:') ? db.users.find(u => u.id === t.slice(5) && u.is_active) : null; };
  const pending = [];
  async function handle(method, fullPath, body) {
    db = await loadDb(); const u = new URL(fullPath, 'http://x');
    for (const [m, re, fn, roles] of routes) {
      if (m !== method) continue; const mt = re.exec(u.pathname); if (!mt) continue;
      const user = currentUser();
      if (roles) { need(user, 'Sign in required'); need(!roles.length || roles.includes(user.role), 'Forbidden'); }
      const out = await fn({ p: mt.slice(1), q: Object.fromEntries(u.searchParams), b: body || {}, user });
      if (method !== 'GET') await io.save(db);
      await Promise.allSettled(pending.splice(0));
      return structuredClone(out ?? { ok: true });
    }
    throw new Error('Not found');
  }

  // ---- auth
  R('POST', '/auth/register', ({ b }) => {
    need(/^\S+@\S+$/.test(b.email || '') && (b.password || '').length >= 8 && (b.fullName || '').length >= 2, 'Check your details and try again');
    need(['tourist', 'business_owner', 'transport_provider'].includes(b.role || 'tourist'), 'Check your details and try again');
    need(!db.users.some(x => x.email === b.email.toLowerCase()), 'Email already registered');
    const x = { id: uid(), email: b.email.toLowerCase(), password: b.password, full_name: b.fullName, role: b.role || 'tourist', is_active: true, created_at: now() }; db.users.push(x);
    return { token: 'demo:' + x.id, user: { id: x.id, role: x.role, full_name: x.full_name } };
  });
  R('POST', '/auth/login', ({ b }) => { const x = db.users.find(y => y.email === (b.email || '').toLowerCase() && y.password === b.password && y.is_active); need(x, 'Wrong email or password'); return { token: 'demo:' + x.id, user: { id: x.id, role: x.role, full_name: x.full_name } }; });
  // ---- public listings
  R('GET', '/municipalities', () => db.municipalities);
  R('GET', '/destinations', ({ q, user }) => db.destinations.filter(d => d.is_published && (!q.municipality || mn(d.municipality_id) === q.municipality) && (!q.q || d.name.toLowerCase().includes(q.q.toLowerCase()))).map(d => ({ ...dest(d), points: user ? tierPts(d.point_tier_id) : null })).sort((a, b) => a.name.localeCompare(b.name)));
  R('GET', '/destinations/:id', ({ p, user }) => { const d = db.destinations.find(x => x.id === p[0] && x.is_published); need(d, 'Destination not found'); return { ...dest(d), points: user ? tierPts(d.point_tier_id) : null }; });
  R('GET', '/restaurants', ({ q }) => db.restaurants.filter(r => biz(r.business_id).status === 'approved' && (!q.cuisine || r.cuisines.some(c => c.toLowerCase() === q.cuisine.toLowerCase()))).map(restRow));
  R('GET', '/restaurants/:id', ({ p }) => { const r = db.restaurants.find(x => x.id === p[0]); need(r, 'Restaurant not found'); return { ...restRow(r), papers: papersView(biz(r.business_id), 'restaurants'), menu: db.menus.filter(m => m.restaurant_id === r.id) }; });
  R('GET', '/accommodations', () => db.accommodations.filter(a => biz(a.business_id).status === 'approved').map(accRow));
  R('GET', '/accommodations/:id', ({ p }) => { const a = db.accommodations.find(x => x.id === p[0]); need(a && biz(a.business_id).status === 'approved', 'Accommodation not found'); return { ...accRow(a), papers: papersView(biz(a.business_id), 'stays'), rooms: db.rooms.filter(r => r.accommodation_id === a.id).sort((x, y) => x.price_per_night - y.price_per_night) }; });
  R('GET', '/businesses', ({ q }) => db.businesses.filter(b => b.status === 'approved' && ['Souvenir shops', 'Groceries'].includes(b.category) && (!q.category || b.category === q.category)).map(b => ({ ...bizPub(b), papers_status: overall(b.documents, 'shops') })));
  R('GET', '/businesses/:id', ({ p }) => { const b = biz(p[0]); need(b && b.status === 'approved', 'Business not found'); return { ...bizPub(b), papers: papersView(b, kindOfBiz(b)) }; });
  R('POST', '/businesses', ({ b, user }) => { need((b.name || '').length >= 2 && b.municipalityId, 'Check your business details'); const x = { id: uid(), owner_id: user.id, name: b.name, municipality_id: Number(b.municipalityId), description: b.description, address: b.address, phone: b.phone, lat: null, lng: null, hours: null, status: 'pending', category: b.category || null, created_at: now(), documents: [] }; db.businesses.push(x); return { id: x.id, status: x.status }; }, ['business_owner']);
  R('GET', '/reviews', ({ q }) => { const rows = db.reviews.filter(r => r.listing_type === q.type && r.listing_id === q.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(r => ({ rating: r.rating, comment: r.comment, created_at: r.created_at, name: db.users.find(u => u.id === r.user_id)?.full_name.split(' ')[0] })); return { average: rows.length ? Math.round(rows.reduce((s, r) => s + r.rating, 0) / rows.length * 10) / 10 : null, count: rows.length, reviews: rows }; });
  R('POST', '/reviews', ({ b, user }) => { need(Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5, 'Choose a rating from 1 to 5'); const ex = db.reviews.find(r => r.user_id === user.id && r.listing_type === b.type && r.listing_id === b.id); if (ex) Object.assign(ex, { rating: b.rating, comment: b.comment }); else db.reviews.push({ user_id: user.id, listing_type: b.type, listing_id: b.id, rating: b.rating, comment: b.comment, created_at: now() }); }, []);
  // ---- check-ins and rewards
  R('POST', '/checkin', ({ b, user }) => {
    const q = db.qr.find(x => x.token === b.token); need(q, 'This QR code is not recognized'); need(q.is_active, 'This QR code has been deactivated');
    need(!db.checkins.some(c => c.user_id === user.id && c.qr_id === q.id && Date.now() - new Date(c.created_at) < q.cooldown_hours * 36e5), `You already checked in here. Try again after ${q.cooldown_hours} hours.`);
    let pts = q.points_override; if (pts == null && q.listing_type === 'destination') pts = tierPts(db.destinations.find(d => d.id === q.listing_id)?.point_tier_id); pts ??= 10;
    db.checkins.push({ id: uid(), user_id: user.id, qr_id: q.id, points: pts, created_at: now() }); db.points.push({ id: uid(), user_id: user.id, delta: pts, reason: 'check-in', verified: true, created_at: now() }); return { points: pts, place: qrName(q) || 'this place', listing_type: q.listing_type };
  }, []);
  R('GET', '/checkin/me', ({ user }) => ({ balance: balance(user.id), history: db.checkins.filter(c => c.user_id === user.id).map(c => ({ created_at: c.created_at, points_awarded: c.points })).reverse() }), []);
  R('GET', '/rewards', () => db.rewards.filter(r => r.is_active));
  R('GET', '/rewards/leaderboard', () => Object.entries(db.points.filter(p => p.verified).reduce((m, p) => (m[p.user_id] = (m[p.user_id] || 0) + p.delta, m), {})).map(([id, points]) => ({ full_name: db.users.find(u => u.id === id)?.full_name, points })).sort((a, b) => b.points - a.points).slice(0, 20));
  R('POST', '/rewards/claim', ({ b, user }) => { const r = db.redemptions.find(x => x.claim_code === String(b.code || '').toUpperCase() && !x.claimed_at); need(r, 'Code is invalid or already claimed'); r.claimed_at = now(); log(user, 'reward.claim', r.id); }, ['admin']);
  R('POST', '/rewards/:id/redeem', ({ p, user }) => {
    const rw = db.rewards.find(r => r.id === p[0] && r.is_active); need(rw, 'Reward not available'); need(rw.stock == null || rw.stock > 0, 'This reward is out of stock');
    const bal = balance(user.id); need(bal >= rw.points_cost, `You need ${rw.points_cost - bal} more points`);
    const claim = rnd(10); const rd = { id: uid(), user_id: user.id, reward_id: rw.id, claim_code: claim, claimed_at: null }; db.redemptions.push(rd);
    db.points.push({ id: uid(), user_id: user.id, delta: -rw.points_cost, reason: 'redeemed: ' + rw.name, created_at: now() }); if (rw.stock != null) rw.stock--; return { claimCode: claim };
  }, []);
  // ---- stays, tables, payments
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const free = (room, ci, co) => room.quantity - db.stays.filter(s => s.room_id === room.id && ['pending', 'confirmed'].includes(s.status) && s.check_in < co && s.check_out > ci).length;
  R('GET', '/bookings/availability', ({ q }) => { need(q.checkIn && q.checkOut && q.checkOut > q.checkIn, 'Choose valid dates'); return db.rooms.filter(r => r.accommodation_id === q.accommodationId && r.capacity >= Number(q.guests || 1) && free(r, q.checkIn, q.checkOut) > 0).map(r => ({ ...r, available: free(r, q.checkIn, q.checkOut) })).sort((a, b) => a.price_per_night - b.price_per_night); });
  R('POST', '/bookings/stay', ({ b, user }) => {
    const room = db.rooms.find(r => r.id === b.roomId); need(room && b.checkOut > b.checkIn && room.capacity >= b.guests, 'Room not available for that group size'); need(free(room, b.checkIn, b.checkOut) > 0, 'Sorry, that room was just taken for those dates');
    const total = room.price_per_night * days(b.checkIn, b.checkOut); const pay = { id: uid(), user_id: user.id, amount: total, provider_ref: 'SBX-' + rnd(12), status: 'pending' }; db.payments.push(pay);
    const s = { id: uid(), user_id: user.id, room_id: room.id, check_in: b.checkIn, check_out: b.checkOut, guests: b.guests, total, status: 'pending', payment_id: pay.id, created_at: now() }; db.stays.push(s); return { booking: { id: s.id, status: s.status, total }, payment: pay };
  }, []);
  R('POST', '/bookings/stay/:id/cancel', ({ p, user }) => { const s = db.stays.find(x => x.id === p[0] && x.user_id === user.id && ['pending', 'confirmed'].includes(x.status) && x.check_in > now().slice(0, 10)); need(s, 'This booking can no longer be cancelled'); s.status = 'cancelled'; }, []);
  R('POST', '/bookings/reservation', ({ b, user }) => { const r = db.restaurants.find(x => x.id === b.restaurantId && x.accepts_reservations); need(r, 'This restaurant does not take reservations here'); need(new Date(b.reservedAt) > new Date(), 'Choose a future time'); db.tables.push({ id: uid(), user_id: user.id, restaurant_id: r.id, reserved_at: b.reservedAt, party_size: b.partySize, status: 'pending' }); }, []);
  R('POST', '/payments/:id/sandbox-confirm', ({ p, user }) => { const pay = db.payments.find(x => x.id === p[0] && x.user_id === user.id); need(pay, 'Payment not found'); if (pay.status !== 'pending') return { paid: false, sandbox: true }; pay.status = 'paid'; db.stays.filter(s => s.payment_id === pay.id && s.status === 'pending').forEach(s => { s.status = 'confirmed'; }); return { paid: true, sandbox: true }; }, []);
  R('GET', '/bookings/mine', ({ user }) => ({
    stays: db.stays.filter(s => s.user_id === user.id).reverse().map(s => { const room = db.rooms.find(r => r.id === s.room_id), a = db.accommodations.find(x => x.id === room.accommodation_id), pay = db.payments.find(x => x.id === s.payment_id); return { id: s.id, check_in: s.check_in, check_out: s.check_out, total: s.total, status: s.status, payment_id: s.payment_id, payment_status: pay?.status, provider_ref: pay?.provider_ref, name: biz(a.business_id).name }; }),
    rides: db.rides.filter(r => r.user_id === user.id).reverse().map(r => ({ ...r, driver_name: db.vehicles.find(v => v.id === r.vehicle_id)?.driver_name })),
    tables: db.tables.filter(t => t.user_id === user.id).map(t => ({ ...t, name: biz(db.restaurants.find(r => r.id === t.restaurant_id).business_id).name })) }), []);
  // ---- transport
  R('GET', '/transport/routes', ({ q }) => db.routes.filter(r => db.providers.find(p => p.id === r.provider_id)?.status === 'approved' && (!q.origin || r.origin.toLowerCase() === q.origin.toLowerCase())).map(r => ({ ...r, provider: db.providers.find(p => p.id === r.provider_id).name, provider_cover: db.providers.find(p => p.id === r.provider_id).cover_photo || null, vehicles: db.vehicles.filter(v => v.provider_id === r.provider_id && v.is_available) })));
  R('POST', '/transport/book', ({ b, user }) => {
    const rt = db.routes.find(r => r.id === b.routeId); need(rt && new Date(b.pickupAt) > new Date() && b.passengers >= 1, 'Check your ride details');
    const v = b.vehicleId && db.vehicles.find(x => x.id === b.vehicleId); if (b.vehicleId) need(v && v.capacity >= b.passengers, 'That vehicle cannot take your group');
    const x = { id: uid(), user_id: user.id, route_id: rt.id, vehicle_id: v?.id ?? null, pickup: rt.origin, dropoff: rt.destination, pickup_at: b.pickupAt, passengers: b.passengers, luggage: b.luggage, fare: rt.fare, status: 'pending', created_at: now() }; db.rides.push(x); return { booking: { id: x.id, status: x.status } };
  }, []);
  R('GET', '/transport/provider/me', ({ user }) => { const p = provOf(user, false); if (!p) return { provider: null }; return { provider: p, vehicles: db.vehicles.filter(v => v.provider_id === p.id), routes: db.routes.filter(r => r.provider_id === p.id) }; }, ['transport_provider']);
  R('POST', '/transport/provider', ({ b, user }) => { need((b.name || '').length >= 2, 'Check your details'); const p = { id: uid(), owner_id: user.id, name: b.name, phone: b.phone, status: 'pending', created_at: now(), documents: [] }; db.providers.push(p); return { id: p.id, status: p.status }; }, ['transport_provider']);
  R('POST', '/transport/vehicles', ({ b, user }) => { const p = provOf(user); need(p, 'Your provider account is not approved yet'); need(b.type && b.capacity >= 1, 'Check vehicle details'); need(b.rentSelf != null || b.rentDriver != null || true, ''); const v = { id: uid(), provider_id: p.id, name: b.name || b.type, type: b.type, capacity: b.capacity, plate_no: b.plateNo, driver_name: b.driverName, description: b.description || '', rent_self: nn(b.rentSelf), rent_driver: nn(b.rentDriver), is_available: true }; db.vehicles.push(v); return { id: v.id }; }, ['transport_provider']);
  R('POST', '/transport/routes', ({ b, user }) => { const p = provOf(user); need(p, 'Your provider account is not approved yet'); need(b.origin && b.destination && b.fare >= 0, 'Check route details'); const r = { id: uid(), provider_id: p.id, origin: b.origin, destination: b.destination, fare: b.fare, est_minutes: b.estMinutes ?? null }; db.routes.push(r); return { id: r.id }; }, ['transport_provider']);
  R('GET', '/transport/provider/bookings', ({ user }) => { const p = provOf(user); if (!p) return []; const ids = db.routes.filter(r => r.provider_id === p.id).map(r => r.id); return db.rides.filter(r => ids.includes(r.route_id)).sort((a, b) => a.pickup_at.localeCompare(b.pickup_at)).map(r => ({ ...r, full_name: db.users.find(u => u.id === r.user_id)?.full_name, payment_status: 'not tracked in demo' })); }, ['transport_provider']);
  R('PATCH', '/transport/bookings/:id', ({ p, b, user }) => { const pv = provOf(user); need(pv && ['confirmed', 'rejected', 'completed'].includes(b.status), 'Invalid request'); const r = db.rides.find(x => x.id === p[0] && db.routes.find(y => y.id === x.route_id)?.provider_id === pv.id); need(r, 'Booking not found'); r.status = b.status; }, ['transport_provider']);
  // ---- business owner
  R('GET', '/owner/businesses', ({ user }) => db.businesses.filter(b => b.owner_id === user.id).map(b => ({ id: b.id, name: b.name, status: b.status })), ['business_owner']);
  R('POST', '/owner/accommodations', ({ b, user }) => { need(mine(user, b.businessId) && b.type, 'Business not found or not approved yet'); const a = { id: uid(), business_id: b.businessId, type: b.type, amenities: b.amenities || [] }; db.accommodations.push(a); return { id: a.id }; }, ['business_owner']);
  R('POST', '/owner/rooms', ({ b, user }) => { const a = db.accommodations.find(x => x.id === b.accommodationId && biz(x.business_id).owner_id === user.id); need(a, 'Not your accommodation'); need(b.name && b.capacity >= 1 && b.pricePerNight >= 0, 'Check room details'); const r = { id: uid(), accommodation_id: a.id, name: b.name, capacity: b.capacity, price_per_night: b.pricePerNight, quantity: b.quantity || 1 }; db.rooms.push(r); return { id: r.id }; }, ['business_owner']);
  R('GET', '/owner/accommodations', ({ user }) => db.accommodations.filter(a => biz(a.business_id).owner_id === user.id).map(a => ({ id: a.id, type: a.type, name: biz(a.business_id).name, rooms: db.rooms.filter(r => r.accommodation_id === a.id).map(r => ({ id: r.id, name: r.name, capacity: r.capacity, price: r.price_per_night, quantity: r.quantity })) })), ['business_owner']);
  const ownerStays = (user) => db.stays.filter(s => biz(db.accommodations.find(a => a.id === db.rooms.find(r => r.id === s.room_id).accommodation_id).business_id).owner_id === user.id);
  R('GET', '/owner/bookings', ({ user }) => ownerStays(user).reverse().map(s => ({ id: s.id, check_in: s.check_in, check_out: s.check_out, guests: s.guests, total: s.total, status: s.status, full_name: db.users.find(u => u.id === s.user_id)?.full_name, room: db.rooms.find(r => r.id === s.room_id).name })), ['business_owner']);
  R('GET', '/owner/analytics', ({ user }) => { const s = ownerStays(user); return { bookings: s.length, pending: s.filter(x => x.status === 'pending').length, confirmed_revenue: s.filter(x => x.status === 'confirmed').reduce((t, x) => t + x.total, 0) }; }, ['business_owner']);
  R('GET', '/owner/restaurants', ({ user }) => db.restaurants.filter(r => biz(r.business_id).owner_id === user.id).map(r => ({ id: r.id, name: biz(r.business_id).name, cuisines: r.cuisines, menu: db.menus.filter(m => m.restaurant_id === r.id).map(m => ({ id: m.id, name: m.item_name, price: m.price })) })), ['business_owner']);
  R('POST', '/owner/restaurants', ({ b, user }) => { need(mine(user, b.businessId), 'Business not found or not approved yet'); const r = { id: uid(), business_id: b.businessId, cuisines: b.cuisines || [], price_range: b.priceRange || null, accepts_reservations: !!b.acceptsReservations }; db.restaurants.push(r); return { id: r.id }; }, ['business_owner']);
  R('POST', '/owner/menu-items', ({ b, user }) => { const r = db.restaurants.find(x => x.id === b.restaurantId && biz(x.business_id).owner_id === user.id); need(r && b.itemName && b.price >= 0, 'Not your restaurant'); db.menus.push({ id: uid(), restaurant_id: r.id, item_name: b.itemName, description: b.description, price: b.price }); }, ['business_owner']);
  R('POST', '/owner/qr', ({ b, user }) => { const bz = mine(user, b.businessId); need(bz, 'Business not found or not approved yet'); let q = db.qr.find(x => x.listing_type === 'business' && x.listing_id === bz.id && x.is_active); if (!q) { q = { id: uid(), listing_type: 'business', listing_id: bz.id, token: 'demo-' + rnd(8).toLowerCase(), points_override: null, cooldown_hours: 24, is_active: true }; db.qr.push(q); } return { id: q.id }; }, ['business_owner']);
  // ---- admin
  R('GET', '/admin/stats', () => ({ tourists: db.users.filter(u => u.role === 'tourist').length, businesses: db.businesses.filter(b => b.status === 'approved').length, pendingBusinesses: db.businesses.filter(b => b.status === 'pending').length, destinations: db.destinations.length, pointsIssued: db.points.filter(p => p.delta > 0).reduce((s, p) => s + p.delta, 0), redemptions: db.redemptions.length }), ['admin']);
  R('GET', '/admin/businesses/pending', () => db.businesses.filter(b => b.status === 'pending').map(b => ({ ...b, kind: kindOfBiz(b), papers: paperSummary(b, kindOfBiz(b)), owner_email: db.users.find(u => u.id === b.owner_id)?.email })), ['admin']);
  R('PATCH', '/admin/businesses/:id/status', ({ p, b, user }) => { const x = biz(p[0]); need(x && ['approved', 'rejected', 'suspended'].includes(b.status), 'Invalid status'); need(b.status !== 'approved' || overall(x.documents, kindOfBiz(x)) === 'complete', 'Upload and verify all the required documents before approving this business.'); x.status = b.status; log(user, 'business.' + b.status, x.id); }, ['admin']);
  R('GET', '/admin/providers/pending', () => db.providers.filter(p => p.status === 'pending').map(p => ({ ...p, papers: paperSummary(p, 'transport'), email: db.users.find(u => u.id === p.owner_id)?.email })), ['admin']);
  R('PATCH', '/admin/providers/:id/status', ({ p, b, user }) => { const x = db.providers.find(y => y.id === p[0]); need(x && ['approved', 'rejected', 'suspended'].includes(b.status), 'Invalid status'); need(b.status !== 'approved' || overall(x.documents, 'transport') === 'complete', 'Upload and verify all the required documents before approving this provider.'); x.status = b.status; log(user, 'provider.' + b.status, x.id); }, ['admin']);
  R('GET', '/admin/point-tiers', () => db.tiers, ['admin']);
  R('PUT', '/admin/point-tiers/:id', ({ p, b, user }) => { need(Number.isInteger(b.points) && b.points >= 0, 'Points must be a whole number'); db.tiers.find(t => t.id == p[0]).points = b.points; log(user, 'tier.update', p[0]); }, ['admin']);
  R('POST', '/admin/destinations', ({ b, user }) => { need((b.name || '').length >= 2 && b.municipalityId, 'Check the destination details'); const d = { id: uid(), name: b.name, municipality_id: b.municipalityId, description: b.description, history: '', address: mn(b.municipalityId), lat: b.lat ?? null, lng: b.lng ?? null, entrance_fee: null, hours: null, facilities: [], safety_notes: '', accessibility_notes: '', travel_minutes_from_virac: b.travelMinutes ?? null, point_tier_id: b.pointTierId ?? null, is_published: !!b.isPublished }; db.destinations.push(d); db.qr.push({ id: uid(), listing_type: 'destination', listing_id: d.id, token: 'demo-' + rnd(8).toLowerCase(), points_override: null, cooldown_hours: 24, is_active: true }); log(user, 'destination.create', d.id); return { id: d.id }; }, ['admin']);
  R('POST', '/admin/rewards', ({ b, user }) => { need((b.name || '').length >= 2 && b.pointsCost >= 1, 'Check the reward details'); const r = { id: uid(), name: b.name, description: b.description, points_cost: b.pointsCost, stock: b.stock ?? null, is_active: true }; db.rewards.push(r); log(user, 'reward.create', r.id); return { id: r.id }; }, ['admin']);
  const qrName = (q) => q.listing_type === 'destination' ? db.destinations.find(d => d.id === q.listing_id)?.name : q.listing_type === 'accommodation' ? biz(db.accommodations.find(a => a.id === q.listing_id)?.business_id)?.name : q.listing_type === 'restaurant' ? biz(db.restaurants.find(r => r.id === q.listing_id)?.business_id)?.name : biz(q.listing_id)?.name;
  R('GET', '/admin/qr', () => db.qr.map(q => ({ ...q, name: qrName(q) })).reverse(), ['admin']);
  R('POST', '/admin/qr', ({ b }) => { const key = String(b.listingId || '').toLowerCase(); const lists = { destination: db.destinations, business: db.businesses, accommodation: db.accommodations, restaurant: db.restaurants }; const l = lists[b.listingType]?.find(x => x.id === b.listingId || x.name?.toLowerCase() === key); need(l, 'Listing not found'); db.qr.push({ id: uid(), listing_type: b.listingType, listing_id: l.id, token: 'demo-' + rnd(8).toLowerCase(), points_override: b.pointsOverride ?? null, cooldown_hours: b.cooldownHours || 24, is_active: true }); }, ['admin']);
  R('PATCH', '/admin/qr/:id/deactivate', ({ p, user }) => { db.qr.find(q => q.id === p[0]).is_active = false; log(user, 'qr.deactivate', p[0]); }, ['admin']);
  R('GET', '/admin/users', () => db.users.slice().reverse(), ['admin']);
  R('PATCH', '/admin/users/:id/active', ({ p, b, user }) => { need(p[0] !== user.id, 'You cannot deactivate your own account'); db.users.find(u => u.id === p[0]).is_active = !!b.active; log(user, 'user.active', p[0]); }, ['admin']);
  R('GET', '/admin/reports', () => { const pays = Object.values(db.payments.reduce((m, p) => { (m[p.status] ||= { status: p.status, n: 0, total: 0 }); m[p.status].n++; m[p.status].total += p.amount; return m; }, {})); const top = Object.values(db.checkins.reduce((m, c) => { const q = db.qr.find(x => x.id === c.qr_id); if (q?.listing_type === 'destination') { const n = qrName(q); (m[n] ||= { name: n, visits: 0 }).visits++; } return m; }, {})).sort((a, b) => b.visits - a.visits);
    return { checkinsByMonth: monthly(db.checkins.map(c => c.created_at)), bookingsByMonth: monthly([...db.stays, ...db.rides, ...db.rentals].map(x => x.created_at)), topDestinations: top, payments: pays }; }, ['admin']);
  R('GET', '/admin/audit', () => db.audit.slice(0, 100), ['admin']);
  // ---- itineraries
  const view = (it) => { const items = it.items.slice().sort((a, b) => a.day_no - b.day_no || a.position - b.position).map(i => { let name = i.title, l = null;
    if (i.listing_type === 'destination') l = db.destinations.find(x => x.id === i.listing_id); else if (i.listing_type === 'restaurant') l = biz(db.restaurants.find(x => x.id === i.listing_id)?.business_id); else if (i.listing_type === 'accommodation') l = biz(db.accommodations.find(x => x.id === i.listing_id)?.business_id); else if (i.listing_type === 'business') l = biz(i.listing_id);
    return { ...i, name: l?.name ?? name, lat: l?.lat ?? null, lng: l?.lng ?? null }; });
    const { items: out, totals } = withLegs(items, it.budget); return { id: it.id, title: it.title, budget: it.budget, preferences: it.preferences, share_token: it.share_token, items: out, totals }; };
  const ownIt = (p, user) => { const it = db.itineraries.find(x => x.id === p && x.user_id === user.id); need(it, 'Itinerary not found'); return it; };
  R('GET', '/itineraries/shared/:token', ({ p }) => { const it = db.itineraries.find(x => x.share_token === p[0]); need(it, 'Itinerary not found'); const v = view(it); delete v.share_token; return v; });
  R('GET', '/itineraries', ({ user }) => db.itineraries.filter(i => i.user_id === user.id).map(i => ({ id: i.id, title: i.title, budget: i.budget })).reverse(), []);
  R('POST', '/itineraries/generate', ({ b, user }) => {
    need(b.title && b.days >= 1 && b.days <= 10, 'Check your trip preferences'); const per = { relaxed: 2, balanced: 3, adventurous: 4 }[b.pace] || 3;
    const pref = b.destinationIds || [], pool = db.destinations.filter(d => d.is_published && (!b.municipality || mn(d.municipality_id) === b.municipality)).sort((x, y) => pref.includes(y.id) - pref.includes(x.id)); const ordered = nearestOrder(pool.slice(0, b.days * per));
    const foods = db.restaurants.filter(r => biz(r.business_id).status === 'approved' && (!b.cuisine || (r.cuisines || []).some(c => c.toLowerCase() === b.cuisine.toLowerCase()))); const stays = db.accommodations.map(a => ({ a, price: Math.min(...db.rooms.filter(r => r.accommodation_id === a.id).map(r => r.price_per_night)) })).filter(x => isFinite(x.price)).sort((x, y) => x.price - y.price);
    const it = { id: uid(), user_id: user.id, title: b.title, budget: b.budget ?? null, preferences: b, share_token: null, items: [] }; let n = 0;
    for (let day = 1; day <= b.days; day++) {
      const todays = ordered.slice((day - 1) * per, day * per); let mins = 540, pos = 0;
      const put = (type, lid, cost, dur) => { it.items.push({ id: uid(), day_no: day, position: pos++, listing_type: type, listing_id: lid, title: null, start_time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, duration_min: dur, est_cost: cost, notes: null }); mins += dur + 30; };
      todays.forEach((d, i) => { if (i === Math.ceil(todays.length / 2) && foods.length) { const f = foods[n++ % foods.length], ms = db.menus.filter(m => m.restaurant_id === f.id); put('restaurant', f.id, ms.length ? Math.round(ms.reduce((s, m) => s + m.price, 0) / ms.length) : null, 60); } put('destination', d.id, d.entrance_fee, 90); });
      if (day === 1 && b.days > 1 && stays[0]) it.items.push({ id: uid(), day_no: 1, position: pos, listing_type: 'accommodation', listing_id: stays[0].a.id, title: null, start_time: null, duration_min: null, est_cost: stays[0].price * (b.days - 1), notes: `Cheapest listed room, ${b.days - 1} night(s). Change it if you prefer.` });
    }
    db.itineraries.push(it); return view(it);
  }, []);
  R('GET', '/itineraries/:id', ({ p, user }) => view(ownIt(p[0], user)), []);
  R('PUT', '/itineraries/:id', ({ p, b, user }) => { const it = ownIt(p[0], user); need(b.title && Array.isArray(b.items), 'Check your itinerary changes'); const pos = {}; it.title = b.title; it.budget = b.budget ?? null;
    it.items = b.items.map(i => { pos[i.day_no] = (pos[i.day_no] ?? -1) + 1; return { id: uid(), day_no: i.day_no, position: pos[i.day_no], listing_type: i.listing_type ?? null, listing_id: i.listing_id ?? null, title: i.title ?? null, start_time: i.start_time ?? null, duration_min: i.duration_min ?? null, est_cost: i.est_cost ?? null, notes: i.notes ?? null }; }); return view(it); }, []);
  R('POST', '/itineraries/:id/duplicate', ({ p, user }) => { const it = ownIt(p[0], user); const c = { ...structuredClone(it), id: uid(), title: it.title + ' (copy)', share_token: null }; c.items.forEach(i => { i.id = uid(); }); db.itineraries.push(c); return { id: c.id }; }, []);
  R('POST', '/itineraries/:id/share', ({ p, user }) => { const it = ownIt(p[0], user); it.share_token ||= rnd(24).toLowerCase(); return { token: it.share_token }; }, []);

  // ---- admin content manager: add, edit and delete everything the public pages show
  const nn = (v) => (v === '' || v == null ? null : Number(v));
  const hoursOf = (t) => (t ? { Hours: t } : null), hoursTxt = (h) => (h ? Object.values(h).join('; ') : '');
  const tags = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean));
  const newQr = (type, id) => ({ id: uid(), listing_type: type, listing_id: id, token: 'demo-' + rnd(8).toLowerCase(), points_override: null, cooldown_hours: 24, is_active: true });
  const needBiz = (x) => need((x.name || '').trim().length >= 2 && x.municipalityId, 'Name and municipality are required');
  const refs = (o) => [o.cover_photo, ...(o.photos || [])].filter(Boolean);
  const photoFields = (x) => ({ cover_photo: x.cover || null, photos: Array.isArray(x.photos) ? x.photos.filter(Boolean) : [] });
  const dropOrphans = (old, o) => { const keep = new Set(refs(o)); old.filter(r => !keep.has(r)).forEach(deletePhoto); };
  const bizApply = (b, x) => { needBiz(x); const old = refs(b); Object.assign(b, { ...photoFields(x), name: x.name.trim(), municipality_id: Number(x.municipalityId), description: x.description || '', address: x.address || '', phone: x.phone || '', lat: nn(x.lat), lng: nn(x.lng), hours: hoursOf(x.hoursText) }); dropOrphans(old, b); if (x.status) { need(!(x.status === 'approved' && b.status === 'pending') || overall(b.documents, kindOfBiz(b)) === 'complete', 'Upload and verify all the required documents before approving this business.'); b.status = x.status; } if (x.category !== undefined) b.category = x.category || null; };
  const bizView = (b) => ({ cover: b.cover_photo || '', photos: b.photos || [], name: b.name, municipalityId: b.municipality_id, description: b.description, address: b.address, phone: b.phone, lat: b.lat, lng: b.lng, hoursText: hoursTxt(b.hours), status: b.status });
  const bizAdd = (user, category) => { const b = { id: uid(), owner_id: user.id, status: 'approved', category, hours: null, created_at: now(), documents: [] }; db.businesses.push(b); return b; };
  const bizDrop = (id) => { const b0 = db.businesses.find(b => b.id === id) || {}; refs(b0).forEach(deletePhoto); (b0.documents || []).forEach(d => deletePhoto(d.file)); db.businesses = db.businesses.filter(b => b.id !== id); };
  const qrDrop = (...ids) => { db.qr = db.qr.filter(q => !ids.includes(q.listing_id)); };
  const destApply = (d, x) => { needBiz(x); Object.assign(d, { name: x.name.trim(), municipality_id: Number(x.municipalityId), description: x.description || '', history: x.history || '', address: x.address || mn(Number(x.municipalityId)), lat: nn(x.lat), lng: nn(x.lng), entrance_fee: nn(x.entranceFee), hours: hoursOf(x.hoursText), facilities: tags(x.facilities), safety_notes: x.safetyNotes || '', accessibility_notes: x.accessibilityNotes || '', travel_minutes_from_virac: nn(x.travelMinutes), point_tier_id: nn(x.pointTierId), is_published: !!x.isPublished, cover_photo: x.cover || null, photos: Array.isArray(x.photos) ? x.photos.filter(Boolean) : [] }); };
  const K = {
    destinations: {
      list: () => db.destinations,
      view: (d) => ({ id: d.id, title: d.name, sub: `${mn(d.municipality_id)} · ${tierPts(d.point_tier_id) ?? 0} pts · ${new Set([d.cover_photo, ...(d.photos || [])].filter(Boolean)).size} photo(s)`, status: d.is_published ? 'published' : 'draft', name: d.name, municipalityId: d.municipality_id, description: d.description, history: d.history, address: d.address, lat: d.lat, lng: d.lng, entranceFee: d.entrance_fee, hoursText: hoursTxt(d.hours), facilities: (d.facilities || []).join(', '), accessibilityNotes: d.accessibility_notes, safetyNotes: d.safety_notes, travelMinutes: d.travel_minutes_from_virac, pointTierId: d.point_tier_id, isPublished: d.is_published, cover: d.cover_photo || '', photos: d.photos || [] }),
      create: (x) => { const d = { id: uid() }; destApply(d, x); db.destinations.push(d); db.qr.push(newQr('destination', d.id)); return d; },
      update: (d, x) => { const old = [d.cover_photo, ...(d.photos || [])]; destApply(d, x); const keep = new Set([d.cover_photo, ...d.photos]); old.filter(r => r && !keep.has(r)).forEach(deletePhoto); },
      remove: (d) => { [d.cover_photo, ...(d.photos || [])].forEach(r => r && deletePhoto(r)); db.destinations = db.destinations.filter(y => y !== d); qrDrop(d.id); } },
    stays: {
      list: () => db.accommodations,
      view: (a) => { const b = biz(a.business_id); return { papers: paperSummary(b, 'stays'), id: a.id, title: b.name, sub: `${mn(b.municipality_id)} · ${a.type}`, status: b.status, ...bizView(b), type: a.type, amenities: (a.amenities || []).join(', '), rooms: db.rooms.filter(r => r.accommodation_id === a.id).map(r => ({ id: r.id, text: `${r.name} · sleeps ${r.capacity} · ₱${r.price_per_night}/night · ${r.quantity} unit(s)` })) }; },
      create: (x, user) => { needBiz(x); const b = bizAdd(user, 'Hotels and resorts'); bizApply(b, x); const a = { id: uid(), business_id: b.id, type: x.type || 'inn', amenities: tags(x.amenities) }; db.accommodations.push(a); return a; },
      update: (a, x) => { bizApply(biz(a.business_id), x); a.type = x.type || a.type; a.amenities = tags(x.amenities); },
      remove: (a) => { const ids = db.rooms.filter(r => r.accommodation_id === a.id).map(r => r.id); db.stays = db.stays.filter(s => !ids.includes(s.room_id)); db.rooms = db.rooms.filter(r => r.accommodation_id !== a.id); db.accommodations = db.accommodations.filter(y => y !== a); bizDrop(a.business_id); qrDrop(a.id, a.business_id); },
      subs: { rooms: {
        add: (a, x) => { need((x.name || '').trim() && Number(x.capacity) >= 1 && x.pricePerNight !== '' && Number(x.pricePerNight) >= 0, 'Check the room details'); db.rooms.push({ id: uid(), accommodation_id: a.id, name: x.name.trim(), capacity: Number(x.capacity), price_per_night: Number(x.pricePerNight), quantity: Number(x.quantity) || 1 }); },
        del: (a, sid) => { db.stays = db.stays.filter(s => s.room_id !== sid); db.rooms = db.rooms.filter(r => !(r.id === sid && r.accommodation_id === a.id)); } } } },
    restaurants: {
      list: () => db.restaurants,
      view: (r) => { const b = biz(r.business_id); return { papers: paperSummary(b, 'restaurants'), id: r.id, title: b.name, sub: `${mn(b.municipality_id)} · ${(r.cuisines || []).join(', ') || 'no cuisine set'}`, status: b.status, ...bizView(b), cuisines: (r.cuisines || []).join(', '), priceRange: r.price_range, acceptsReservations: r.accepts_reservations, menu: db.menus.filter(m => m.restaurant_id === r.id).map(m => ({ id: m.id, text: `${m.item_name} · ₱${m.price}` })) }; },
      create: (x, user) => { needBiz(x); const b = bizAdd(user, 'Restaurants'); bizApply(b, x); const r = { id: uid(), business_id: b.id, cuisines: tags(x.cuisines), price_range: nn(x.priceRange), accepts_reservations: !!x.acceptsReservations }; db.restaurants.push(r); return r; },
      update: (r, x) => { bizApply(biz(r.business_id), x); Object.assign(r, { cuisines: tags(x.cuisines), price_range: nn(x.priceRange), accepts_reservations: !!x.acceptsReservations }); },
      remove: (r) => { db.tables = db.tables.filter(t => t.restaurant_id !== r.id); db.menus = db.menus.filter(m => m.restaurant_id !== r.id); db.restaurants = db.restaurants.filter(y => y !== r); bizDrop(r.business_id); qrDrop(r.id, r.business_id); },
      subs: { menu: {
        add: (r, x) => { need((x.itemName || '').trim() && x.price !== '' && Number(x.price) >= 0, 'Check the menu item'); db.menus.push({ id: uid(), restaurant_id: r.id, item_name: x.itemName.trim(), description: x.description || '', price: Number(x.price) }); },
        del: (r, sid) => { db.menus = db.menus.filter(m => !(m.id === sid && m.restaurant_id === r.id)); } } } },
    transport: {
      list: () => db.providers,
      view: (p) => ({ papers: paperSummary(p, 'transport'), id: p.id, title: p.name, sub: `${db.vehicles.filter(v => v.provider_id === p.id).length} vehicles · ${db.routes.filter(r => r.provider_id === p.id).length} routes`, status: p.status, name: p.name, phone: p.phone, cover: p.cover_photo || '', photos: p.photos || [],
        vehicles: db.vehicles.filter(v => v.provider_id === p.id).map(v => ({ id: v.id, name: v.name, type: v.type, capacity: v.capacity, plateNo: v.plate_no, driverName: v.driver_name, rentDriver: v.rent_driver, rentSelf: v.rent_self, description: v.description, cover: v.cover_photo || '', photos: v.photos || [], text: `${v.name || v.type} · ${v.type} · seats ${v.capacity}${v.rent_driver != null ? ' · with driver ₱' + v.rent_driver + '/day' : ''}${v.rent_self != null ? ' · self-drive ₱' + v.rent_self + '/day' : ''}` })), routes: db.routes.filter(r => r.provider_id === p.id).map(r => ({ id: r.id, text: `${r.origin} → ${r.destination} · ₱${r.fare}` })) }),
      create: (x, user) => { need((x.name || '').trim().length >= 2, 'Name is required'); const p = { id: uid(), owner_id: user.id, name: x.name.trim(), phone: x.phone || '', status: x.status || 'approved', created_at: now(), documents: [], ...photoFields(x) }; db.providers.push(p); return p; },
      update: (p, x) => { need((x.name || '').trim().length >= 2, 'Name is required'); const old = refs(p); Object.assign(p, { name: x.name.trim(), phone: x.phone || '', status: x.status || p.status, ...photoFields(x) }); dropOrphans(old, p); },
      remove: (p) => { refs(p).forEach(deletePhoto); (p.documents || []).forEach(d => deletePhoto(d.file)); const rid = db.routes.filter(r => r.provider_id === p.id).map(r => r.id); db.rides = db.rides.filter(r => !rid.includes(r.route_id)); db.routes = db.routes.filter(r => r.provider_id !== p.id); const vids = db.vehicles.filter(v => v.provider_id === p.id).map(v => v.id); db.vehicles.filter(v => v.provider_id === p.id).forEach(v => refs(v).forEach(deletePhoto)); db.rentals = db.rentals.filter(r => !vids.includes(r.vehicle_id)); db.vehicles = db.vehicles.filter(v => v.provider_id !== p.id); db.providers = db.providers.filter(y => y !== p); },
      subs: { vehicles: {
        add: (p, x) => { need(x.type && Number(x.capacity) >= 1, 'Check the vehicle details'); db.vehicles.push({ id: uid(), provider_id: p.id, name: x.name || x.type, type: x.type, capacity: Number(x.capacity), plate_no: x.plateNo || '', driver_name: x.driverName || '', description: x.description || '', rent_self: nn(x.rentSelf), rent_driver: nn(x.rentDriver), ...photoFields(x), is_available: true }); },
        upd: (p, sid, x) => { const v = db.vehicles.find(y => y.id === sid && y.provider_id === p.id); need(v, 'Not found'); need(x.type && Number(x.capacity) >= 1, 'Check the vehicle details'); const old = refs(v); Object.assign(v, { name: x.name || x.type, type: x.type, capacity: Number(x.capacity), plate_no: x.plateNo || '', driver_name: x.driverName || '', description: x.description || '', rent_self: nn(x.rentSelf), rent_driver: nn(x.rentDriver), ...photoFields(x) }); dropOrphans(old, v); },
        del: (p, sid) => { refs(db.vehicles.find(v => v.id === sid) || {}).forEach(deletePhoto); db.rentals = db.rentals.filter(r => r.vehicle_id !== sid); db.rides.forEach(r => { if (r.vehicle_id === sid) r.vehicle_id = null; }); db.vehicles = db.vehicles.filter(v => !(v.id === sid && v.provider_id === p.id)); } },
        routes: {
        add: (p, x) => { need((x.origin || '').trim() && (x.destination || '').trim() && x.fare !== '' && Number(x.fare) >= 0, 'Check the route details'); db.routes.push({ id: uid(), provider_id: p.id, origin: x.origin.trim(), destination: x.destination.trim(), fare: Number(x.fare), est_minutes: nn(x.estMinutes) }); },
        del: (p, sid) => { db.rides = db.rides.filter(r => r.route_id !== sid); db.routes = db.routes.filter(r => !(r.id === sid && r.provider_id === p.id)); } } } },
    businesses: {
      list: () => db.businesses.filter(b => !db.accommodations.some(a => a.business_id === b.id) && !db.restaurants.some(r => r.business_id === b.id)),
      view: (b) => ({ papers: paperSummary(b, kindOfBiz(b)), id: b.id, title: b.name, sub: `${mn(b.municipality_id)} · ${b.category || 'Uncategorized'}`, ...bizView(b), category: b.category || '' }),
      create: (x, user) => { needBiz(x); const b = bizAdd(user, x.category || null); bizApply(b, x); return b; },
      update: bizApply, remove: (b) => { bizDrop(b.id); qrDrop(b.id); } },
    rewards: {
      list: () => db.rewards,
      view: (r) => ({ id: r.id, title: r.name, sub: `${r.points_cost} pts · stock ${r.stock ?? 'unlimited'}`, status: r.is_active ? 'approved' : 'hidden', name: r.name, description: r.description, pointsCost: r.points_cost, stock: r.stock, isActive: r.is_active, cover: r.cover_photo || '', photos: r.photos || [] }),
      create: (x) => { const r = { id: uid() }; K.rewards.update(r, x); db.rewards.push(r); return r; },
      update: (r, x) => { need((x.name || '').trim().length >= 2 && Number(x.pointsCost) >= 1, 'Name and a points cost of at least 1 are required'); const old = refs(r); Object.assign(r, { name: x.name.trim(), description: x.description || '', points_cost: Number(x.pointsCost), stock: nn(x.stock), is_active: x.isActive !== false, ...photoFields(x) }); dropOrphans(old, r); },
      remove: (r) => { refs(r).forEach(deletePhoto); db.rewards = db.rewards.filter(y => y !== r); } },
  };
  const kd = (k) => { need(K[k], 'Unknown section'); return K[k]; };
  const found = (k, id) => { const e = kd(k).list().find(y => y.id === id); need(e, 'Not found'); return e; };
  R('GET', '/admin/manage/:kind', ({ p }) => kd(p[0]).list().map(kd(p[0]).view), ['admin']);
  R('POST', '/admin/manage/:kind', ({ p, b, user }) => { const e = kd(p[0]).create(b, user); log(user, `${p[0]}.create`, e.id); return kd(p[0]).view(e); }, ['admin']);
  R('PUT', '/admin/manage/:kind/:id', ({ p, b, user }) => { const e = found(p[0], p[1]); kd(p[0]).update(e, b); log(user, `${p[0]}.update`, e.id); return kd(p[0]).view(e); }, ['admin']);
  R('DELETE', '/admin/manage/:kind/:id', ({ p, user }) => { const e = found(p[0], p[1]); kd(p[0]).remove(e); log(user, `${p[0]}.delete`, p[1]); }, ['admin']);
  R('POST', '/admin/manage/:kind/:id/:sub', ({ p, b }) => { const e = found(p[0], p[1]), s = kd(p[0]).subs?.[p[2]]; need(s, 'Unknown section'); s.add(e, b); return kd(p[0]).view(e); }, ['admin']);
  R('DELETE', '/admin/manage/:kind/:id/:sub/:subId', ({ p }) => { const e = found(p[0], p[1]), s = kd(p[0]).subs?.[p[2]]; need(s, 'Unknown section'); s.del(e, p[3]); return kd(p[0]).view(e); }, ['admin']);

  R('DELETE', '/itineraries/:id', ({ p, user }) => { ownIt(p[0], user); db.itineraries = db.itineraries.filter(i => i.id !== p[0]); }, []);

  // ---- vehicle rentals (with driver or self-drive)
  const vehOk = (v) => v.is_available && db.providers.find(p => p.id === v.provider_id)?.status === 'approved';
  const vehRow = (v) => { const p = db.providers.find(x => x.id === v.provider_id); return { papers_status: overall(p?.documents, 'transport'), cover_photo: v.cover_photo || null, photos: v.photos || [], id: v.id, name: v.name || v.type, type: v.type, capacity: v.capacity, description: v.description, rent_self: v.rent_self ?? null, rent_driver: v.rent_driver ?? null, provider: p?.name, provider_phone: p?.phone, provider_cover: p?.cover_photo || null, provider_photos: p?.photos || [] }; };
  const clash = (vid, a, b) => db.rentals.some(r => r.vehicle_id === vid && ['pending', 'confirmed'].includes(r.status) && r.start_date <= b && r.end_date >= a);
  const rentRow = (r) => { const v = db.vehicles.find(x => x.id === r.vehicle_id), pay = db.payments.find(x => x.id === r.payment_id); return { id: r.id, vehicle: v?.name || 'Vehicle', type: v?.type, mode: r.mode, start_date: r.start_date, end_date: r.end_date, days: r.days, total: r.total, status: r.status, payment_id: r.payment_id, payment_status: pay?.status, pickup: r.pickup, passengers: r.passengers, driver_name: r.mode === 'driver' ? v?.driver_name : null, destinations: r.destinations.map(id => db.destinations.find(d => d.id === id)?.name).filter(Boolean), full_name: db.users.find(u => u.id === r.user_id)?.full_name }; };
  R('GET', '/rentals/vehicles', ({ q }) => db.vehicles.filter(v => vehOk(v) && (!q.type || v.type === q.type) && (q.mode !== 'driver' || v.rent_driver != null) && (q.mode !== 'self' || v.rent_self != null)).map(vehRow));
  R('GET', '/rentals/vehicles/:id', ({ p }) => { const v = db.vehicles.find(x => x.id === p[0]); need(v && vehOk(v), 'Vehicle not found'); return { ...vehRow(v), papers: papersView(db.providers.find(x => x.id === v.provider_id), 'transport') }; });
  R('GET', '/rentals/availability', ({ q }) => ({ available: !clash(q.vehicleId, q.start, q.end) }));
  R('POST', '/rentals/book', ({ b, user }) => {
    const v = db.vehicles.find(x => x.id === b.vehicleId); need(v && vehOk(v), 'Vehicle not available'); const rate = b.mode === 'driver' ? v.rent_driver : b.mode === 'self' ? v.rent_self : null;
    need(rate != null, 'That option is not offered for this vehicle'); need(b.start && b.end && b.end >= b.start && b.start >= now().slice(0, 10), 'Choose valid dates');
    need(Array.isArray(b.destinations) && b.destinations.length >= 1, 'Choose at least one destination'); need(Number(b.passengers) >= 1 && Number(b.passengers) <= v.capacity, `This vehicle seats ${v.capacity}`);
    if (b.mode === 'self') need(b.licenseOk, "Self-drive renters must confirm they hold a valid driver's license"); need(!clash(v.id, b.start, b.end), 'This vehicle is already booked on those dates');
    const n = days(b.start, b.end) + 1, total = rate * n, pay = { id: uid(), user_id: user.id, amount: total, provider_ref: 'SBX-' + rnd(12), status: 'pending' }; db.payments.push(pay);
    const r = { id: uid(), user_id: user.id, vehicle_id: v.id, mode: b.mode, start_date: b.start, end_date: b.end, days: n, destinations: b.destinations, pickup: b.pickup || '', passengers: Number(b.passengers), total, status: 'pending', payment_id: pay.id, created_at: now() }; db.rentals.push(r);
    return { rental: { id: r.id, status: r.status, total }, payment: pay };
  }, []);
  R('GET', '/rentals/mine', ({ user }) => db.rentals.filter(r => r.user_id === user.id).reverse().map(rentRow), []);
  R('POST', '/rentals/:id/cancel', ({ p, user }) => { const r = db.rentals.find(x => x.id === p[0] && x.user_id === user.id && ['pending', 'confirmed'].includes(x.status) && x.start_date > now().slice(0, 10)); need(r, 'This rental can no longer be cancelled'); r.status = 'cancelled'; }, []);
  R('GET', '/transport/provider/rentals', ({ user }) => { const pv = provOf(user); if (!pv) return []; const ids = db.vehicles.filter(v => v.provider_id === pv.id).map(v => v.id); return db.rentals.filter(r => ids.includes(r.vehicle_id)).map(rentRow).sort((a, b) => a.start_date.localeCompare(b.start_date)); }, ['transport_provider']);
  R('PATCH', '/transport/rentals/:id', ({ p, b, user }) => { const pv = provOf(user); need(pv && ['confirmed', 'rejected', 'completed'].includes(b.status), 'Invalid request'); const r = db.rentals.find(x => x.id === p[0] && db.vehicles.find(v => v.id === x.vehicle_id)?.provider_id === pv.id); need(r, 'Rental not found'); r.status = b.status; }, ['transport_provider']);

  R('PUT', '/admin/manage/:kind/:id/:sub/:subId', ({ p, b }) => { const e = found(p[0], p[1]), s = kd(p[0]).subs?.[p[2]]; need(s?.upd, 'This item cannot be edited'); s.upd(e, p[3], b); return kd(p[0]).view(e); }, ['admin']);

  // ---- credits page (public read, admin edit)
  R('GET', '/credits', () => db.credits);
  R('PUT', '/credits', ({ b, user }) => {
    const company = (b.company || '').trim(); need(company, 'Company name is required');
    const members = (Array.isArray(b.members) ? b.members : []).map(m => ({ id: m.id || uid(), name: (m.name || '').trim(), role: (m.role || '').trim(), photo: m.photo || '' })); need(members.every(m => m.name), 'Every member needs a name');
    const old = db.credits.members.map(m => m.photo).filter(Boolean); db.credits = { company, members }; const keep = new Set(members.map(m => m.photo)); old.filter(r => !keep.has(r)).forEach(deletePhoto); log(user, 'credits.update'); return db.credits;
  }, ['admin']);

  R('GET', '/qr-token/:id', ({ p, user }) => { const q = db.qr.find(x => x.id === p[0]); need(q, 'Not found'); need(user.role === 'admin' || (q.listing_type === 'business' && biz(q.listing_id)?.owner_id === user.id), 'Forbidden'); return { token: q.token }; }, []);
  R('POST', '/admin/reset', async ({ user }) => { await io.wipePhotos?.(); db = seed(io.adminPassword?.()); log({ email: 'system' }, 'demo.reset'); return { ok: true }; }, ['admin']);

  // ---- business papers: upload, verify, list. Admin manages everything; owners and providers upload for themselves.
  const okFile = (v) => typeof v === 'string' && /^(idb:|\/api\/photos\/)/.test(v);
  const addDoc = (o, b, who, verified) => {
    need(DOC_LABELS[b.type], 'Choose a document type'); need(okFile(b.file), 'Please upload the document file'); need(!b.expires || /^\d{4}-\d{2}-\d{2}$/.test(b.expires), 'Check the expiry date');
    (o.documents ||= []).push({ id: uid(), type: b.type, number: String(b.number || '').slice(0, 60), expires: b.expires || '', file: b.file, fileName: String(b.fileName || '').slice(0, 120), public: b.public !== false, verified, verifiedAt: verified ? now() : null, uploadedAt: now(), by: who.full_name });
  };
  const dropDoc = (o, id) => { const d = (o.documents || []).find(x => x.id === id); need(d, 'Document not found'); deletePhoto(d.file); o.documents = o.documents.filter(x => x.id !== id); };
  const tgt = (kind, id) => { const t = docTarget(kind, id); need(t && t.obj, 'Not found'); return t; };
  R('GET', '/doc-types', () => ({ labels: DOC_LABELS, required: REQUIRED }));
  R('GET', '/admin/docs/:kind/:id', ({ p }) => { const t = tgt(p[0], p[1]); return papersView(t.obj, t.kind, true); }, ['admin']);
  R('POST', '/admin/docs/:kind/:id', ({ p, b, user }) => { const t = tgt(p[0], p[1]); addDoc(t.obj, b, user, true); log(user, 'document.add', p[1]); return papersView(t.obj, t.kind, true); }, ['admin']);
  R('PATCH', '/admin/docs/:kind/:id/:docId', ({ p, b, user }) => { const t = tgt(p[0], p[1]), d = (t.obj.documents || []).find(x => x.id === p[2]); need(d, 'Document not found');
    if (b.verified !== undefined) { d.verified = !!b.verified; d.verifiedAt = d.verified ? now() : null; } if (b.public !== undefined) d.public = !!b.public;
    if (b.number !== undefined) d.number = String(b.number).slice(0, 60); if (b.expires !== undefined) { need(!b.expires || /^\d{4}-\d{2}-\d{2}$/.test(b.expires), 'Check the expiry date'); d.expires = b.expires; }
    log(user, 'document.update', p[1]); return papersView(t.obj, t.kind, true); }, ['admin']);
  R('DELETE', '/admin/docs/:kind/:id/:docId', ({ p, user }) => { const t = tgt(p[0], p[1]); dropDoc(t.obj, p[2]); log(user, 'document.delete', p[1]); return papersView(t.obj, t.kind, true); }, ['admin']);
  const mineBiz = (user, id) => { const o = db.businesses.find(x => x.id === id && x.owner_id === user.id); need(o, 'Business not found'); return o; };
  R('GET', '/owner/docs/:id', ({ p, user }) => { const o = mineBiz(user, p[0]); return papersView(o, kindOfBiz(o), true); }, ['business_owner']);
  R('POST', '/owner/docs/:id', ({ p, b, user }) => { const o = mineBiz(user, p[0]); addDoc(o, b, user, false); return papersView(o, kindOfBiz(o), true); }, ['business_owner']);
  R('DELETE', '/owner/docs/:id/:docId', ({ p, user }) => { const o = mineBiz(user, p[0]); need(!(o.documents || []).find(d => d.id === p[1])?.verified, 'Verified documents can only be removed by the tourism office.'); dropDoc(o, p[1]); return papersView(o, kindOfBiz(o), true); }, ['business_owner']);
  const myProv = (user) => { const o = db.providers.find(x => x.owner_id === user.id); need(o, 'Register your transport service first'); return o; };
  R('GET', '/transport/provider/docs', ({ user }) => papersView(myProv(user), 'transport', true), ['transport_provider']);
  R('POST', '/transport/provider/docs', ({ b, user }) => { const o = myProv(user); addDoc(o, b, user, false); return papersView(o, 'transport', true); }, ['transport_provider']);
  R('DELETE', '/transport/provider/docs/:docId', ({ p, user }) => { const o = myProv(user); need(!(o.documents || []).find(d => d.id === p[0])?.verified, 'Verified documents can only be removed by the tourism office.'); dropDoc(o, p[0]); return papersView(o, 'transport', true); }, ['transport_provider']);
  // ---- registry report of every business on the platform (the admin downloads it as CSV or PDF)
  R('GET', '/admin/business-report', ({ q }) => {
    const rows = [], who = (o) => db.users.find(u => u.id === o.owner_id);
    const add = (type, kind, o, detail) => { const docs = o.documents || [], u = who(o); rows.push({ id: o.id, name: o.name, type, kind, detail, municipality: o.municipality_id ? mn(o.municipality_id) : '', address: o.address || '', phone: o.phone || '', owner: u?.full_name || '', email: u?.email || '', status: o.status, registered: (o.created_at || '').slice(0, 10), papers: overall(docs, REQUIRED[kind] ? kind : 'shops'), papers_detail: REQUIRED[kind].map(t => `${DOC_LABELS[t].split(' (')[0]}: ${typeState(docs, t)}`).join('; ') }); };
    db.accommodations.forEach(a => add('Stay', 'stays', biz(a.business_id), a.type)); db.restaurants.forEach(r => add('Eat', 'restaurants', biz(r.business_id), (r.cuisines || []).join(', ')));
    K.businesses.list().forEach(o => add('Shop', 'shops', o, o.category || '')); db.providers.forEach(o => add('Transport', 'transport', o, `${db.vehicles.filter(v => v.provider_id === o.id).length} vehicle(s)`));
    const t = q.type || 'all', st = q.status || 'all', pp = q.papers || 'all';
    return { generated: now(), rows: rows.filter(r => (t === 'all' || r.kind === t) && (st === 'all' || r.status === st) && (pp === 'all' || r.papers === pp)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)) };
  }, ['admin']);
  // ---- site branding (logo, name, developer badge): public read, admin edit
  R('GET', '/branding', () => db.branding);
  R('PUT', '/branding', ({ b, user }) => {
    const siteName = (b.siteName || '').trim(); need(siteName && siteName.length <= 40, 'Site name is required (40 characters at most)');
    const okRef = (v) => v === '' || /^(idb:|\/api\/photos\/|\/logo-|https?:\/\/)/.test(v), logo = b.logo || '', partnerLogo = b.partnerLogo || '';
    need(okRef(logo) && okRef(partnerLogo), 'That logo is not valid'); need(['navy', 'white', 'none'].includes(b.partnerBackdrop || 'navy'), 'Choose a badge background');
    const old = [db.branding.logo, db.branding.partnerLogo].filter(Boolean);
    db.branding = { siteName, tagline: (b.tagline || '').trim().slice(0, 80), logo, partnerLogo, showPartner: b.showPartner !== false, partnerBackdrop: b.partnerBackdrop || 'navy' };
    const keep = new Set([logo, partnerLogo]); old.filter(r => !keep.has(r)).forEach(deletePhoto); log(user, 'branding.update'); return db.branding;
  }, ['admin']);
  return { handle, qrToken: (id) => db?.qr.find(q => q.id === id)?.token, whoami: async () => { db = await loadDb(); return currentUser(); } };
}
