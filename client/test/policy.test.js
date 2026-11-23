import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY, quote, arrivalAt, localDate, localText, cancelTerms, noShowFee, canMarkNoShow, terms } from '../src/lib/policy.js';
import { tokenize, checkCard } from '../src/lib/card.js';
import { createBackend, seed } from '../src/lib/backend.js';

const fails = (p, re) => assert.rejects(p, re);
const H = 36e5, CARD = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
const ID = { idPhoto: 'idb:test-id-photo-0001', idConsent: true };
// Roam requests the way the site sends them: ask for today's terms, then confirm exactly those terms with a card and a photo of an ID.
const rideReq = async (h, body, path = '/transport/book') => { const q = await h('GET', `/transport/ride-quote?${body.routeId ? 'routeId=' + body.routeId : `vehicleId=${body.vehicleId}&from=${encodeURIComponent(body.from)}&to=${encodeURIComponent(body.to)}`}&pickupAt=${encodeURIComponent(body.pickupAt)}`); return h('POST', path, { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { fare: q.fare } }); };
const rentReq = async (h, body) => { const q = await h('GET', `/rentals/quote?vehicleId=${body.vehicleId}&mode=${body.mode}&start=${body.start}&end=${body.end}`); return h('POST', '/rentals/book', { ...body, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow } }); };
const LAPSE = { token: 'sbx_lapse_0341', brand: 'Visa', last4: '0341', expMonth: 12, expYear: 2040 };
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
// the first check-in date, counting from today, that falls in the given tier right now
const dateFor = (tier) => { for (let n = 0; n < 12; n++) { const d = localDate(new Date(Date.now() + n * 864e5)); if (quote(1000, d).tier === tier) return d; } throw new Error('no date for ' + tier); };

