// Integration test against a real Postgres. Needs DATABASE_URL pointing at a database with database/schema.sql applied.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.JWT_SECRET ||= 'test-secret'; process.env.CLIENT_ORIGIN ||= 'http://localhost:5173'; process.env.PAYMENT_WEBHOOK_SECRET ||= 'whsec'; process.env.PAYMENT_MODE = 'sandbox';
const { default: app } = await import('../src/app.js');
const { pool, query } = await import('../src/db.js');
let server, base; const run = crypto.randomBytes(3).toString('hex'); const T = {};
const call = async (method, path, body, tok) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(tok && { Authorization: `Bearer ${tok}` }) }, body: body && JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const signup = async (role, n) => { const r = await call('POST', '/api/auth/register', { email: `${n}-${run}@t.test`, password: 'password123', fullName: `${n} Tester`, role }); assert.equal(r.status, 201); return r.body.token; };
const future = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

before(async () => {
  await new Promise(r => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}`;
  T.tourist = await signup('tourist', 'tourist'); T.tourist2 = await signup('tourist', 'tourist2'); T.owner = await signup('business_owner', 'owner'); T.prov = await signup('transport_provider', 'prov');
  await signup('tourist', 'adm'); await query(`UPDATE users SET role='admin' WHERE email=$1`, [`adm-${run}@t.test`]);
  T.admin = (await call('POST', '/api/auth/login', { email: `adm-${run}@t.test`, password: 'password123' })).body.token;
});
after(async () => { await new Promise(r => server.close(r)); await pool.end(); });

test('auth: rejects bad input, duplicate email, wrong password, and self-assigned admin', async () => {
  assert.equal((await call('POST', '/api/auth/register', { email: 'bad', password: 'x', fullName: 'a' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { email: `tourist-${run}@t.test`, password: 'password123', fullName: 'Dup Tester' })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { email: `x-${run}@t.test`, password: 'password123', fullName: 'Evil Admin', role: 'admin' })).status, 400);
  assert.equal((await call('POST', '/api/auth/login', { email: `tourist-${run}@t.test`, password: 'wrongwrong' })).status, 401);
});
test('roles: non-admins cannot reach admin endpoints; anonymous gets 401', async () => {
  assert.equal((await call('GET', '/api/admin/stats', null, T.tourist)).status, 403);
  assert.equal((await call('GET', '/api/admin/stats')).status, 401);
  assert.equal((await call('GET', '/api/admin/stats', null, T.admin)).status, 200);
});
test('QR check-in: awards tier points, blocks repeats, honors deactivation, resists parallel claims', async () => {
  const tier = (await call('GET', '/api/admin/point-tiers', null, T.admin)).body.find(t => t.name === 'Moderate');
  const muni = (await call('GET', '/api/municipalities')).body[0];
  const d = await call('POST', '/api/admin/destinations', { name: `Test Falls ${run}`, municipalityId: muni.id, lat: 13.6, lng: 124.3, pointTierId: tier.id, isPublished: true }, T.admin); assert.equal(d.status, 201); T.dest = d.body.id;
  const q = await call('POST', '/api/admin/qr', { listingType: 'destination', listingId: T.dest, cooldownHours: 24 }, T.admin); assert.equal(q.status, 201);
  T.qr = q.body.id; T.token = (await query('SELECT token FROM qr_codes WHERE id=$1', [T.qr])).rows[0].token;
  const [a, b] = await Promise.all([call('POST', '/api/checkin', { token: T.token }, T.tourist), call('POST', '/api/checkin', { token: T.token }, T.tourist)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 429]);
  assert.equal([a, b].find(x => x.status === 200).body.points, tier.points);
  assert.equal((await call('GET', '/api/checkin/me', null, T.tourist)).body.balance, tier.points);
  assert.equal((await call('POST', '/api/checkin', { token: 'nope' }, T.tourist)).status, 404);
  await call('PATCH', `/api/admin/qr/${T.qr}/deactivate`, null, T.admin);
  assert.equal((await call('POST', '/api/checkin', { token: T.token }, T.tourist2)).status, 410);
  assert.equal((await call('POST', '/api/checkin', { token: T.token })).status, 401);
});
test('rewards: no overspending, no double redemption, single-use claim codes, leaderboard', async () => {
  const pts = (await call('GET', '/api/checkin/me', null, T.tourist)).body.balance;
  const rw = (await call('POST', '/api/admin/rewards', { name: `Cap ${run}`, pointsCost: pts, stock: 5 }, T.admin)).body;
  const costly = (await call('POST', '/api/admin/rewards', { name: `Big ${run}`, pointsCost: pts + 1000 }, T.admin)).body;
  assert.equal((await call('POST', `/api/rewards/${costly.id}/redeem`, null, T.tourist)).status, 402);
  const [x, y] = await Promise.all([call('POST', `/api/rewards/${rw.id}/redeem`, null, T.tourist), call('POST', `/api/rewards/${rw.id}/redeem`, null, T.tourist)]);
  assert.deepEqual([x.status, y.status].sort(), [200, 402]); // second would overdraw
  const code = [x, y].find(r => r.status === 200).body.claimCode;
  assert.equal((await call('GET', '/api/checkin/me', null, T.tourist)).body.balance, 0);
  assert.equal((await call('POST', '/api/rewards/claim', { code }, T.tourist)).status, 403);
  assert.equal((await call('POST', '/api/rewards/claim', { code }, T.admin)).status, 200);
  assert.equal((await call('POST', '/api/rewards/claim', { code }, T.admin)).status, 409);
  assert.ok((await call('GET', '/api/rewards/leaderboard')).body.length >= 1);
});
test('stays: approval gate, availability, no double-booking, payment confirms, signed webhook only', async () => {
  const muni = (await call('GET', '/api/municipalities')).body[0];
  const biz = (await call('POST', '/api/businesses', { name: `Inn ${run}`, municipalityId: muni.id }, T.owner)).body;
  assert.equal(biz.status, 'pending');
  assert.equal((await call('POST', '/api/owner/accommodations', { businessId: biz.id, type: 'inn' }, T.owner)).status, 400); // not approved yet
  assert.equal((await call('PATCH', `/api/admin/businesses/${biz.id}/status`, { status: 'approved' }, T.admin)).status, 200);
  const acc = (await call('POST', '/api/owner/accommodations', { businessId: biz.id, type: 'inn' }, T.owner)).body;
  const room = (await call('POST', '/api/owner/rooms', { accommodationId: acc.id, name: 'Sea view', capacity: 2, pricePerNight: 1500, quantity: 1 }, T.owner)).body;
  const dates = { checkIn: future(10), checkOut: future(12) };
  const av = await call('GET', `/api/bookings/availability?accommodationId=${acc.id}&checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&guests=2`); assert.equal(av.body.length, 1);
  const [b1, b2] = await Promise.all([call('POST', '/api/bookings/stay', { roomId: room.id, ...dates, guests: 2 }, T.tourist), call('POST', '/api/bookings/stay', { roomId: room.id, ...dates, guests: 2 }, T.tourist2)]);
  assert.deepEqual([b1.status, b2.status].sort(), [201, 409]);
  const ok = [b1, b2].find(r => r.status === 201).body; assert.equal(Number(ok.booking.total), 3000); assert.equal(ok.booking.status, 'pending');
  assert.equal((await call('GET', `/api/bookings/availability?accommodationId=${acc.id}&checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&guests=2`)).body.length, 0);
  const body = JSON.stringify({ reference: ok.payment.provider_ref, status: 'paid' });
  assert.equal((await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': 'deadbeef'.repeat(8) }, body })).status, 401);
  const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(body).digest('hex');
  assert.equal((await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': sig }, body })).status, 200);
  await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': sig }, body }); // replay is harmless
  const mine = (await call('GET', '/api/bookings/mine', null, [b1, b2].find(r => r.status === 201) === b1 ? T.tourist : T.tourist2)).body.stays[0];
  assert.equal(mine.status, 'confirmed'); assert.equal(mine.payment_status, 'paid');
});
test('transport: provider approval gate, booking, accept', async () => {
  const p = (await call('POST', '/api/transport/provider', { name: `Vans ${run}` }, T.prov)).body;
  assert.equal((await call('POST', '/api/transport/vehicles', { type: 'van', capacity: 8 }, T.prov)).status, 403);
  await call('PATCH', `/api/admin/providers/${p.id}/status`, { status: 'approved' }, T.admin);
  const v = (await call('POST', '/api/transport/vehicles', { type: 'van', capacity: 8, driverName: 'Mang Juan' }, T.prov)).body;
  const rt = (await call('POST', '/api/transport/routes', { origin: 'Virac Airport', destination: 'Test Hotel', fare: 500 }, T.prov)).body;
  assert.ok((await call('GET', '/api/transport/routes?origin=Virac%20Airport')).body.some(r => r.id === rt.id));
  const when = new Date(Date.now() + 864e5).toISOString();
  assert.equal((await call('POST', '/api/transport/book', { routeId: rt.id, vehicleId: v.id, pickupAt: when, passengers: 20 }, T.tourist)).status, 400);
  const bk = await call('POST', '/api/transport/book', { routeId: rt.id, vehicleId: v.id, pickupAt: when, passengers: 4 }, T.tourist); assert.equal(bk.status, 201);
  assert.equal((await call('PATCH', `/api/transport/bookings/${bk.body.booking.id}`, { status: 'confirmed' }, T.tourist)).status, 403);
  assert.equal((await call('PATCH', `/api/transport/bookings/${bk.body.booking.id}`, { status: 'confirmed' }, T.prov)).status, 200);
});
test('itineraries: generate, edit, recalculate, duplicate, share, isolation', async () => {
  const g = await call('POST', '/api/itineraries/generate', { title: 'Trip', days: 2, pace: 'balanced', budget: 100 }, T.tourist); assert.equal(g.status, 201);
  assert.ok(g.body.items.length >= 1);
  const items = g.body.items.map(i => ({ day_no: i.day_no, listing_type: i.listing_type, listing_id: i.listing_id, title: i.listing_id ? null : i.name, est_cost: 999 }));
  const u = await call('PUT', `/api/itineraries/${g.body.id}`, { title: 'Trip edited', budget: 100, items: [...items, { day_no: 2, title: 'Rest', est_cost: 1 }] }, T.tourist);
  assert.equal(u.status, 200); assert.equal(u.body.totals.overBudget, true); assert.equal(u.body.title, 'Trip edited');
  assert.equal((await call('GET', `/api/itineraries/${g.body.id}`, null, T.tourist2)).status, 404);
  assert.equal((await call('PUT', `/api/itineraries/${g.body.id}`, { title: 'hack', items: [] }, T.tourist2)).status, 404);
  assert.equal((await call('POST', `/api/itineraries/${g.body.id}/duplicate`, null, T.tourist)).status, 201);
  const sh = (await call('POST', `/api/itineraries/${g.body.id}/share`, null, T.tourist)).body.token;
  const pub = await call('GET', `/api/itineraries/shared/${sh}`); assert.equal(pub.status, 200); assert.equal(pub.body.share_token, undefined);
});
test('listings and reviews', async () => {
  assert.equal((await call('GET', '/api/destinations')).body.some(d => d.id === T.dest), true);
  assert.equal((await call('POST', '/api/reviews', { type: 'destination', id: T.dest, rating: 4, comment: 'Great' }, T.tourist)).status, 201);
  await call('POST', '/api/reviews', { type: 'destination', id: T.dest, rating: 2 }, T.tourist);
  const rv = (await call('GET', `/api/reviews?type=destination&id=${T.dest}`)).body; assert.equal(rv.count, 1); assert.equal(rv.average, 2);
  assert.equal((await call('POST', '/api/reviews', { type: 'destination', id: T.dest, rating: 9 }, T.tourist)).status, 400);
});
