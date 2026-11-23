import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seed } from '../src/lib/backend.js';

const fails = (p, re) => assert.rejects(p, re);
const CARD = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
const ID = { idPhoto: 'idb:test-id-photo-0001', idConsent: true };
// Roam requests the way the site sends them: ask for today's terms, then confirm exactly those terms with a card and a photo of an ID.
const rideReq = async (h, body, path = '/transport/book') => { const q = await h('GET', `/transport/ride-quote?${body.routeId ? 'routeId=' + body.routeId : `vehicleId=${body.vehicleId}&from=${encodeURIComponent(body.from)}&to=${encodeURIComponent(body.to)}`}&pickupAt=${encodeURIComponent(body.pickupAt)}`); return h('POST', path, { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { fare: q.fare } }); };
const rentReq = async (h, body) => { const q = await h('GET', `/rentals/quote?vehicleId=${body.vehicleId}&mode=${body.mode}&start=${body.start}&end=${body.end}`); return h('POST', '/rentals/book', { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow } }); };
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mkBackend = () => {
  let db = seed(), tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); } });
  return { h: be.handle, get db() { return db; }, as: async (who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; } };
};
const stay = async (t) => { const room = t.db.rooms.find(r => r.name === 'Standard room'), q = await t.h('GET', `/bookings/quote?roomId=${room.id}&checkIn=${addDays(10)}&checkOut=${addDays(11)}`);
  return t.h('POST', '/bookings/stay', { roomId: room.id, checkIn: addDays(10), checkOut: addDays(11), guests: 2, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow } }); };