// ---- the rules themselves
test('tiers follow the hours before check-in, with the exact boundaries', () => {
  const A = arrivalAt('2026-12-10'), t = (h, total = 4000) => quote(total, '2026-12-10', { at: new Date(A - h * H) });
  assert.equal(A.toISOString(), '2026-12-10T06:00:00.000Z'); // 2:00 PM hotel time, whatever the computer's own time zone is
  for (const [h, tier] of [[300, 'guarantee'], [72, 'guarantee'], [71.99, 'deposit'], [60, 'deposit'], [48, 'deposit'], [47.99, 'full'], [5, 'full'], [0, 'full'], [-6, 'full']]) assert.equal(t(h).tier, tier, `${h}h`);
  assert.deepEqual([t(100).dueNow, t(100).balance, t(100).refundable], [0, 4000, true]);
  assert.deepEqual([t(60).dueNow, t(60).balance, t(60).refundable, t(60).cancelUntil], [2000, 2000, false, null]);
  assert.deepEqual([t(10).dueNow, t(10).balance, t(10).refundable], [4000, 0, false]);
  assert.equal(t(60, 1999).dueNow, 999.5);
});
test('deadlines are in hotel local time: cancel until 72h before, reminder at 96h, none when booked later than that', () => {
  const A = arrivalAt('2026-12-10'), q = quote(4000, '2026-12-10', { at: new Date(A - 200 * H) });
  assert.equal(q.cancelUntil, new Date(A - 72 * H).toISOString()); assert.equal(localText(q.cancelUntil), 'Mon, Dec 7 · 2:00 PM'); assert.equal(q.reminderAt, new Date(A - 96 * H).toISOString());
  assert.equal(quote(4000, '2026-12-10', { at: new Date(A - 80 * H) }).reminderAt, null);
  assert.equal(quote(4000, '2026-12-10', { at: new Date(A - 80 * H), time: '12:00' }).cancelUntil, '2026-12-07T04:00:00.000Z'); // a hotel with a noon check-in
  assert.equal(localDate(new Date('2026-11-21T16:30:00Z')), '2026-11-22'); assert.equal(localDate(new Date('2026-11-21T15:30:00Z')), '2026-11-21'); // 00:30 in Catanduanes is already the next day
  assert.match(terms(q), /Free cancellation until Mon, Dec 7 · 2:00 PM \(hotel local time\)/);
});
test('what a cancellation or no-show costs', () => {
  const g = { status: 'confirmed', policy_tier: 'guarantee', total: 4000, charged: 0, free_cancel_until: '2026-12-07T06:00:00.000Z' };
  assert.deepEqual([cancelTerms(g, new Date('2026-12-07T05:59:00Z')).fee, cancelTerms(g, new Date('2026-12-07T06:01:00Z')).fee], [0, 2000]);
  assert.equal(noShowFee(g), 2000); assert.equal(cancelTerms({ ...g, status: 'pending' }, new Date('2026-12-09T00:00:00Z')).fee, 0); // the hotel had not accepted yet
  const d = { status: 'confirmed', policy_tier: 'deposit', total: 4000, charged: 2000 };
  assert.deepEqual([cancelTerms(d).refund, cancelTerms(d).fee, cancelTerms(d).forfeited, noShowFee(d)], [0, 0, 2000, 0]);
  assert.equal(cancelTerms({ ...d, status: 'pending' }).refund, 2000);
  assert.equal(canMarkNoShow('2026-12-10', new Date('2026-12-10T09:59:00Z')), false); assert.equal(canMarkNoShow('2026-12-10', new Date('2026-12-10T10:00:00Z')), true); // 6:00 PM hotel time
  assert.equal(POLICY.guaranteeHours, 72); assert.equal(POLICY.depositHours, 48); assert.equal(POLICY.reminderHours, 96);
});
test('card details are checked in the browser and only a token leaves it', () => {
  const ok = tokenize({ number: '4242 4242 4242 4242', exp: '12/40', cvc: '123' }); assert.deepEqual(ok.card, { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 });
  assert.ok(!JSON.stringify(ok).includes('4242424242424242')); assert.ok(!JSON.stringify(ok).includes('123'));
  assert.match(tokenize({ number: '4242 4242 4242 4241', exp: '12/40', cvc: '123' }).error, /card number/); assert.match(tokenize({ number: '4242424242424242', exp: '01/20', cvc: '123' }).error, /expired/);
  assert.match(tokenize({ number: '4242424242424242', exp: '13/40', cvc: '123' }).error, /01 to 12/); assert.match(tokenize({ number: '4242424242424242', exp: '12/40', cvc: '1' }).error, /security code/);
  assert.equal(tokenize({ number: '4000000000000002', exp: '12/40', cvc: '123' }).card.token, 'sbx_declined_0002');
  assert.throws(() => checkCard({ ...CARD, expMonth: 11, expYear: 2026 }, '2026-12-10'), /expires before/); assert.throws(() => checkCard(null, '2026-12-10'), /valid credit card/);
  assert.equal(checkCard(CARD, '2026-12-10').last4, '4242');
});

// ---- the rules inside the backend
const mkBackend = () => {
  let db = seed(), tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); } });
  return { h: be.handle, get db() { return db; }, as: async (who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; } };
};
const room = (t, name) => t.db.rooms.find(r => r.name === name).id;
const book = async (t, roomId, ci, co, extra = {}) => { const q = await t.h('GET', `/bookings/quote?roomId=${roomId}&checkIn=${ci}&checkOut=${co}`); return t.h('POST', '/bookings/stay', { roomId, checkIn: ci, checkOut: co, guests: 2, acceptPolicy: true, card: CARD, ...ID, expect: { tier: q.tier, dueNow: q.dueNow }, ...extra }); };
const stayOf = (t, id) => t.db.stays.find(s => s.id === id);
const mine = async (t, id) => (await t.h('GET', '/bookings/mine')).stays.find(s => s.id === id);
const titles = async (t) => (await t.h('GET', '/notifications')).items.map(n => n.title);

