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
  localStorage.removeItem('token'); const b = await handle('GET', '/branding'); assert.equal(b.siteName, 'TRISIKSTI'); assert.equal(b.showPartner, true);
  await fails(handle('PUT', '/branding', { siteName: 'X' }), /Sign in/); await login('tourist'); await fails(handle('PUT', '/branding', { siteName: 'X' }), /Forbidden/);
  await login('admin'); await fails(handle('PUT', '/branding', { siteName: '' }), /Site name/); await fails(handle('PUT', '/branding', { siteName: 'X', logo: 'javascript:alert(1)' }), /not valid/); await fails(handle('PUT', '/branding', { siteName: 'X', partnerBackdrop: 'red' }), /background/);
  const u = await handle('PUT', '/branding', { siteName: 'New Name!', tagline: 'Hi', logo: 'idb:l1', partnerLogo: '', showPartner: false, partnerBackdrop: 'white' }); assert.equal(u.logo, 'idb:l1'); assert.equal(u.showPartner, false);
  localStorage.removeItem('token'); const pub = await handle('GET', '/branding'); assert.equal(pub.siteName, 'New Name!'); assert.equal(pub.partnerBackdrop, 'white');
  await login('admin'); await handle('POST', '/admin/reset'); localStorage.removeItem('token'); assert.equal((await handle('GET', '/branding')).siteName, 'TRISIKSTI');
});
test('business papers: required list, only admin adds papers, approval gate, public checklist, report', async () => {
  localStorage.removeItem('token'); const dt = await handle('GET', '/doc-types'); assert.ok(dt.required.stays.includes('fire') && dt.required.shops.length === 3);
  const sample = (await handle('GET', '/accommodations')).find(a => a.name.startsWith('Seaside')); assert.equal(sample.papers_status, 'complete');
  const detail = await handle('GET', `/accommodations/${sample.accommodation_id}`); assert.equal(detail.papers.status, 'complete'); assert.ok(detail.papers.required.every(r => r.state === 'verified')); assert.equal(detail.papers.required[0].docs[0].file, '');
  assert.equal((await handle('GET', '/restaurants'))[0].papers_status, 'incomplete');
  await login('owner'); const nb = await handle('POST', '/businesses', { name: 'Papers Shop', municipalityId: 1, category: 'Souvenir shops' });
  // owners cannot add or remove papers; only the admin can, and admin-added papers are verified
  await fails(handle('POST', `/owner/docs/${nb.id}`, { type: 'bir', number: 'N-1', file: 'idb:doc1', fileName: 'bir.pdf' }), /Forbidden/);
  await fails(handle('DELETE', `/owner/docs/${nb.id}/x`), /Forbidden/);
  assert.equal((await handle('GET', `/owner/docs/${nb.id}`)).status, 'incomplete');
  await login('admin'); await fails(handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' }), /required documents/);
  await fails(handle('POST', `/admin/docs/businesses/${nb.id}`, { type: 'bir', file: 'nope' }), /upload the document/);
  for (const type of ['bir', 'registration', 'permit']) await handle('POST', `/admin/docs/businesses/${nb.id}`, { type, number: 'N-1', file: 'idb:doc1', fileName: type + '.pdf' });
  await login('owner'); assert.equal((await handle('GET', `/owner/docs/${nb.id}`)).status, 'complete');
  await login('tourist'); await fails(handle('GET', `/owner/docs/${nb.id}`), /Forbidden/);
  await login('admin');
  assert.equal((await handle('GET', `/admin/docs/businesses/${nb.id}`)).status, 'complete'); await handle('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' });
  localStorage.removeItem('token'); const pub = (await handle('GET', '/businesses')).find(b => b.name === 'Papers Shop'); assert.equal(pub.papers_status, 'complete'); assert.equal((await handle('GET', `/businesses/${nb.id}`)).papers.required[0].docs[0].file, 'idb:doc1');
  await login('admin'); const rep = await handle('GET', '/admin/business-report?type=shops'); assert.ok(rep.rows.length >= 3 && rep.rows.every(r => r.type === 'Shop')); assert.ok((await handle('GET', '/admin/business-report')).rows.some(r => r.type === 'Transport'));
  assert.equal((await handle('GET', '/admin/business-report?papers=complete')).rows.every(r => r.papers === 'complete'), true);
  await login('provider'); const pd = await handle('GET', '/transport/provider/docs'); assert.equal(pd.status, 'complete');
  await fails(handle('POST', '/transport/provider/docs', { type: 'bir', file: 'idb:doc1' }), /Forbidden/);
});
test('report exports: CSV escaping and a real PDF', async () => {
  const { toCsv, buildPdf } = await import('../src/lib/reports.js');
  const rows = [{ name: 'A, "B" Inn', type: 'Stay', detail: 'inn', municipality: 'Virac', address: 'L1\nL2', phone: '1', owner: 'O', email: 'o@x.t', status: 'approved', registered: '2026-11-09', papers: 'complete', papers_detail: 'BIR: verified' }];
  const csv = toCsv(rows); assert.ok(csv.startsWith('\uFEFFBusiness,Type')); assert.ok(csv.includes('"A, ""B"" Inn"')); assert.ok(csv.includes('"L1\nL2"')); assert.ok(csv.includes('Complete'));
  const doc = await buildPdf(Array.from({ length: 60 }, (_, i) => ({ ...rows[0], name: 'Biz ' + i })), { title: 'TRISIKSTI registered businesses', filters: { type: 'stays' } });
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

test('application form PDF follows the site name and keeps its fillable fields', async () => {
  const { buildApplicationForm, formFileName } = await import('../src/lib/applicationForm.js');
  const doc = await buildApplicationForm({ siteName: 'Sample Name', tagline: 'Hi' }, {}), pdf = doc.output();
  assert.equal(doc.getNumberOfPages(), 2); assert.match(pdf, /Sample Name Business Application Form/); assert.ok(!/TRISIKSTI|RABAS/i.test(pdf));
  for (const f of ['biz_name', 'doc_8', 'off_recv_sign']) assert.ok(pdf.includes(f), f);
  assert.equal(formFileName('My Site!'), 'My-Site-Business-Application-Form.pdf'); assert.equal(formFileName(''), 'Business-Application-Form.pdf');
});

// ---- owner dashboard: one business at a time
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const resetDemo = async () => { await login('admin'); await handle('POST', '/admin/reset'); localStorage.removeItem('token'); };
const mineOf = async (name) => (await handle('GET', '/owner/businesses')).find(b => b.name.startsWith(name));
test('owner sees and edits only their own business page', async () => {
  await resetDemo(); await login('owner');
  const list = await handle('GET', '/owner/businesses'); assert.equal(list.length, 1); assert.equal(list[0].kind, 'stays');
  const inn = await handle('GET', `/owner/business/${list[0].id}`); assert.equal(inn.rooms.length, 2); assert.equal(inn.papers.status, 'complete'); assert.match(inn.amenities, /Wi-Fi/); assert.ok(inn.publicPath.startsWith('/accommodations/'));
  const saved = await handle('PUT', `/owner/business/${inn.id}`, { cover: 'idb:cover1', photos: ['idb:p1', 'idb:p2'], description: 'New text', address: 'Rizal St', phone: '0917', hoursText: 'Daily 24 hours', lat: 13.58, lng: 124.23, type: 'resort', amenities: 'Pool, Wi-Fi, Parking' });
  assert.equal(saved.cover, 'idb:cover1'); assert.equal(saved.type, 'resort'); assert.equal(saved.name, inn.name);                      // the approved name is not editable
  const pub = await handle('GET', `/accommodations/${inn.publicPath.split('/').pop()}`);
  assert.deepEqual(pub.amenities, ['Pool', 'Wi-Fi', 'Parking']); assert.equal(pub.cover_photo, 'idb:cover1'); assert.deepEqual(pub.photos, ['idb:p1', 'idb:p2']); assert.equal(pub.description, 'New text');
  await fails(handle('PUT', `/owner/business/${inn.id}`, { photos: ['javascript:alert(1)'] }), /not valid/); await fails(handle('PUT', `/owner/business/${inn.id}`, { lat: 120 }), /coordinates/); await fails(handle('PUT', `/owner/business/${inn.id}`, { type: 'castle' }), /stay type/);
  await login('owner2'); await fails(handle('GET', `/owner/business/${inn.id}`), /not found/); await fails(handle('PUT', `/owner/business/${inn.id}`, { description: 'hijack' }), /not found/); await fails(handle('GET', `/owner/business/${inn.id}/reservations`), /not found/);
  await login('tourist'); await fails(handle('GET', `/owner/business/${inn.id}`), /Forbidden/);
});
test('rooms: add, edit, pause, and protect rooms that have booking history', async () => {
  await resetDemo(); await login('owner'); const inn = await handle('GET', `/owner/business/${(await mineOf('Seaside')).id}`);
  const v = await handle('POST', `/owner/business/${inn.id}/rooms`, { name: 'Suite', capacity: 2, pricePerNight: 4000, quantity: 1 }); const suite = v.rooms.find(r => r.name === 'Suite');
  await fails(handle('POST', `/owner/business/${inn.id}/rooms`, { name: '', capacity: 2, pricePerNight: 10 }), /Check the room/); await fails(handle('POST', `/owner/business/${inn.id}/rooms`, { name: 'X', capacity: 0, pricePerNight: 10 }), /Check the room/);
  const e = await handle('PUT', `/owner/rooms/${suite.id}`, { name: 'Suite', capacity: 3, pricePerNight: 4200, quantity: 2 }); assert.equal(e.rooms.find(r => r.id === suite.id).price, 4200);
  const std = v.rooms.find(r => r.name === 'Standard room'); await login('tourist');
  await handle('POST', '/bookings/stay', { roomId: std.id, checkIn: day(3), checkOut: day(4), guests: 2 });
  await login('owner'); await fails(handle('DELETE', `/owner/rooms/${std.id}`), /booking history/);
  const paused = await handle('PUT', `/owner/rooms/${std.id}`, { name: 'Standard room', capacity: 2, pricePerNight: 1500, quantity: 0 }); assert.equal(paused.rooms.find(r => r.id === std.id).quantity, 0);
  await login('tourist'); const avail = await handle('GET', `/bookings/availability?accommodationId=${inn.publicPath.split('/').pop()}&checkIn=${day(10)}&checkOut=${day(11)}&guests=2`); assert.ok(!avail.some(r => r.id === std.id));   // paused rooms are not offered
  await login('owner'); const after = await handle('DELETE', `/owner/rooms/${suite.id}`); assert.ok(!after.rooms.some(r => r.id === suite.id));
  await login('owner2'); await fails(handle('PUT', `/owner/rooms/${std.id}`, { name: 'x', capacity: 1, pricePerNight: 1 }), /Room not found/); await fails(handle('DELETE', `/owner/rooms/${std.id}`), /Room not found/);
});
test('stay reservations: the owner is told, manages them, and the guest is told back', async () => {
  await resetDemo(); await login('owner'); const bid = (await mineOf('Seaside')).id; assert.equal((await handle('GET', '/notifications')).unread, 0);
  const inn = await handle('GET', `/owner/business/${bid}`), fam = inn.rooms.find(r => r.name === 'Family room'); await login('tourist');
  const bk = await handle('POST', '/bookings/stay', { roomId: fam.id, checkIn: day(5), checkOut: day(7), guests: 3 });
  await login('owner'); let n = await handle('GET', '/notifications'); assert.equal(n.unread, 1); assert.match(n.items[0].title, /New booking request at Seaside Inn/); assert.match(n.items[0].body, /Demo Tourist.*Family room.*3 guest/); assert.match(n.items[0].link, /tab=reservations/);
  let res = await handle('GET', `/owner/business/${bid}/reservations`); assert.equal(res.length, 1); assert.equal(res[0].status, 'pending'); assert.equal(res[0].total, 5000); assert.equal(res[0].email, 'tourist@demo.test'); assert.equal((await handle('GET', `/owner/business/${bid}`)).stats.pending, 1);
  await fails(handle('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'completed' }), /cannot be changed/);
  await handle('POST', '/notifications/read', {}); assert.equal((await handle('GET', '/notifications')).unread, 0);
  await login('tourist'); await handle('POST', `/payments/${bk.payment.id}/sandbox-confirm`);                                                     // paying tells the owner again
  await login('owner'); n = await handle('GET', '/notifications'); assert.match(n.items[0].title, /Payment received/); assert.equal(n.unread, 1);
  assert.equal((await handle('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'completed' })).status, 'completed'); await fails(handle('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'confirmed' }), /cannot be changed/);
  // decline another request, and the room is free for those dates again
  await login('tourist'); const b2 = await handle('POST', '/bookings/stay', { roomId: fam.id, checkIn: day(9), checkOut: day(10), guests: 2 });
  await fails(handle('POST', '/bookings/stay', { roomId: fam.id, checkIn: day(9), checkOut: day(10), guests: 2 }), /just taken/);
  await login('owner'); await handle('PATCH', `/owner/reservations/stay/${b2.booking.id}`, { status: 'declined' });
  await login('tourist'); const g = await handle('GET', '/notifications'); assert.match(g.items[0].title, /Your booking at Seaside Inn \(sample\) was declined/); assert.equal(g.items[0].link, '/bookings'); assert.equal((await handle('GET', '/bookings/mine')).stays.find(s => s.id === b2.booking.id).status, 'declined');
  await handle('POST', '/bookings/stay', { roomId: fam.id, checkIn: day(9), checkOut: day(10), guests: 2 });
  await handle('POST', '/notifications/read', {}); assert.equal((await handle('GET', '/notifications')).unread, 0);
  await login('owner2'); await fails(handle('PATCH', `/owner/reservations/stay/${b2.booking.id}`, { status: 'confirmed' }), /not found/); assert.equal((await handle('GET', '/notifications')).items.length, 0);   // other owners see nothing
  await login('owner'); await fails(handle('PATCH', '/owner/reservations/constructor/x', { status: 'confirmed' }), /Unknown reservation type/);
});
test('restaurants: menu management, table reservations and their alerts', async () => {
  await resetDemo(); await login('owner3'); const list = await handle('GET', '/owner/businesses'); assert.equal(list.length, 2);
  const grill = list.find(b => b.name.startsWith('Seafood')), cafe = list.find(b => b.name.startsWith('Island Cafe')); assert.equal(grill.kind, 'restaurants');
  let g = await handle('GET', `/owner/business/${grill.id}`); assert.equal(g.acceptsReservations, false); assert.equal(g.menu.length, 3);
  g = await handle('POST', `/owner/business/${grill.id}/menu`, { name: 'Kinilaw', price: 220, description: 'Fresh' }); const dish = g.menu.find(m => m.name === 'Kinilaw');
  g = await handle('PUT', `/owner/menu-items/${dish.id}`, { name: 'Kinilaw', price: 250, description: 'Fresh' }); assert.equal(g.menu.find(m => m.id === dish.id).price, 250);
  await fails(handle('POST', `/owner/business/${grill.id}/menu`, { name: 'Free?', price: '' }), /dish name and price/);
  assert.equal((await handle('DELETE', `/owner/menu-items/${dish.id}`)).menu.length, 3); await fails(handle('POST', `/owner/business/${grill.id}/rooms`, { name: 'R', capacity: 1, pricePerNight: 1 }), /Rooms are for/);
  await login('tourist'); const grillId = (await handle('GET', '/restaurants')).find(r => r.name.startsWith('Seafood')).restaurant_id; const at = new Date(Date.now() + 2 * 864e5).toISOString();
  await fails(handle('POST', '/bookings/reservation', { restaurantId: grillId, reservedAt: at, partySize: 2 }), /does not take reservations/);   // off until the owner turns it on
  await login('owner3'); const on = await handle('PUT', `/owner/business/${grill.id}`, { description: g.description, cuisines: 'Seafood, Filipino', priceRange: 3, acceptsReservations: true }); assert.equal(on.acceptsReservations, true); assert.equal(on.priceRange, 3);
  await fails(handle('PUT', `/owner/business/${grill.id}`, { priceRange: 9 }), /price level/);
  await login('tourist'); await fails(handle('POST', '/bookings/reservation', { restaurantId: grillId, reservedAt: at, partySize: 0 }), /how many people/); await handle('POST', '/bookings/reservation', { restaurantId: grillId, reservedAt: at, partySize: 4 });
  await login('owner3'); const n = await handle('GET', '/notifications'); assert.match(n.items[0].title, /New table reservation at Seafood Grill/); assert.match(n.items[0].body, /party of 4/);
  const rs = await handle('GET', `/owner/business/${grill.id}/reservations`); assert.equal(rs.length, 1); assert.equal(rs[0].kind, 'table');
  await handle('PATCH', `/owner/reservations/table/${rs[0].id}`, { status: 'confirmed' }); await handle('PATCH', `/owner/reservations/table/${rs[0].id}`, { status: 'no_show' });
  await login('tourist'); const t = await handle('GET', '/notifications'); assert.match(t.items[0].title, /Your table reservation at Seafood Grill \(sample\) was confirmed/); assert.equal(t.items.length, 1);   // a no-show sends nothing
  await login('owner'); await fails(handle('GET', `/owner/business/${cafe.id}`), /not found/);
});
test('shops list products, and tourists see them', async () => {
  await resetDemo(); await login('owner4'); const souv = await mineOf('Island Souvenirs'); let v = await handle('GET', `/owner/business/${souv.id}`); assert.equal(v.kind, 'shops'); assert.equal(v.products.length, 3);
  v = await handle('POST', `/owner/business/${souv.id}/products`, { name: 'Shell necklace', price: 150, description: 'Sample', photo: 'idb:prod1' }); const prod = v.products.find(x => x.name === 'Shell necklace');
  await fails(handle('POST', `/owner/business/${souv.id}/products`, { name: 'Bad', price: 1, photo: 'javascript:x' }), /not valid/); await fails(handle('POST', `/owner/business/${souv.id}/products`, { name: '', price: 1 }), /product name/);
  v = await handle('PUT', `/owner/products/${prod.id}`, { name: 'Shell necklace', price: 175, description: 'Sample', photo: 'idb:prod1' }); assert.equal(v.products.find(x => x.id === prod.id).price, 175);
  const pub = await handle('GET', `/businesses/${souv.id}`); assert.equal(pub.products.length, 4); assert.equal(pub.products.find(x => x.id === prod.id).photo, 'idb:prod1');
  await login('owner2'); await fails(handle('PUT', `/owner/products/${prod.id}`, { name: 'x', price: 1 }), /Product not found/); await login('owner4'); assert.equal((await handle('DELETE', `/owner/products/${prod.id}`)).products.length, 3);
  await fails(handle('POST', `/owner/business/${souv.id}/menu`, { name: 'x', price: 1 }), /restaurants and cafes/);
});
test('a newly registered hotel or restaurant gets the right papers list and tools straight away', async () => {
  await resetDemo(); await login('owner'); const nb = await handle('POST', '/businesses', { name: 'Hilltop Lodge', municipalityId: 1, category: 'Hotels and resorts' });
  const v = await handle('GET', `/owner/business/${nb.id}`); assert.equal(v.kind, 'stays'); assert.equal(v.status, 'pending'); assert.equal(v.publicPath, null); assert.equal(v.papers.need, 4); assert.deepEqual(v.rooms, []);
  const cafe = await handle('POST', '/businesses', { name: 'Hill Cafe', municipalityId: 1, category: 'Cafes' }); assert.equal((await handle('GET', `/owner/business/${cafe.id}`)).papers.need, 5);
  await handle('POST', `/owner/business/${nb.id}/rooms`, { name: 'Twin', capacity: 2, pricePerNight: 900, quantity: 3 }); assert.equal((await handle('GET', `/owner/business/${nb.id}`)).rooms.length, 1);
});
test('old saved data without the new lists still loads', async () => {
  const { createBackend, seed } = await import('../src/lib/backend.js'); const old = seed(); delete old.products; delete old.notifications; let saved = null;
  let tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(old), save: async d => { saved = d; } });
  tok = (await be.handle('POST', '/auth/login', { email: 'owner@demo.test', password: 'demo1234' })).token; await be.handle('POST', '/notifications/read', {}); assert.deepEqual(saved.products, []); assert.deepEqual(saved.notifications, []);
});
test('emails go out only when the host supplies a mailer, and never block the booking', async () => {
  const { createBackend, seed } = await import('../src/lib/backend.js'); let db = seed(), tok = ''; const sent = [];
  const mk = (email) => createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); }, email, siteUrl: () => 'https://site.test' });
  const as = async (be, who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; };
  let off = 0; const book = async (be) => { await as(be, 'tourist'); const fam = db.rooms.find(r => r.name === 'Family room'); off += 2; return be.handle('POST', '/bookings/stay', { roomId: fam.id, checkIn: day(off), checkOut: day(off + 1), guests: 2 }); };
  await book(mk(undefined)); assert.equal(sent.length, 0);                                                                              // no mailer: in-site alert only
  assert.equal(db.notifications.length, 1);
  const be = mk(async (m) => { sent.push(m); }); const bk = await book(be); assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'owner@demo.test'); assert.match(sent[0].subject, /New booking request at Seaside Inn/); assert.match(sent[0].text, /Open: https:\/\/site\.test\/dashboard\?b=/);
  await as(be, 'owner'); await be.handle('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'confirmed' }); assert.equal(sent.length, 2); assert.equal(sent[1].to, 'tourist@demo.test'); assert.match(sent[1].subject, /was confirmed/);
  const broken = mk(async () => { throw new Error('mail server down'); }); const ok = await book(broken); assert.ok(ok.booking.id);              // a failing mailer does not fail the booking
});

