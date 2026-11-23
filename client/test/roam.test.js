import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAM, rideQuote, rideCancelTerms, rideNoShowFee, canMarkRideNoShow, rentalQuote, localDate } from '../src/lib/policy.js';
import { HUBS, roadKm, straightKm, commuteFare, commuteRates, onIsland, idRefOk } from '../src/lib/roam.js';
import { createBackend, seed } from '../src/lib/backend.js';

const CARD = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
const ID = { idPhoto: 'idb:test-id-photo-0001', idConsent: true };
const H = 36e5, inHours = (h) => new Date(Date.now() + h * H).toISOString();
const fails = (p, re) => assert.rejects(p, re);
const mk = () => {
  let db = seed(), tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); } });
  const t = { h: be.handle, get db() { return db; }, as: async (who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; },
    asId: (uid) => t.as(db.users.find(u => u.id === uid).email.replace('@demo.test', '')) }; return t;
};
const q = encodeURIComponent;
const trike = (t) => t.db.vehicles.find(v => v.type === 'tricycle' && v.commute_base != null);
const commute = async (t, o = {}) => { const v = trike(t), body = { vehicleId: v.id, from: 'hub-airport', to: 'hub-virac-port', pickupAt: inHours(30), passengers: 2, ...o };
  const quote = await t.h('GET', `/transport/ride-quote?vehicleId=${body.vehicleId}&from=${q(body.from)}&to=${q(body.to)}&pickupAt=${q(body.pickupAt)}`);
  return t.h('POST', '/transport/commute', { acceptPolicy: true, card: CARD, ...ID, expect: { fare: quote.fare }, ...body }); };

test('distance and per-km fare: base covers the first km, then each km is charged, never below the base', () => {
  const rates = { base: 30, baseKm: 2, perKm: 12 };
  assert.deepEqual([commuteFare(rates, 0.5), commuteFare(rates, 2), commuteFare(rates, 3), commuteFare(rates, 10.5)], [30, 30, 42, 132]);
  const [a, p, s] = HUBS; assert.ok(roadKm(a, p) > 2 && roadKm(a, p) < 8); assert.ok(roadKm(a, s) > roadKm(a, p)); assert.equal(roadKm(a, a), 0.1);
  assert.ok(roadKm(a, s) > straightKm(a, s)); // roads are longer than the straight line
  assert.equal(commuteRates({ commute_base: null, commute_per_km: null }), null); assert.deepEqual(commuteRates({ commute_base: 30, commute_base_km: 2, commute_per_km: 12 }), rates);
  assert.ok(onIsland({ lat: 13.58, lng: 124.23 })); assert.ok(!onIsland({ lat: 14.6, lng: 121 })); assert.ok(!onIsland({ lat: NaN, lng: 124 }));
  assert.ok(idRefOk('idb:test-id-photo-0001')); assert.ok(idRefOk('/api/idphotos/abc-12345678')); assert.ok(!idRefOk('/api/photos/abc-12345678')); assert.ok(!idRefOk('javascript:x')); assert.ok(!idRefOk(''));
});
test('ride policy: free cancellation until 2h before pick-up, then half the fare; a pending request is always free', () => {
  const P = new Date('2026-12-10T02:00:00Z'), r = rideQuote(100, P.toISOString(), { at: new Date(P - 24 * H) });
  assert.deepEqual([r.fare, r.dueNow, r.lateFee, r.cancelUntil], [100, 0, 50, new Date(P - 2 * H).toISOString()]);
  const ride = { status: 'confirmed', fare: 100, free_cancel_until: r.cancelUntil };
  assert.deepEqual([rideCancelTerms(ride, new Date(P - 2.1 * H)).fee, rideCancelTerms(ride, new Date(P - 1.9 * H)).fee], [0, 50]);
  assert.equal(rideCancelTerms({ ...ride, status: 'pending' }, new Date(P)).fee, 0); assert.equal(rideNoShowFee(ride), 50);
  assert.equal(canMarkRideNoShow(P.toISOString(), new Date(P.getTime() + 14 * 6e4)), false); assert.equal(canMarkRideNoShow(P.toISOString(), new Date(P.getTime() + 15 * 6e4)), true);
  assert.equal(rentalQuote(1200, '2026-12-20', { at: new Date('2026-12-10T00:00:00Z') }).cancelUntil, '2026-12-17T00:00:00.000Z'); // 8:00 AM Philippine time, 72h earlier
  assert.equal(ROAM.rental.guaranteeHours, 72); assert.equal(ROAM.idRetentionDays, 30);
});