test('72h or more ahead: a valid card is required, nothing is charged, cancelling before the deadline is free', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = room(t, 'Standard room'), ci = addDays(dateFor('guarantee'), 2), co = addDays(ci, 2), paid0 = t.db.payments.length;
  await fails(book(t, r, ci, co, { card: undefined }), /valid credit card/); await fails(book(t, r, ci, co, { acceptPolicy: false }), /accept the booking policy/);
  await fails(book(t, r, ci, co, { expect: { tier: 'full', dueNow: 3000 } }), /terms changed/); await fails(book(t, r, ci, co, { expect: undefined }), /terms changed/);
  await fails(book(t, r, ci, co, { card: { ...CARD, token: 'sbx_declined_0002', last4: '0002' } }), /declined/); await fails(book(t, r, ci, co, { card: { ...CARD, expYear: 2020 } }), /expires before/);
  await fails(book(t, r, '2020-01-01', '2020-01-02'), /already passed|Choose valid/);
  assert.equal(t.db.stays.length, 0); assert.equal(t.db.payments.length, paid0); // every refusal left no booking and no charge
  const bk = await book(t, r, ci, co); assert.deepEqual([bk.booking.tier, bk.booking.charged, bk.payment], ['guarantee', 0, null]); assert.equal(t.db.payments.length, paid0);
  const m = await mine(t, bk.booking.id); assert.equal(m.card.last4, '4242'); assert.equal(m.guarantee, 'guaranteed'); assert.equal(m.terms.free, true); assert.ok(!JSON.stringify(m).includes('sbx_'));
  await t.as('owner'); const n = (await t.h('GET', '/notifications')).items[0]; assert.match(n.body, /card on file \(Visa ••4242\), free cancellation until/);
  await t.as('tourist'); const c = await t.h('POST', `/bookings/stay/${bk.booking.id}/cancel`); assert.deepEqual([c.refunded, c.charged], [0, 0]); assert.equal(stayOf(t, bk.booking.id).status, 'cancelled'); assert.equal(t.db.payments.length, paid0);
});
test('after the free-cancellation deadline, cancelling a confirmed card-guaranteed booking charges 50% to the card; a pending one is still free', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = room(t, 'Standard room'), ci = addDays(dateFor('guarantee'), 2), co = addDays(ci, 2);
  const a = await book(t, r, ci, co), b = await book(t, r, ci, co); // 2 x 1,500 x 2 nights = 3,000 each
  await t.as('owner'); await t.h('PATCH', `/owner/reservations/stay/${a.booking.id}`, { status: 'confirmed' });
  for (const s of t.db.stays) s.free_cancel_until = new Date(Date.now() - H).toISOString(); // the deadline has passed
  await t.as('tourist'); const withdrawn = await t.h('POST', `/bookings/stay/${b.booking.id}/cancel`); assert.deepEqual([withdrawn.refunded, withdrawn.charged], [0, 0]);
  const late = await t.h('POST', `/bookings/stay/${a.booking.id}/cancel`); assert.equal(late.charged, 1500); const pay = t.db.payments.find(p => p.id === stayOf(t, a.booking.id).fee_payment_id); assert.deepEqual([pay.amount, pay.status, pay.reason], [1500, 'paid', 'late cancellation']);
});
test('48 to 72 hours ahead: 50% is charged at booking and is non-refundable; the hotel declining refunds it in full', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = room(t, 'Family room'), ci = dateFor('deposit'), co = addDays(ci, 1);
  const bk = await book(t, r, ci, co); assert.deepEqual([bk.booking.tier, bk.booking.charged, bk.payment.amount, bk.payment.status], ['deposit', 1250, 1250, 'paid']);
  await t.as('owner'); await t.h('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'confirmed' });
  await t.as('tourist'); const m = await mine(t, bk.booking.id); assert.equal(m.terms.forfeited, 1250); assert.equal(m.terms.refund, 0);
  await t.as('owner'); await t.h('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'cancelled' }); // the hotel backs out
  assert.equal(t.db.payments.find(p => p.id === bk.payment.id).status, 'refunded'); await t.as('tourist'); assert.ok((await titles(t))[0].includes('cancelled by the business')); assert.match((await t.h('GET', '/notifications')).items[0].body, /₱1,250 has been refunded to you in full/);
  const again = await book(t, r, ci, co); await t.h('POST', `/bookings/stay/${again.booking.id}/cancel`); // withdrawn before the hotel replied: nothing was booked yet
  assert.equal(t.db.payments.find(p => p.id === again.payment.id).status, 'refunded');
  const third = await book(t, r, ci, co); await t.as('owner'); await t.h('PATCH', `/owner/reservations/stay/${third.booking.id}`, { status: 'confirmed' });
  await t.as('tourist'); const cx = await t.h('POST', `/bookings/stay/${third.booking.id}/cancel`); assert.deepEqual([cx.refunded, cx.charged, cx.forfeited], [0, 0, 1250]); assert.equal(t.db.payments.find(p => p.id === third.payment.id).status, 'paid'); // non-refundable once booked
});
test('sending the same booking request twice never books or charges twice', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = room(t, 'Standard room'), ci = dateFor('deposit'), co = addDays(ci, 1), paid0 = t.db.payments.length;
  const one = await book(t, r, ci, co, { requestId: 'abc-123' }), two = await book(t, r, ci, co, { requestId: 'abc-123' });
  assert.equal(two.booking.id, one.booking.id); assert.equal(two.replayed, true); assert.equal(t.db.stays.length, 1); assert.equal(t.db.payments.length, paid0 + 1); // one booking, one charge
  const other = await book(t, r, ci, co, { requestId: 'def-456' }); assert.notEqual(other.booking.id, one.booking.id); assert.equal(t.db.stays.length, 2); // a genuinely new request is still allowed
});
test('under 48 hours, same day included: 100% is charged at booking', async () => {
  const t = mkBackend(); await t.as('tourist'); const r = room(t, 'Family room'), ci = localDate(), co = addDays(ci, 1);
  const bk = await book(t, r, ci, co); assert.deepEqual([bk.booking.tier, bk.booking.charged, bk.payment.amount], ['full', 2500, 2500]);
  await t.as('owner'); await t.h('PATCH', `/owner/reservations/stay/${bk.booking.id}`, { status: 'declined' }); assert.equal(t.db.payments.find(p => p.id === bk.payment.id).status, 'refunded'); // declined requests are never kept
});
test('no-shows: the amount already paid is forfeited with nothing extra; a card-guaranteed booking is charged 50%; and only after the check-in day has had time to pass', async () => {
  const t = mkBackend(); await t.as('tourist'); const fam = room(t, 'Family room'), std = room(t, 'Standard room'), pastDay = addDays(localDate(), -1);
  const dep = await book(t, fam, dateFor('deposit'), addDays(dateFor('deposit'), 1)), grd = await book(t, std, addDays(dateFor('guarantee'), 2), addDays(dateFor('guarantee'), 4));
  await t.as('owner'); for (const b of [dep, grd]) await t.h('PATCH', `/owner/reservations/stay/${b.booking.id}`, { status: 'confirmed' });
  await fails(t.h('PATCH', `/owner/reservations/stay/${dep.booking.id}`, { status: 'no_show' }), /only after 18:00/); // a guest cannot be a no-show before the day has happened
  stayOf(t, dep.booking.id).check_in = pastDay; stayOf(t, dep.booking.id).check_out = localDate(); stayOf(t, grd.booking.id).check_in = pastDay; stayOf(t, grd.booking.id).check_out = localDate();
  const before = t.db.payments.length, r1 = await t.h('PATCH', `/owner/reservations/stay/${dep.booking.id}`, { status: 'no_show' }); assert.equal(r1.status, 'no_show'); assert.equal(r1.fee_charged, 0); assert.equal(t.db.payments.length, before); // deposit kept, nothing more
  const r2 = await t.h('PATCH', `/owner/reservations/stay/${grd.booking.id}`, { status: 'no_show' }); assert.equal(r2.fee_charged, 1500); assert.equal(t.db.payments.length, before + 1);
  await t.as('tourist'); const g = (await t.h('GET', '/notifications')).items; assert.ok(g.some(n => /marked as a no-show/.test(n.title) && /₱1,500 was charged to the card on file/.test(n.body)));
  await t.as('owner'); await fails(t.h('PATCH', `/owner/reservations/stay/${dep.booking.id}`, { status: 'confirmed' }), /cannot be changed/);
});
test('96-hour reminder, card re-check, and automatic release when the booking is not guaranteed by the deadline', async () => {
  const t = mkBackend(); await t.as('tourist'); const std = room(t, 'Standard room'), ci = addDays(dateFor('guarantee'), 3), co = addDays(ci, 1);
  const ok = await book(t, std, ci, co), lapse = await book(t, std, ci, co, { card: LAPSE }); assert.ok(stayOf(t, ok.booking.id).reminder_at); assert.equal(stayOf(t, ok.booking.id).reminder_sent, false);
  for (const s of t.db.stays) s.reminder_at = new Date(Date.now() - H).toISOString(); // 96 hours before check-in has arrived
  let ts = await titles(t); assert.equal(ts.filter(x => /Reminder: free cancellation/.test(x)).length, 1); assert.equal(ts.filter(x => /card could not be verified/.test(x)).length, 1);
  await titles(t); assert.equal((await titles(t)).filter(x => /Reminder/.test(x)).length, 1); // sent once only
  assert.equal(stayOf(t, ok.booking.id).guarantee, 'guaranteed'); assert.equal(stayOf(t, lapse.booking.id).guarantee, 'pending');
  await t.as('owner'); await fails(t.h('PATCH', `/owner/reservations/stay/${lapse.booking.id}`, { status: 'confirmed' }), /not guaranteed yet/); assert.equal((await t.h('PATCH', `/owner/reservations/stay/${ok.booking.id}`, { status: 'confirmed' })).status, 'confirmed');
  await t.as('tourist'); await t.h('POST', `/bookings/stay/${lapse.booking.id}/guarantee`, { card: CARD }); assert.equal(stayOf(t, lapse.booking.id).guarantee, 'guaranteed'); // fixed in time
  const again = await book(t, std, addDays(ci, 5), addDays(ci, 6), { card: LAPSE }); // other dates: the Standard room has two units and both are taken on ci
  stayOf(t, again.booking.id).reminder_at = new Date(Date.now() - H).toISOString(); await titles(t); assert.equal(stayOf(t, again.booking.id).guarantee, 'pending');
  stayOf(t, again.booking.id).free_cancel_until = new Date(Date.now() - 1000).toISOString(); // the deadline passes without a valid card
  await titles(t); const s = stayOf(t, again.booking.id); assert.deepEqual([s.status, s.guarantee, s.cancelled_by], ['cancelled', 'released', 'system']);
  assert.ok((await titles(t)).some(x => /was released/.test(x))); await t.as('owner'); assert.ok((await titles(t)).some(x => /Booking released/.test(x)));
});
test('a request the hotel never answers is declined and refunded once the guest was due to arrive', async () => {
  const t = mkBackend(); await t.as('tourist'); const bk = await book(t, room(t, 'Family room'), localDate(), addDays(localDate(), 1)); assert.equal(bk.payment.amount, 2500);
  const fresh = await mine(t, bk.booking.id); assert.equal(fresh.status, 'pending'); // a request made on the day itself is never expired at once, even after the 2 PM check-in time
  stayOf(t, bk.booking.id).check_in = addDays(localDate(), -2); stayOf(t, bk.booking.id).check_out = addDays(localDate(), -1); stayOf(t, bk.booking.id).created_at = new Date(Date.now() - 3 * 864e5).toISOString();
  const m = await mine(t, bk.booking.id); assert.equal(m.status, 'declined'); assert.equal(t.db.payments.find(p => p.id === bk.payment.id).status, 'refunded'); assert.match((await t.h('GET', '/notifications')).items[0].body, /refunded to you in full/);
});
test('ride and rental requests reach the provider, and the answer reaches the guest', async () => {
  const t = mkBackend(); await t.as('tourist'); const route = (await t.h('GET', '/transport/routes'))[0];
  const ride = await rideReq(t.h, { routeId: route.id, pickupAt: new Date(Date.now() + 3 * 864e5).toISOString(), passengers: 2, luggage: 1 });
  const v = (await t.h('GET', '/rentals/vehicles'))[0], d1 = addDays(localDate(), 5);
  const rent = await rentReq(t.h, { vehicleId: v.id, mode: v.rent_driver != null ? 'driver' : 'self', licenseOk: true, start: d1, end: d1, destinations: [(await t.h('GET', '/destinations'))[0].id], pickup: 'Virac', passengers: 1 });
  const owner = t.db.providers.find(p => p.id === route.provider_id).owner_id, email = t.db.users.find(u => u.id === owner).email.replace('@demo.test', '');
  await t.as(email); const got = await titles(t); assert.ok(got.some(x => /New ride request/.test(x))); assert.ok(got.some(x => /New rental request/.test(x)));
  await t.h('PATCH', `/transport/bookings/${ride.booking.id}`, { status: 'confirmed' }); await t.h('PATCH', `/transport/rentals/${rent.rental.id}`, { status: 'rejected' });
  await t.as('tourist'); const back = await titles(t); assert.ok(back.some(x => /Your ride request .* was accepted/.test(x))); assert.ok(back.some(x => /Your rental request .* was declined/.test(x)));
});