test('a guest can start the conversation, the owner is alerted and can answer, and unread counts follow', async () => {
  const t = mkBackend(); await t.as('tourist'); const bk = await stay(t), id = bk.booking.id;
  await fails(t.h('POST', `/messages/stay/${id}`, { body: '   ' }), /Write a message/); await fails(t.h('POST', `/messages/stay/${id}`, { body: 'x'.repeat(1001) }), /1,000/);
  await t.h('POST', `/messages/stay/${id}`, { body: 'Hi! Can we check in around 9 PM?' });
  await t.as('owner'); let n = (await t.h('GET', '/notifications')).items[0]; assert.match(n.title, /Demo Tourist sent a message about their booking/); assert.match(n.body, /9 PM/); assert.match(n.link, /tab=reservations/);
  const bid = t.db.businesses.find(b => b.name.startsWith('Seaside')).id; let row = (await t.h('GET', `/owner/business/${bid}/reservations`))[0]; assert.equal(row.unread_messages, 1);
  let th = await t.h('GET', `/messages/stay/${id}`); assert.equal(th.with, 'Demo Tourist'); assert.deepEqual(th.messages.map(m => m.mine), [false]);
  await t.h('POST', `/messages/stay/${id}/read`); assert.equal((await t.h('GET', `/owner/business/${bid}/reservations`))[0].unread_messages, 0);
  await t.h('POST', `/messages/stay/${id}`, { body: 'Yes, the front desk is open until midnight.' });
  await t.as('tourist'); assert.equal((await t.h('GET', '/bookings/mine')).stays[0].unread_messages, 1); n = (await t.h('GET', '/notifications')).items[0]; assert.match(n.title, /Seaside Inn.* sent you a message about your booking/); assert.equal(n.link, '/bookings');
  th = await t.h('GET', `/messages/stay/${id}`); assert.equal(th.with, 'Seaside Inn (sample)'); assert.deepEqual(th.messages.map(m => m.mine), [true, false]);
  await t.h('POST', `/messages/stay/${id}/read`); assert.equal((await t.h('GET', '/bookings/mine')).stays[0].unread_messages, 0);
});
test('the owner can start the conversation too', async () => {
  const t = mkBackend(); await t.as('tourist'); const id = (await stay(t)).booking.id;
  await t.as('owner'); await t.h('POST', `/messages/stay/${id}`, { body: 'Do you need an extra bed?' });
  await t.as('tourist'); assert.equal((await t.h('GET', '/bookings/mine')).stays[0].unread_messages, 1);
});
test('only the guest and that business can see or write in a conversation', async () => {
  const t = mkBackend(); await t.as('tourist'); const id = (await stay(t)).booking.id; await t.h('POST', `/messages/stay/${id}`, { body: 'Hello' });
  for (const who of ['owner2', 'provider', 'admin']) { await t.as(who); await fails(t.h('GET', `/messages/stay/${id}`), /not found/); await fails(t.h('POST', `/messages/stay/${id}`, { body: 'hi' }), /not found/); await fails(t.h('POST', `/messages/stay/${id}/read`), /not found/); }
  await t.as('tourist'); await fails(t.h('GET', '/messages/stay/nope'), /not found/); await fails(t.h('GET', '/messages/bogus/' + id), /not found/);
});
test('five messages in a row without a reply is the limit, and a reply resets it', async () => {
  const t = mkBackend(); await t.as('tourist'); const id = (await stay(t)).booking.id;
  for (let i = 0; i < 5; i++) await t.h('POST', `/messages/stay/${id}`, { body: 'ping ' + i });
  await fails(t.h('POST', `/messages/stay/${id}`, { body: 'ping 6' }), /wait for a reply/);
  await t.as('owner'); await t.h('POST', `/messages/stay/${id}`, { body: 'Sorry, one moment.' }); await t.as('tourist'); await t.h('POST', `/messages/stay/${id}`, { body: 'Thanks' });
});
test('messages work for table reservations, rides and rentals', async () => {
  const t = mkBackend(); await t.as('tourist');
  const route = (await t.h('GET', '/transport/routes'))[0], ride = await rideReq(t.h, { routeId: route.id, pickupAt: new Date(Date.now() + 3 * 864e5).toISOString(), passengers: 2, luggage: 1 });
  const v = (await t.h('GET', '/rentals/vehicles'))[0], rent = await rentReq(t.h, { vehicleId: v.id, mode: v.rent_driver != null ? 'driver' : 'self', licenseOk: true, start: addDays(5), end: addDays(5), destinations: [(await t.h('GET', '/destinations'))[0].id], pickup: 'Virac', passengers: 1 });
  await t.h('POST', `/messages/ride/${ride.booking.id}`, { body: 'Can you pick me up at the airport?' }); await t.h('POST', `/messages/rental/${rent.rental.id}`, { body: 'Is fuel included?' });
  const pv = t.db.providers.find(p => p.id === route.provider_id), email = t.db.users.find(u => u.id === pv.owner_id).email.replace('@demo.test', ''); await t.as(email);
  const rides = await t.h('GET', '/transport/provider/bookings'), rentals = await t.h('GET', '/transport/provider/rentals'); assert.equal(rides[0].unread_messages, 1); assert.equal(rentals[0].unread_messages, 1);
  await t.h('POST', `/messages/ride/${ride.booking.id}`, { body: 'Yes, see you there.' }); await t.as('tourist'); assert.equal((await t.h('GET', '/bookings/mine')).rides[0].unread_messages, 1);
  // a table reservation at a restaurant whose owner accepts reservations
  await t.as('owner'); const rest = t.db.restaurants[0], bz = t.db.businesses.find(b => b.id === rest.business_id); await t.h('PUT', `/owner/business/${bz.id}`, { acceptsReservations: true }).catch(() => {}); rest.accepts_reservations = true;
  await t.as('tourist'); await t.h('POST', '/bookings/reservation', { restaurantId: rest.id, reservedAt: new Date(Date.now() + 2 * 864e5).toISOString(), partySize: 2 });
  const tb = t.db.tables[0]; await t.h('POST', `/messages/table/${tb.id}`, { body: 'Can we get a window seat?' });
  await t.db.users.find(u => u.id === bz.owner_id) && await t.as(t.db.users.find(u => u.id === bz.owner_id).email.replace('@demo.test', ''));
  assert.equal((await t.h('GET', `/owner/business/${bz.id}/reservations`)).find(r => r.kind === 'table').unread_messages, 1);
});
