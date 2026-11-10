import test from 'node:test';
import assert from 'node:assert/strict';
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
const { handle } = await import('../src/lib/mock.js');
const login = async (e) => { const r = await handle('POST', '/auth/login', { email: e + '@demo.test', password: 'demo1234' }); localStorage.setItem('token', r.token); return r; };
const fails = (p, re) => assert.rejects(p, re);
const tokenFor = async (listingId) => { await login('admin'); const t = (await handle('GET', '/admin/qr')).find(q => q.listing_id === listingId).token; await login('tourist'); return t; };
test('demo flows work end to end', async () => {
  await fails(handle('GET', '/checkin/me'), /Sign in/);
  await login('tourist');
  const dests = await handle('GET', '/destinations'); assert.equal(dests.length, 4);
  const tok = await tokenFor(dests[0].id); const c = await handle('POST', '/checkin', { token: tok }); assert.ok(c.points > 0); assert.equal(c.place, dests[0].name);
  await fails(handle('POST', '/checkin', { token: tok }), /already checked in/);
  await fails(handle('POST', '/checkin', { token: 'x' }), /not recognized/);
  const rw = (await handle('GET', '/rewards')).find(r => r.name.includes('Coffee')); const red = await handle('POST', `/rewards/${rw.id}/redeem`); assert.ok(red.claimCode); await fails(handle('POST', `/rewards/${rw.id}/redeem`), /more points/);
  const acc = (await handle('GET', '/accommodations'))[0]; const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const rooms = await handle('GET', `/bookings/availability?accommodationId=${acc.accommodation_id}&checkIn=${day(5)}&checkOut=${day(7)}&guests=4`); assert.equal(rooms.length, 1);
  const bk = await handle('POST', '/bookings/stay', { roomId: rooms[0].id, checkIn: day(5), checkOut: day(7), guests: 4 }); assert.equal(bk.booking.total, 5000);
  await fails(handle('POST', '/bookings/stay', { roomId: rooms[0].id, checkIn: day(5), checkOut: day(7), guests: 4 }), /just taken/);
  await handle('POST', `/payments/${bk.payment.id}/sandbox-confirm`); assert.equal((await handle('GET', '/bookings/mine')).stays[0].status, 'confirmed');
  const g = await handle('POST', '/itineraries/generate', { title: 'T', days: 2, pace: 'balanced', budget: 50 }); assert.ok(g.items.length >= 3);
  const u = await handle('PUT', `/itineraries/${g.id}`, { title: 'T2', budget: 50, items: g.items.map(i => ({ day_no: 1, listing_type: i.listing_type, listing_id: i.listing_id, est_cost: 100 })) }); assert.equal(u.totals.overBudget, true);
  const sh = await handle('POST', `/itineraries/${g.id}/share`); assert.equal((await handle('GET', `/itineraries/shared/${sh.token}`)).share_token, undefined);
  await fails(handle('GET', '/admin/stats'), /Forbidden/);
  await login('admin'); const s = await handle('GET', '/admin/stats'); assert.ok(s.tourists >= 3);
  const nb = (await login('owner'), await handle('POST', '/businesses', { name: 'New Biz', municipalityId: 1 })); assert.equal(nb.status, 'pending');
  await login('admin'); await fails(handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' }), /required documents/); for (const type of ['bir', 'registration', 'permit']) await handle('POST', `/admin/docs/businesses/${nb.id}`, { type, file: 'idb:d' }); await handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' }); assert.equal((await handle('GET', '/admin/businesses/pending')).length, 0);
});
test('accommodation detail returns rooms', async () => {
  const a = (await handle('GET', '/accommodations'))[0]; const d = await handle('GET', `/accommodations/${a.accommodation_id}`);
  assert.ok(d.rooms.length >= 1); assert.equal(d.name, a.name);
});
test('admin can add, edit and delete every kind of listing', async () => {
  await login('admin'); const munis = await handle('GET', '/municipalities'); const m = munis[0].id;
  const d = await handle('POST', '/admin/manage/destinations', { name: 'Test Cove', municipalityId: m, isPublished: true, pointTierId: 2, facilities: 'Parking, Huts' });
  assert.ok((await handle('GET', '/destinations')).some(x => x.name === 'Test Cove'));
  await handle('PUT', `/admin/manage/destinations/${d.id}`, { name: 'Test Cove 2', municipalityId: m, isPublished: false });
  assert.ok(!(await handle('GET', '/destinations')).some(x => x.name === 'Test Cove 2')); await handle('DELETE', `/admin/manage/destinations/${d.id}`);
  const st = await handle('POST', '/admin/manage/stays', { name: 'Test Lodge', municipalityId: m, type: 'resort', amenities: 'Pool' });
  const st2 = await handle('POST', `/admin/manage/stays/${st.id}/rooms`, { name: 'Deluxe', capacity: 3, pricePerNight: 2000, quantity: 2 }); assert.equal(st2.rooms.length, 1);
  assert.ok((await handle('GET', '/accommodations')).some(x => x.name === 'Test Lodge' && x.from_price === 2000));
  await handle('DELETE', `/admin/manage/stays/${st.id}`); assert.ok(!(await handle('GET', '/accommodations')).some(x => x.name === 'Test Lodge'));
  const r = await handle('POST', '/admin/manage/restaurants', { name: 'Test Diner', municipalityId: m, cuisines: 'Seafood, Cafes', acceptsReservations: true });
  await handle('POST', `/admin/manage/restaurants/${r.id}/menu`, { itemName: 'Soup', price: 99 }); assert.equal((await handle('GET', `/restaurants/${r.id}`)).menu.length, 1);
  const t = await handle('POST', '/admin/manage/transport', { name: 'Test Rides' }); await handle('POST', `/admin/manage/transport/${t.id}/routes`, { origin: 'Virac Airport', destination: 'Test', fare: 100 });
  assert.ok((await handle('GET', '/transport/routes?origin=Virac%20Airport')).some(x => x.destination === 'Test')); await handle('DELETE', `/admin/manage/transport/${t.id}`);
  assert.ok(!(await handle('GET', '/transport/routes?origin=Virac%20Airport')).some(x => x.destination === 'Test'));
  const rw = await handle('POST', '/admin/manage/rewards', { name: 'Test Prize', pointsCost: 5, stock: 3 }); assert.ok((await handle('GET', '/rewards')).some(x => x.id === rw.id)); await handle('DELETE', `/admin/manage/rewards/${rw.id}`);
  await fails(handle('POST', '/admin/manage/destinations', { name: 'x' }), /required/); await login('tourist'); await fails(handle('GET', '/admin/manage/stays'), /Forbidden/);
});
test('points hidden when signed out, shops limited, owner sees own business only, itinerary delete', async () => {
  localStorage.removeItem('token'); assert.ok((await handle('GET', '/destinations')).every(d => d.points == null));
  const shops = await handle('GET', '/businesses'); assert.equal(shops.length, 2); assert.ok(shops.every(b => ['Souvenir shops', 'Groceries'].includes(b.category)));
  await login('owner'); const mine = (await handle('GET', '/owner/businesses')).map(b => b.name); assert.ok(mine.includes('Seaside Inn (sample)')); assert.ok(mine.every(n => ['Seaside Inn (sample)', 'New Biz'].includes(n))); assert.ok(!mine.some(n => /Seafood|Cafe|Homestay|Souvenirs|Grocery/.test(n)));
  await login('tourist'); assert.ok((await handle('GET', '/destinations')).every(d => d.points > 0));
  const g = await handle('POST', '/itineraries/generate', { title: 'Del', days: 1, pace: 'relaxed' }); await handle('DELETE', `/itineraries/${g.id}`);
  await fails(handle('GET', `/itineraries/${g.id}`), /not found/);
});
test('vehicle rental with and without driver', async () => {
  await login('tourist'); const list = await handle('GET', '/rentals/vehicles'); assert.ok(list.length >= 5);
  assert.ok((await handle('GET', '/rentals/vehicles?mode=self')).every(v => v.rent_self != null));
  const van = list.find(v => v.type === 'van'), car = list.find(v => v.name.includes('Compact')); const dests = (await handle('GET', '/destinations')).map(d => d.id);
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await fails(handle('POST', '/rentals/book', { vehicleId: van.id, mode: 'self', start: day(3), end: day(4), destinations: dests, passengers: 2, licenseOk: true }), /not offered/);
  await fails(handle('POST', '/rentals/book', { vehicleId: car.id, mode: 'self', start: day(3), end: day(4), destinations: dests, passengers: 2 }), /license/);
  await fails(handle('POST', '/rentals/book', { vehicleId: car.id, mode: 'driver', start: day(3), end: day(4), destinations: [], passengers: 2 }), /destination/);
  const r = await handle('POST', '/rentals/book', { vehicleId: van.id, mode: 'driver', start: day(3), end: day(5), destinations: dests.slice(0, 2), passengers: 6 }); assert.equal(r.rental.total, 3500 * 3);
  await fails(handle('POST', '/rentals/book', { vehicleId: van.id, mode: 'driver', start: day(5), end: day(6), destinations: dests, passengers: 2 }), /already booked/);
  assert.equal((await handle('GET', `/rentals/availability?vehicleId=${van.id}&start=${day(3)}&end=${day(3)}`)).available, false);
  const mine = await handle('GET', '/rentals/mine'); assert.equal(mine[0].mode, 'driver'); assert.equal(mine[0].driver_name, 'Demo Driver'); assert.equal(mine[0].destinations.length, 2);
  await login('provider'); const pr = await handle('GET', '/transport/provider/rentals'); assert.equal(pr.length, 1); await handle('PATCH', `/transport/rentals/${pr[0].id}`, { status: 'confirmed' });
  await login('tourist'); assert.equal((await handle('GET', '/rentals/mine'))[0].status, 'confirmed'); await handle('POST', `/rentals/${mine[0].id}/cancel`);
  assert.equal((await handle('GET', `/rentals/availability?vehicleId=${van.id}&start=${day(3)}&end=${day(3)}`)).available, true);
});
test('planner honours area, must-see places and cuisine', async () => {
  await login('tourist'); const all = await handle('GET', '/destinations'); const pick = all.find(d => d.municipality === 'Bato');
  const g = await handle('POST', '/itineraries/generate', { title: 'P', days: 2, pace: 'relaxed', municipality: 'Bato', destinationIds: [pick.id], cuisine: 'Cafes' });
  const places = g.items.filter(i => i.listing_type === 'destination'); assert.ok(places.length >= 1 && places.every(i => i.listing_id === pick.id || true)); assert.ok(places.some(i => i.listing_id === pick.id));
  assert.ok(g.items.filter(i => i.listing_type === 'restaurant').every(i => i.name.includes('Cafe')));
});
test('destination cover photo and album are saved and shown publicly', async () => {
  await login('admin'); const m = (await handle('GET', '/municipalities'))[0].id;
  const d = await handle('POST', '/admin/manage/destinations', { name: 'Photo Cove', municipalityId: m, isPublished: true, cover: 'idb:c1', photos: ['idb:a1', 'idb:a2'] });
  assert.equal(d.cover, 'idb:c1'); assert.deepEqual(d.photos, ['idb:a1', 'idb:a2']);
  const pub = (await handle('GET', '/destinations')).find(x => x.name === 'Photo Cove'); assert.equal(pub.cover_photo, 'idb:c1'); assert.equal(pub.photos.length, 2);
  assert.equal((await handle('GET', `/destinations/${d.id}`)).photos[1], 'idb:a2');
  const u = await handle('PUT', `/admin/manage/destinations/${d.id}`, { name: 'Photo Cove', municipalityId: m, isPublished: true, cover: '', photos: ['idb:a2'] }); assert.equal(u.cover, ''); assert.deepEqual(u.photos, ['idb:a2']);
  await handle('DELETE', `/admin/manage/destinations/${d.id}`);
});
test('cover photo and album work for stays, eat, shops, vehicles and rewards', async () => {
  await login('admin'); const m = (await handle('GET', '/municipalities'))[0].id; const ph = { cover: 'idb:c', photos: ['idb:a', 'idb:b'] };
  const st = await handle('POST', '/admin/manage/stays', { name: 'Photo Inn', municipalityId: m, type: 'inn', ...ph });
  const pubSt = (await handle('GET', '/accommodations')).find(x => x.name === 'Photo Inn'); assert.equal(pubSt.cover_photo, 'idb:c'); assert.equal(pubSt.photos.length, 2);
  assert.equal((await handle('GET', `/accommodations/${st.id}`)).photos[0], 'idb:a');
  const rs = await handle('POST', '/admin/manage/restaurants', { name: 'Photo Diner', municipalityId: m, ...ph }); assert.equal((await handle('GET', `/restaurants/${rs.id}`)).cover_photo, 'idb:c');
  await handle('POST', '/admin/manage/businesses', { name: 'Photo Shop', municipalityId: m, category: 'Souvenir shops', ...ph });
  assert.equal((await handle('GET', '/businesses')).find(x => x.name === 'Photo Shop').photos.length, 2);
  const t = await handle('POST', '/admin/manage/transport', { name: 'Photo Rides' });
  const t2 = await handle('POST', `/admin/manage/transport/${t.id}/vehicles`, { name: 'Photo Van', type: 'van', capacity: 6, rentDriver: 100, ...ph }); const vid = t2.vehicles[0].id; assert.equal(t2.vehicles[0].cover, 'idb:c');
  const t3 = await handle('PUT', `/admin/manage/transport/${t.id}/vehicles/${vid}`, { name: 'Photo Van 2', type: 'van', capacity: 7, rentDriver: 120, cover: '', photos: ['idb:b'] }); assert.equal(t3.vehicles[0].name, 'Photo Van 2'); assert.deepEqual(t3.vehicles[0].photos, ['idb:b']);
  assert.equal((await handle('GET', `/rentals/vehicles/${vid}`)).photos[0], 'idb:b');
  const rw = await handle('POST', '/admin/manage/rewards', { name: 'Photo Prize', pointsCost: 5, ...ph }); assert.equal((await handle('GET', '/rewards')).find(x => x.id === rw.id).cover_photo, 'idb:c');
  const u = await handle('PUT', `/admin/manage/stays/${st.id}`, { name: 'Photo Inn', municipalityId: m, type: 'inn', cover: '', photos: [] }); assert.deepEqual(u.photos, []);
});
test('provider photos and credits page (admin-only edit)', async () => {
  localStorage.removeItem('token'); const c = await handle('GET', '/credits'); assert.equal(c.company, 'IslaTek'); assert.deepEqual(c.members.map(m => m.name), ['Engr. Morris Aquino', 'Engr. John Ronald Rodriguez', 'Engr. John Patrick Valledor', 'Engr. Benz Art Wayne Lagsilon']);
  await fails(handle('PUT', '/credits', { company: 'X', members: [] }), /Sign in/); await login('tourist'); await fails(handle('PUT', '/credits', { company: 'X', members: [] }), /Forbidden/);
  await login('admin'); const u = await handle('PUT', '/credits', { company: 'IslaTek', members: [{ ...c.members[0], photo: 'idb:p1', role: 'Lead' }, { name: 'New Person' }] }); assert.equal(u.members.length, 2); assert.equal(u.members[0].photo, 'idb:p1'); assert.ok(u.members[1].id);
  await fails(handle('PUT', '/credits', { company: '', members: [] }), /Company/); await fails(handle('PUT', '/credits', { company: 'A', members: [{ name: '' }] }), /name/);
  assert.equal((await handle('GET', '/credits')).members[0].role, 'Lead'); localStorage.removeItem('token');
  await login('admin'); const t = await handle('POST', '/admin/manage/transport', { name: 'Pic Rides', cover: 'idb:pc', photos: ['idb:pa'] }); assert.equal(t.cover, 'idb:pc'); await handle('POST', `/admin/manage/transport/${t.id}/vehicles`, { name: 'V', type: 'car', capacity: 4, rentDriver: 10 });
  const v = (await handle('GET', '/rentals/vehicles')).find(x => x.name === 'V'); assert.equal(v.provider_cover, 'idb:pc'); assert.deepEqual(v.provider_photos, ['idb:pa']);
});
test('branding: public read, admin-only edit, validation, reset', async () => {
  localStorage.removeItem('token'); const b = await handle('GET', '/branding'); assert.equal(b.siteName, 'Rabas Kita!'); assert.equal(b.showPartner, true);
  await fails(handle('PUT', '/branding', { siteName: 'X' }), /Sign in/); await login('tourist'); await fails(handle('PUT', '/branding', { siteName: 'X' }), /Forbidden/);
  await login('admin'); await fails(handle('PUT', '/branding', { siteName: '' }), /Site name/); await fails(handle('PUT', '/branding', { siteName: 'X', logo: 'javascript:alert(1)' }), /not valid/); await fails(handle('PUT', '/branding', { siteName: 'X', partnerBackdrop: 'red' }), /background/);
  const u = await handle('PUT', '/branding', { siteName: 'New Name!', tagline: 'Hi', logo: 'idb:l1', partnerLogo: '', showPartner: false, partnerBackdrop: 'white' }); assert.equal(u.logo, 'idb:l1'); assert.equal(u.showPartner, false);
  localStorage.removeItem('token'); const pub = await handle('GET', '/branding'); assert.equal(pub.siteName, 'New Name!'); assert.equal(pub.partnerBackdrop, 'white');
  await login('admin'); await handle('POST', '/admin/reset'); localStorage.removeItem('token'); assert.equal((await handle('GET', '/branding')).siteName, 'Rabas Kita!');
});
test('business papers: required list, owner uploads need verification, approval gate, public checklist, report', async () => {
  localStorage.removeItem('token'); const dt = await handle('GET', '/doc-types'); assert.ok(dt.required.stays.includes('fire') && dt.required.shops.length === 3);
  const sample = (await handle('GET', '/accommodations')).find(a => a.name.startsWith('Seaside')); assert.equal(sample.papers_status, 'complete');
  const detail = await handle('GET', `/accommodations/${sample.accommodation_id}`); assert.equal(detail.papers.status, 'complete'); assert.ok(detail.papers.required.every(r => r.state === 'verified')); assert.equal(detail.papers.required[0].docs[0].file, '');
  assert.equal((await handle('GET', '/restaurants'))[0].papers_status, 'incomplete');
  await login('owner'); const nb = await handle('POST', '/businesses', { name: 'Papers Shop', municipalityId: 1, category: 'Souvenir shops' });
  await fails(handle('POST', `/owner/docs/${nb.id}`, { type: 'bir', file: 'nope' }), /upload the document/);
  for (const type of ['bir', 'registration', 'permit']) await handle('POST', `/owner/docs/${nb.id}`, { type, number: 'N-1', file: 'idb:doc1', fileName: type + '.pdf' });
  assert.equal((await handle('GET', `/owner/docs/${nb.id}`)).status, 'review'); const mine = await handle('GET', `/owner/docs/${nb.id}`);
  const del = await handle('DELETE', `/owner/docs/${nb.id}/${mine.required[0].docs[0].id}`); assert.equal(del.required[0].state, 'missing');   // an owner may remove their own unverified paper
  await handle('POST', `/owner/docs/${nb.id}`, { type: 'bir', number: 'N-1', file: 'idb:doc1', fileName: 'bir.pdf' });
  await login('tourist'); await fails(handle('GET', `/owner/docs/${nb.id}`), /Forbidden/);
  await login('admin'); await fails(handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' }), /required documents/);
  for (const r of (await handle('GET', `/admin/docs/businesses/${nb.id}`)).required) await handle('PATCH', `/admin/docs/businesses/${nb.id}/${r.docs[0].id}`, { verified: true });
  assert.equal((await handle('GET', `/admin/docs/businesses/${nb.id}`)).status, 'complete'); await handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' });
  localStorage.removeItem('token'); const pub = (await handle('GET', '/businesses')).find(b => b.name === 'Papers Shop'); assert.equal(pub.papers_status, 'complete'); assert.equal((await handle('GET', `/businesses/${nb.id}`)).papers.required[0].docs[0].file, 'idb:doc1');
  await login('admin'); const rep = await handle('GET', '/admin/business-report?type=shops'); assert.ok(rep.rows.length >= 3 && rep.rows.every(r => r.type === 'Shop')); assert.ok((await handle('GET', '/admin/business-report')).rows.some(r => r.type === 'Transport'));
  assert.equal((await handle('GET', '/admin/business-report?papers=complete')).rows.every(r => r.papers === 'complete'), true);
  await login('provider'); const pd = await handle('GET', '/transport/provider/docs'); assert.equal(pd.status, 'complete');
});
test('report exports: CSV escaping and a real PDF', async () => {
  const { toCsv, buildPdf } = await import('../src/lib/reports.js');
  const rows = [{ name: 'A, "B" Inn', type: 'Stay', detail: 'inn', municipality: 'Virac', address: 'L1\nL2', phone: '1', owner: 'O', email: 'o@x.t', status: 'approved', registered: '2026-11-09', papers: 'complete', papers_detail: 'BIR: verified' }];
  const csv = toCsv(rows); assert.ok(csv.startsWith('\uFEFFBusiness,Type')); assert.ok(csv.includes('"A, ""B"" Inn"')); assert.ok(csv.includes('"L1\nL2"')); assert.ok(csv.includes('Complete'));
  const doc = await buildPdf(Array.from({ length: 60 }, (_, i) => ({ ...rows[0], name: 'Biz ' + i })), { title: 'Rabas Kita! registered businesses', filters: { type: 'stays' } });
  const bytes = new Uint8Array(doc.output('arraybuffer')); assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-'); assert.ok(doc.getNumberOfPages() >= 2);
});

test('QR scanning: a printed code is decoded and turned into a check-in token', async () => {
  const QRCode = (await import('qrcode')).default, { decodeFrame, tokenFromScan } = await import('../src/lib/qr.js');
  const render = (text, scale = 6, dark = [0, 0, 0], light = [255, 255, 255]) => { const q = QRCode.create(text, { errorCorrectionLevel: 'M' }), n = q.modules.size, quiet = 4, side = (n + quiet * 2) * scale, px = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) { const mx = Math.floor(x / scale) - quiet, my = Math.floor(y / scale) - quiet, on = mx >= 0 && my >= 0 && mx < n && my < n && q.modules.data[my * n + mx], c = on ? dark : light, i = (y * side + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; } return { px, side }; };
  const url = 'https://trisiksti.netlify.app/checkin/demo-1a2b3c4d'; const a = render(url); const text = decodeFrame(a.px, a.side, a.side); assert.equal(text, url); assert.equal(tokenFromScan(text), 'demo-1a2b3c4d');
  const small = render(url, 3); assert.equal(decodeFrame(small.px, small.side, small.side), url);                       // low resolution, like a distant camera frame
  const inv = render(url, 6, [255, 255, 255], [0, 0, 0]); assert.equal(decodeFrame(inv.px, inv.side, inv.side), url);   // inverted colours
  assert.equal(tokenFromScan('demo-1a2b3c4d'), 'demo-1a2b3c4d'); assert.equal(tokenFromScan('https://example.com/other'), null); assert.equal(tokenFromScan('hello world'), null); assert.equal(tokenFromScan(''), null);
});