test('commute: options are priced by distance, and a longer trip costs more', async () => {
  const t = mk(); await t.as('tourist'); const places = await t.h('GET', '/transport/places'); assert.ok(places.some(p => p.id === 'hub-airport')); assert.ok(places.some(p => p.group === 'Hotels and stays')); assert.ok(places.some(p => p.group === 'Places to visit'));
  const near = await t.h('GET', `/transport/commute/options?from=hub-airport&to=hub-virac-port`), far = await t.h('GET', `/transport/commute/options?from=hub-airport&to=hub-san-andres-port`);
  assert.ok(near.options.length >= 1); assert.ok(far.km > near.km); assert.ok(far.options[0].fare > near.options[0].fare);
  assert.equal(near.options[0].fare, commuteFare(near.options[0].rates, near.km));
  const gps = await t.h('GET', `/transport/commute/options?from=${q('geo:13.58000,124.21000')}&to=hub-airport`); assert.equal(gps.from.label, 'My location'); assert.ok(gps.km < 3);
  const tooFar = await t.h('GET', `/transport/commute/options?from=${q('geo:13.95,124.4')}&to=hub-airport`); assert.equal(tooFar.too_far, true); assert.deepEqual(tooFar.options, []);
  await fails(t.h('GET', `/transport/commute/options?from=${q('geo:14.6,121.0')}&to=hub-airport`), /not on Catanduanes/);
  await fails(t.h('GET', `/transport/commute/options?from=hub-airport&to=hub-airport`), /two different places/); await fails(t.h('GET', `/transport/commute/options?from=&to=hub-airport`), /Choose where/);
});
test('commute booking: the server prices it, the fare is locked, and the request reaches the driver', async () => {
  const t = mk(); await t.as('tourist'); const v = trike(t);
  const r = await commute(t); const ride = t.db.rides.find(x => x.id === r.booking.id);
  assert.equal(ride.kind, 'commute'); assert.equal(ride.fare, commuteFare(commuteRates(v), roadKm(HUBS[0], HUBS[1]))); assert.equal(ride.fare, r.booking.fare); assert.equal(ride.policy_tier, 'ride'); assert.equal(ride.id_photo, ID.idPhoto);
  assert.ok(ride.km > 0); assert.equal(t.db.payments.length, 0); // nothing is charged: the fare is paid to the driver
  await fails(commute(t, { passengers: v.capacity + 1 }), /seats/); await fails(commute(t, { pickupAt: inHours(-1) }), /future/);
  const body = { vehicleId: v.id, from: 'hub-airport', to: 'hub-virac-port', pickupAt: inHours(30), passengers: 1, acceptPolicy: true, card: CARD, ...ID };
  await fails(t.h('POST', '/transport/commute', { ...body, expect: { fare: 1 } }), /fare changed/); await fails(t.h('POST', '/transport/commute', body), /fare changed/);
  await t.h('POST', '/transport/commute', { ...body, expect: { fare: ride.fare }, requestId: 'r1' }); const again = await t.h('POST', '/transport/commute', { ...body, expect: { fare: ride.fare }, requestId: 'r1' }); assert.equal(again.replayed, true); assert.equal(t.db.rides.length, 2);
  const mineRides = (await t.h('GET', '/bookings/mine')).rides; assert.equal(mineRides[0].kind, 'commute'); assert.ok(!('id_photo' in mineRides[0])); assert.equal(mineRides[0].card.last4, '4242'); assert.ok(!JSON.stringify(mineRides[0]).includes('sbx_'));
  const pv = t.db.providers.find(p => p.id === v.provider_id); await t.asId(pv.owner_id); const list = await t.h('GET', '/transport/provider/bookings'); assert.equal(list.length, 2); assert.equal(list[0].kind, 'commute'); assert.ok((await t.h('GET', '/notifications')).items.some(n => /New ride request/.test(n.title)));
});
test('a valid ID photo and consent are required on every stay, rental, ride and commute request', async () => {
  const t = mk(); await t.as('tourist'); const stayRoom = t.db.rooms[0], ci = localDate(new Date(Date.now() + 10 * 864e5)), co = localDate(new Date(Date.now() + 11 * 864e5)), v = t.db.vehicles.find(x => x.rent_driver != null), route = t.db.routes[0];
  const sq = await t.h('GET', `/bookings/quote?roomId=${stayRoom.id}&checkIn=${ci}&checkOut=${co}`), stayBody = { roomId: stayRoom.id, checkIn: ci, checkOut: co, guests: 1, acceptPolicy: true, card: CARD, expect: { tier: sq.tier, dueNow: sq.dueNow } };
  const rq = await t.h('GET', `/rentals/quote?vehicleId=${v.id}&mode=driver&start=${ci}&end=${ci}`), rentBody = { vehicleId: v.id, mode: 'driver', start: ci, end: ci, destinations: [t.db.destinations[0].id], passengers: 1, acceptPolicy: true, card: CARD, expect: { tier: rq.tier, dueNow: rq.dueNow } };
  const rideBody = { routeId: route.id, pickupAt: inHours(30), passengers: 1, acceptPolicy: true, card: CARD, expect: { fare: route.fare } };
  for (const [path, body] of [['/bookings/stay', stayBody], ['/rentals/book', rentBody], ['/transport/book', rideBody]]) {
    await fails(t.h('POST', path, body), /photo of a valid government-issued ID/); await fails(t.h('POST', path, { ...body, idPhoto: '/api/photos/abc12345678' }), /photo of a valid government-issued ID/); await fails(t.h('POST', path, { ...body, idPhoto: ID.idPhoto }), /agree to share your ID/);
    await t.h('POST', path, { ...body, ...ID }); // with the ID and consent it goes through
  }
  await fails(t.h('POST', '/transport/commute', { vehicleId: trike(t).id, from: 'hub-airport', to: 'hub-virac-port', pickupAt: inHours(30), passengers: 1, acceptPolicy: true, card: CARD, expect: { fare: 1 } }), /photo of a valid government-issued ID|fare changed/);
  // an upload that belongs to somebody else is refused when the store can tell
  let asked, db2 = seed(), tok2 = ''; const be2 = createBackend({ token: () => tok2, load: async () => structuredClone(db2), save: async d => { db2 = structuredClone(d); }, ownsIdPhoto: async (ref, uid) => { asked = [ref, uid]; return false; } }); tok2 = (await be2.handle('POST', '/auth/login', { email: 'tourist@demo.test', password: 'demo1234' })).token;
  await fails(be2.handle('POST', '/transport/book', { ...rideBody, idPhoto: '/api/idphotos/abcdef12345', idConsent: true, routeId: db2.routes[0].id }), /upload your ID photo again/); assert.equal(asked[0], '/api/idphotos/abcdef12345');
});
test('commute fares on a vehicle: tricycles only, all three boxes or none, sensible numbers', async () => {
  const t = mk(); const pv = t.db.providers.find(p => t.db.vehicles.some(v => v.provider_id === p.id)); await t.asId(pv.owner_id);
  const base = { name: 'T', type: 'tricycle', capacity: 3, commuteBase: 30, commuteBaseKm: 2, commutePerKm: 12 };
  await fails(t.h('POST', '/transport/vehicles', { ...base, type: 'van' }), /tricycles only/); await fails(t.h('POST', '/transport/vehicles', { ...base, commutePerKm: '' }), /all three/); await fails(t.h('POST', '/transport/vehicles', { ...base, commuteBase: 0 }), /Check the commute fare/); await fails(t.h('POST', '/transport/vehicles', { ...base, commutePerKm: 500 }), /Check the commute fare/);
  const id = (await t.h('POST', '/transport/vehicles', base)).id, mine = (await t.h('GET', '/transport/provider/me')).vehicles.find(v => v.id === id); assert.deepEqual([mine.commute_base, mine.commute_base_km, mine.commute_per_km], [30, 2, 12]);
  await t.h('PUT', `/transport/vehicles/${id}`, { ...base, commuteBase: '', commuteBaseKm: '', commutePerKm: '' }); assert.equal((await t.h('GET', '/transport/provider/me')).vehicles.find(v => v.id === id).commute_base, null);
  await t.as('tourist'); assert.ok(!(await t.h('GET', `/transport/commute/options?from=hub-airport&to=hub-virac-port`)).options.some(o => o.vehicle_id === id)); // no rates, no commute
});
test('ride cancellation and no-show: free early, half the fare late, provider can mark a no-show after the grace time', async () => {
  const t = mk(); await t.as('tourist'); const v = trike(t), pv = t.db.providers.find(p => p.id === v.provider_id);
  const early = await commute(t, { pickupAt: inHours(30) }); assert.deepEqual(await t.h('POST', `/rides/${early.booking.id}/cancel`), { charged: 0 }); assert.equal(t.db.rides[0].status, 'cancelled'); assert.equal(t.db.payments.length, 0);
  const soon = await commute(t, { pickupAt: inHours(1) }); await t.asId(pv.owner_id); await t.h('PATCH', `/transport/bookings/${soon.booking.id}`, { status: 'confirmed' });
  await t.as('tourist'); const mineNow = (await t.h('GET', '/bookings/mine')).rides.find(r => r.id === soon.booking.id); assert.equal(mineNow.terms.free, false); const cx = await t.h('POST', `/rides/${soon.booking.id}/cancel`); assert.equal(cx.charged, Math.round(t.db.rides.find(r => r.id === soon.booking.id).fare * 50) / 100);
  assert.equal(t.db.payments.length, 1); await fails(t.h('POST', `/rides/${soon.booking.id}/cancel`), /no longer be cancelled/);
  const pend = await commute(t, { pickupAt: inHours(1) }); assert.deepEqual(await t.h('POST', `/rides/${pend.booking.id}/cancel`), { charged: 0 }); // not accepted yet: free even this close
  const ns = await commute(t, { pickupAt: inHours(30) }); await t.asId(pv.owner_id); await t.h('PATCH', `/transport/bookings/${ns.booking.id}`, { status: 'confirmed' });
  await fails(t.h('PATCH', `/transport/bookings/${ns.booking.id}`, { status: 'no_show' }), /only 15 minutes after/); t.db.rides.find(r => r.id === ns.booking.id).pickup_at = inHours(-1); // time passes
  await t.h('PATCH', `/transport/bookings/${ns.booking.id}`, { status: 'no_show' }); assert.equal(t.db.rides.find(r => r.id === ns.booking.id).fee_charged, Math.round(t.db.rides.find(r => r.id === ns.booking.id).fare * 50) / 100);
  await fails(t.h('PATCH', `/transport/bookings/${ns.booking.id}`, { status: 'completed' }), /cannot be changed/);
});
test('an unanswered ride request is released on its own, with nothing charged', async () => {
  const t = mk(); await t.as('tourist'); const r = await commute(t, { pickupAt: inHours(30) }); Object.assign(t.db.rides.find(x => x.id === r.booking.id), { pickup_at: inHours(-1), created_at: inHours(-3) }); // time passes
  const got = (await t.h('GET', '/bookings/mine')).rides[0]; assert.equal(got.status, 'declined'); assert.equal(got.cancelled_by, 'system'); assert.equal(t.db.payments.length, 0);
});
test('rentals follow the stay tiers: card on file early, deposit, then full payment; refunds when the provider declines', async () => {
  const t = mk(); await t.as('tourist'); const v = t.db.vehicles.find(x => x.rent_driver != null && x.type === 'van'), dest = [t.db.destinations[0].id], day = (n) => localDate(new Date(Date.now() + n * 864e5));
  const rent = async (n, extra = {}) => { const body = { vehicleId: v.id, mode: 'driver', start: day(n), end: day(n), destinations: dest, passengers: 1, ...extra }, qq = await t.h('GET', `/rentals/quote?vehicleId=${v.id}&mode=driver&start=${body.start}&end=${body.end}`); return [qq, await t.h('POST', '/rentals/book', { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { tier: qq.tier, dueNow: qq.dueNow } })]; };
  const [q9, r9] = await rent(9); assert.equal(q9.tier, 'guarantee'); assert.equal(q9.pickup_time, '08:00'); assert.equal(r9.payment, null); assert.equal(t.db.rentals.find(x => x.id === r9.rental.id).guarantee, 'guaranteed');
  assert.equal((await t.h('POST', `/rentals/${r9.rental.id}/cancel`)).charged, 0); // free
  const [q0, r0] = await rent(0); assert.equal(q0.tier, 'full'); assert.equal(r0.payment.amount, v.rent_driver); assert.equal(r0.rental.charged, v.rent_driver);
  const pv = t.db.providers.find(p => p.id === v.provider_id); await t.asId(pv.owner_id); await t.h('PATCH', `/transport/rentals/${r0.rental.id}`, { status: 'rejected' });
  assert.equal(t.db.payments.find(p => p.id === r0.payment.id).status, 'refunded'); assert.equal(t.db.rentals.find(x => x.id === r0.rental.id).cancelled_by, 'provider');
  await t.as('tourist'); const [, r0b] = await rent(0); const c = await t.h('POST', `/rentals/${r0b.rental.id}/cancel`); assert.equal(c.refunded, v.rent_driver); // withdrawn before the provider replied: refunded
  const [, r1] = await rent(1); await t.asId(pv.owner_id); await t.h('PATCH', `/transport/rentals/${r1.rental.id}`, { status: 'confirmed' }); await t.as('tourist'); const c1 = await t.h('POST', `/rentals/${r1.rental.id}/cancel`); assert.equal(c1.forfeited, v.rent_driver); assert.equal(c1.refunded, 0); // non-refundable once accepted
  const card = (await t.h('GET', '/rentals/mine')).find(x => x.id === r1.rental.id); assert.equal(card.status, 'cancelled'); assert.equal(card.tier, 'full'); assert.ok(!JSON.stringify(card).includes('sbx_'));
});
test('a rental no-show charges half the rental to a card on file, but only after pick-up time', async () => {
  const t = mk(); await t.as('tourist'); const v = t.db.vehicles.find(x => x.rent_driver != null), day = localDate(new Date(Date.now() + 9 * 864e5)), pv = t.db.providers.find(p => p.id === v.provider_id);
  const qq = await t.h('GET', `/rentals/quote?vehicleId=${v.id}&mode=driver&start=${day}&end=${day}`), r = await t.h('POST', '/rentals/book', { vehicleId: v.id, mode: 'driver', start: day, end: day, destinations: [t.db.destinations[0].id], passengers: 1, acceptPolicy: true, card: CARD, ...ID, expect: { tier: qq.tier, dueNow: qq.dueNow } });
  await t.asId(pv.owner_id); await t.h('PATCH', `/transport/rentals/${r.rental.id}`, { status: 'confirmed' }); await fails(t.h('PATCH', `/transport/rentals/${r.rental.id}`, { status: 'no_show' }), /only after 10:00/);
  Object.assign(t.db.rentals.find(x => x.id === r.rental.id), { start_date: localDate(new Date(Date.now() - 864e5)), end_date: localDate(new Date(Date.now() - 864e5)) }); await t.h('PATCH', `/transport/rentals/${r.rental.id}`, { status: 'no_show' });
  assert.equal(t.db.rentals.find(x => x.id === r.rental.id).fee_charged, Math.round(v.rent_driver * 50) / 100);
});

