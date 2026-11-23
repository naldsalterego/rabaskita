import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seed } from '../src/lib/backend.js';
import { localDate } from '../src/lib/policy.js';

const fails = (p, re) => assert.rejects(p, re);
const CARD = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
const ID = { idPhoto: 'idb:test-id-photo-0001', idConsent: true };
// Roam requests the way the site sends them: ask for today's terms, then confirm exactly those terms with a card and a photo of an ID.
const rideReq = async (h, body, path = '/transport/book') => { const q = await h('GET', `/transport/ride-quote?${body.routeId ? 'routeId=' + body.routeId : `vehicleId=${body.vehicleId}&from=${encodeURIComponent(body.from)}&to=${encodeURIComponent(body.to)}`}&pickupAt=${encodeURIComponent(body.pickupAt)}`); return h('POST', path, { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { fare: q.fare } }); };
const rentReq = async (h, body) => { const q = await h('GET', `/rentals/quote?vehicleId=${body.vehicleId}&mode=${body.mode}&start=${body.start}&end=${body.end}`); return h('POST', '/rentals/book', { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow } }); };
const add = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const D = add(localDate(), 20); // far enough ahead that every booking is a plain card-guaranteed one
const mkBackend = () => {
  let db = seed(), tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); } });
  return { h: be.handle, get db() { return db; }, as: async (who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; } };
};
const book = async (t, roomId, ci, co) => { const q = await t.h('GET', `/bookings/quote?roomId=${roomId}&checkIn=${ci}&checkOut=${co}`); return t.h('POST', '/bookings/stay', { roomId, checkIn: ci, checkOut: co, guests: 2, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow } }); };
const std = (t) => t.db.rooms.find(r => r.name === 'Standard room'); // two units
const bid = (t) => t.db.businesses.find(b => b.name.startsWith('Seaside')).id;
const accId = (t) => t.db.accommodations.find(a => a.business_id === bid(t)).id;
const cal = async (t, from) => (await t.h('GET', `/accommodations/${accId(t)}/calendar?from=${from}&days=10`)).rooms.find(r => r.name === 'Standard room');

test('availability is worked out night by night, so stays that never share a night do not block each other', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = std(t).id;
  await book(t, r, D, add(D, 2)); await book(t, r, add(D, 2), add(D, 4)); // two units, but never both used on the same night
  await book(t, r, add(D, 1), add(D, 3));                                   // nights D+1 and D+2: one unit each night is still free
  await fails(book(t, r, add(D, 1), add(D, 3)), /just taken/);              // now D+1 and D+2 are full
  await book(t, r, D, add(D, 1));                                            // night D still has a free unit
  await fails(book(t, r, D, add(D, 1)), /just taken/);
  const days = (await cal(t, D)).days; assert.deepEqual([days[D], days[add(D, 1)], days[add(D, 2)], days[add(D, 3)], days[add(D, 4)]], [0, 0, 0, 1, 2]);
  await fails(book(t, r, add(D, 10), add(D, 80)), /Choose valid dates|up to 60 nights/);
});
test('tourists see free units per date without logging in or seeing anyone else\'s details', async () => {
  const t = mkBackend(); const c = await cal(t, D); assert.equal(c.quantity, 2); assert.equal(Object.keys(c.days).length, 10); assert.ok(Object.values(c.days).every(n => n === 2));
  assert.ok(!JSON.stringify(await t.h('GET', `/accommodations/${accId(t)}/calendar`)).includes('Demo Tourist')); await fails(t.h('GET', '/accommodations/nope/calendar'), /not found/);
});
test('an owner can close dates, tourists then see them as unavailable, and reopening restores them', async () => {
  const t = mkBackend(); await t.as('owner'); const r = std(t).id, b = bid(t);
  const x = await t.h('POST', `/owner/business/${b}/blocks`, { roomId: r, start: D, lastNight: add(D, 2), units: 1, reason: 'Walk-in guest' });
  assert.deepEqual(Object.values((await cal(t, D)).days).slice(0, 4), [1, 1, 1, 2]);
  await t.as('tourist'); await book(t, r, D, add(D, 3)); await fails(book(t, r, D, add(D, 1)), /just taken/); // the one open unit is taken, the closed one is not for sale
  assert.deepEqual(Object.values((await cal(t, D)).days).slice(0, 4), [0, 0, 0, 2]);
  await t.as('owner'); const av = await t.h('GET', `/owner/business/${b}/availability?from=${D}&days=5`), day = av.rooms.find(q => q.id === r).days[D];
  assert.deepEqual([day.booked, day.blocked, day.free], [1, 1, 0]); assert.equal(day.stays[0].guest, 'Demo Tourist'); assert.equal(day.stays[0].status, 'pending'); assert.equal(day.blocks[0].reason, 'Walk-in guest'); assert.equal(av.blocks.length, 1); assert.equal(av.blocks[0].last_night, add(D, 2));
  assert.deepEqual(av.tonight.find(q => q.id === r), { id: r, name: 'Standard room', quantity: 2, booked: 0, blocked: 0, free: 2 });
  await t.h('DELETE', `/owner/blocks/${x.id}`); assert.deepEqual(Object.values((await cal(t, D)).days).slice(0, 4), [1, 1, 1, 2]);
});
test('closing dates is checked: no past dates, no overbooking, only your own rooms', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = std(t).id, b = bid(t); await book(t, r, D, add(D, 2)); await book(t, r, D, add(D, 2));
  await fails(t.h('POST', `/owner/business/${b}/blocks`, { roomId: r, start: D, lastNight: D, units: 1 }), /Forbidden/);
  await t.as('owner'); const post = (body) => t.h('POST', `/owner/business/${b}/blocks`, { roomId: r, units: 1, ...body });
  await fails(post({ start: D, lastNight: D }), /Not enough free rooms on/); // both units already booked that night: decline those bookings first
  await fails(post({ start: add(localDate(), -3), lastNight: add(localDate(), 1) }), /from today onward/); await fails(post({ start: add(D, 5), lastNight: add(D, 4) }), /first night and the last night/);
  await fails(post({ start: add(D, 5), lastNight: add(D, 6), units: 3 }), /1 to 2 rooms/); await fails(post({ start: add(D, 5), lastNight: add(D, 6), roomId: 'nope' }), /Room not found/);
  const x = await post({ start: add(D, 5), lastNight: add(D, 6) });
  await t.as('owner2'); await fails(t.h('POST', `/owner/business/${b}/blocks`, { roomId: r, start: add(D, 8), lastNight: add(D, 8) }), /Business not found/); await fails(t.h('GET', `/owner/business/${b}/availability`), /Business not found/); await fails(t.h('DELETE', `/owner/blocks/${x.id}`), /not found/);
  await t.as('owner'); const bookingId = t.db.stays[0].id; await t.h('PATCH', `/owner/reservations/stay/${bookingId}`, { status: 'declined' }); await post({ start: D, lastNight: D }); // declining frees the night, so it can be closed now
});