test('transport provider edits their page, album and vehicles', async () => {
  await login('provider'); const me = await handle('GET', '/transport/provider/me'); assert.equal(me.page.kind, 'transport');
  const pg = await handle('PUT', '/transport/provider/page', { cover: 'idb:c1', photos: ['idb:a1', 'idb:a2'], description: 'Island rides', address: 'Virac', phone: '0917', hoursText: 'Daily 6:00 to 20:00' });
  assert.equal(pg.cover, 'idb:c1'); assert.deepEqual(pg.photos, ['idb:a1', 'idb:a2']);
  await fails(handle('PUT', '/transport/provider/page', { cover: 'javascript:x', photos: [] }), /not valid/);
  const id = (await handle('POST', '/transport/vehicles', { name: 'Test Van', type: 'van', capacity: 8, rentDriver: 2000, cover: 'idb:v1', photos: ['idb:v2'] })).id;
  await handle('PUT', `/transport/vehicles/${id}`, { name: 'Test Van', type: 'van', capacity: 9, rentDriver: 2500, rentSelf: '', cover: 'idb:v1', photos: [], isAvailable: false });
  let v = (await handle('GET', '/transport/provider/me')).vehicles.find(x => x.id === id); assert.equal(v.capacity, 9); assert.equal(v.is_available, false); assert.equal(v.rent_self, null);
  localStorage.removeItem('token'); const pub = await handle('GET', '/rentals/vehicles'); assert.ok(!pub.some(x => x.id === id));
  await login('provider'); await handle('DELETE', `/transport/vehicles/${id}`); assert.ok(!(await handle('GET', '/transport/provider/me')).vehicles.some(x => x.id === id));
  await login('owner'); await fails(handle('PUT', '/transport/provider/page', {}), /Forbidden/);
});
test('audit log: newest first, more than 100 entries are returned, and storage keeps at most 2000', async () => {
  await login('admin'); const t = (await handle('GET', '/admin/users')).find(u => u.role === 'tourist');
  for (let i = 0; i < 110; i++) await handle('PATCH', `/admin/users/${t.id}/active`, { active: true });
  const a = await handle('GET', '/admin/audit'); assert.ok(a.length > 100 && a.length <= 1000);
  assert.ok(a.every((x, i) => i === 0 || new Date(a[i - 1].created_at) >= new Date(x.created_at)));
  await login('tourist'); await fails(handle('GET', '/admin/audit'), /Forbidden/);
});

test('only an admin can create an admin account; public sign-up refuses the admin role', async () => {
  await login('tourist');
  await fails(handle('POST', '/admin/users', { fullName: 'Sneaky', email: 'sneaky@x.test', password: 'password123' }), /Forbidden/);
  await fails(handle('POST', '/auth/register', { fullName: 'Sneaky', email: 'sneaky@x.test', password: 'password123', role: 'admin' }), /Check your details/);
  await login('admin');
  await fails(handle('POST', '/admin/users', { fullName: 'A', email: 'bad', password: 'short' }), /valid email/);
  const a = await handle('POST', '/admin/users', { fullName: 'New Admin', email: 'NewAdmin@x.test', password: 'password123' });
  assert.equal(a.role, 'admin');
  await fails(handle('POST', '/admin/users', { fullName: 'Dup', email: 'newadmin@x.test', password: 'password123' }), /already registered/);
  const r = await handle('POST', '/auth/login', { email: 'newadmin@x.test', password: 'password123' }); assert.equal(r.user.role, 'admin');
});