test('ID photos: only the guest, the business or provider it went to, and the tourism office can open one, and it is deleted after the retention period', async () => {
  const t = mk(); await t.as('tourist'); const v = trike(t), pv = t.db.providers.find(p => p.id === v.provider_id), ref = '/api/idphotos/aaaa-bbbb-cccc-dddd';
  const r = await commute(t, { idPhoto: ref }); const view = (id) => t.h('POST', `/idphotos/${id}/view`);
  await view('aaaa-bbbb-cccc-dddd'); assert.ok(!t.db.audit.some(a => a.action === 'id.view')); // the guest opening their own is not logged
  await t.asId(pv.owner_id); await view('aaaa-bbbb-cccc-dddd'); assert.equal(t.db.audit.filter(a => a.action === 'id.view').length, 1);
  const other = t.db.providers.find(p => p.owner_id !== pv.owner_id); await t.asId(other.owner_id); await fails(view('aaaa-bbbb-cccc-dddd'), /Forbidden/);
  await t.as('admin'); await view('aaaa-bbbb-cccc-dddd'); await fails(view('nope-nope-nope-nope'), /Not found/);
  // signed out
  const be = createBackend({ token: () => '', load: async () => structuredClone(t.db), save: async () => {} }); await fails(be.handle('POST', '/idphotos/aaaa-bbbb-cccc-dddd/view'), /Sign in/);
  // 30 days after the trip the photo is gone, and the shared store is told to delete it
  const deleted = []; let db = structuredClone(t.db), tok = ''; const be2 = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); }, deletePhoto: async (x) => { deleted.push(x); } });
  db.rides.find(x => x.id === r.booking.id).pickup_at = new Date(Date.now() - 31 * 864e5).toISOString(); db.rides.find(x => x.id === r.booking.id).status = 'completed';
  tok = (await be2.handle('POST', '/auth/login', { email: 'tourist@demo.test', password: 'demo1234' })).token; await be2.handle('GET', '/bookings/mine');
  assert.equal(db.rides.find(x => x.id === r.booking.id).id_photo, null); assert.deepEqual(deleted, [ref]);
  db.rides.push({ ...db.rides[0], id: 'x1', id_photo: 'idb:keep-this-one-0001', pickup_at: new Date(Date.now() + 864e5).toISOString(), status: 'pending' }); await be2.handle('GET', '/bookings/mine'); assert.equal(db.rides.find(x => x.id === 'x1').id_photo, 'idb:keep-this-one-0001'); // a trip still ahead keeps its ID
});
