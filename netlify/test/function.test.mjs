import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler, makeMailer } from '../functions/handler.mjs';
// A stand-in for Netlify Blobs. It supports conditional writes (onlyIfMatch / onlyIfNew) like the real thing, and `slow` adds small random
// delays so that requests really do overlap, which is what exposes lost updates and double bookings.
const mem = (slow = false, flags = {}) => {
  const m = new Map(), tags = new Map(); let n = 0; const wait = () => (slow ? new Promise(r => setTimeout(r, Math.random() * 4)) : Promise.resolve());
  const put = (k, v) => { m.set(k, v); tags.set(k, 'v' + ++n); return tags.get(k); };
  return {
    get: async (k, o) => { await wait(); const v = m.get(k); if (v === undefined) return null; return o?.type === 'json' ? structuredClone(v) : v; },
    getWithMetadata: async (k, o) => { await wait(); const v = m.get(k); if (v === undefined) return null; return { data: o?.type === 'json' ? structuredClone(v) : v, etag: tags.get(k), metadata: {} }; },
    setJSON: async (k, v, o = {}) => { await wait(); if (flags.conflict && m.has(k)) return { modified: false }; if (o.onlyIfMatch !== undefined && tags.get(k) !== o.onlyIfMatch) return { modified: false }; if (o.onlyIfNew && m.has(k)) return { modified: false }; return { modified: true, etag: put(k, structuredClone(v)) }; },
    set: async (k, v) => { await wait(); return { modified: true, etag: put(k, v) }; },
    delete: async (k) => { m.delete(k); }, list: async ({ prefix }) => ({ blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }),
  };
};
const mk = (env = {}, { slow = false, mailer, flags } = {}) => { const store = mem(slow, flags); const h = makeHandler(() => store, env, mailer); return async (method, path, body, token, raw) => { const r = await h(new Request('https://x.test' + path, { method, headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && !raw && { 'Content-Type': 'application/json' }) }, body: raw ? body : body && JSON.stringify(body) })); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; }; };
const login = async (call, who, pw = 'demo1234') => (await call('POST', '/api/auth/login', { email: who + '@demo.test', password: pw })).body.token;

test('shared backend: data is visible to every device, photos persist, roles enforced', async () => {
  const call = mk(); assert.deepEqual((await call('GET', '/api/ping')).body, { shared: true, adminLocked: false });
  const admin = await login(call, 'admin'), tourist = await login(call, 'tourist');
  const png = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.equal((await call('POST', '/api/photos', png, null, true)).status, 401); assert.equal((await call('POST', '/api/photos', png, tourist, true)).status, 403);
  const up = await call('POST', '/api/photos', png, admin, true); assert.equal(up.status, 201 === up.status ? 201 : 200); assert.match(up.body.url, /^\/api\/photos\//);
  const members = [{ name: 'Engr. Test', role: 'Lead', photo: up.body.url }];
  assert.equal((await call('PUT', '/api/credits', { company: 'IslaTek', members }, tourist)).status, 403);
  assert.equal((await call('PUT', '/api/credits', { company: 'IslaTek', members }, admin)).status, 200);
  const other = await call('GET', '/api/credits'); assert.equal(other.body.members[0].photo, up.body.url);   // a different visitor, no token
  const img = await call('GET', up.body.url); assert.equal(img.status, 200); assert.deepEqual(img.body, png);
  const m = (await call('GET', '/api/municipalities')).body[0].id;
  await call('POST', '/api/admin/manage/destinations', { name: 'Shared Cove', municipalityId: m, isPublished: true }, admin);
  assert.ok((await call('GET', '/api/destinations')).body.some(d => d.name === 'Shared Cove'));
  assert.equal((await call('GET', '/api/admin/stats', null, tourist)).status, 403); assert.equal((await call('GET', '/api/admin/stats')).status, 401);
  await call('PUT', '/api/credits', { company: 'IslaTek', members: [{ name: 'Engr. Test' }] }, admin); assert.equal((await call('GET', up.body.url)).status, 404);   // removed photo is deleted
});
test('admin password can be locked with an environment variable, and reset works', async () => {
  const call = mk({ ADMIN_PASSWORD: 's3cret-pass' }); assert.equal((await call('GET', '/api/ping')).body.adminLocked, true);
  assert.equal((await call('POST', '/api/auth/login', { email: 'admin@demo.test', password: 'demo1234' })).status, 401);
  const admin = await login(call, 'admin', 's3cret-pass'); assert.ok(admin);
  const m = (await call('GET', '/api/municipalities')).body[0].id; await call('POST', '/api/admin/manage/rewards', { name: 'Temp Prize', pointsCost: 5 }, admin);
  assert.ok((await call('GET', '/api/rewards')).body.some(r => r.name === 'Temp Prize')); assert.equal((await call('POST', '/api/admin/reset', {}, admin)).status, 200);
  assert.ok(!(await call('GET', '/api/rewards')).body.some(r => r.name === 'Temp Prize'));
});

test('sync revision changes after a write so other devices refresh', async () => {
  const call = mk(); const admin = await login(call, 'admin'); const r0 = (await call('GET', '/api/sync')).body.rev; assert.ok(r0 > 0);   // login seeded the data
  assert.equal((await call('GET', '/api/sync')).body.rev, r0);                                                                     // reading changes nothing
  await call('PUT', '/api/credits', { company: 'IslaTek', members: [{ name: 'A' }] }, admin); const r1 = (await call('GET', '/api/sync')).body.rev; assert.ok(r1 > r0);
  await call('POST', '/api/admin/reset', {}, admin); assert.ok((await call('GET', '/api/sync')).body.rev > r1);                      // a reset is noticed too
});

test('logo uploads keep PNG transparency, and branding is shared with every visitor', async () => {
  const store = mem(), h = makeHandler(() => store, {}), call = mk();
  const send = async (method, path, opts = {}) => h(new Request('https://x.test' + path, { method, headers: opts.headers, body: opts.body }));
  const login2 = async () => (await (await send('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@demo.test', password: 'demo1234' }) })).json()).token;
  const admin = await login2(), png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const up = await (await send('POST', '/api/photos', { headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'image/png' }, body: png })).json(); assert.match(up.url, /\.png$/);
  const img = await send('GET', up.url); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  const put = await send('PUT', '/api/branding', { headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName: 'TRISIKSTI', logo: up.url, partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' }) }); assert.equal(put.status, 200);
  assert.equal((await (await send('GET', '/api/branding')).json()).logo, up.url);                         // any visitor, no sign-in
  await send('PUT', '/api/branding', { headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName: 'TRISIKSTI', logo: '', partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' }) });
  assert.equal((await send('GET', up.url)).status, 404);                                                  // the replaced logo file is removed
});

test('document uploads accept PDFs and serve them back as PDFs', async () => {
  const store = mem(), h = makeHandler(() => store, {}), send = (method, path, opts = {}) => h(new Request('https://x.test' + path, { method, headers: opts.headers, body: opts.body }));
  const token = (await (await send('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@demo.test', password: 'demo1234' }) })).json()).token;
  const pdf = Buffer.from('%PDF-1.4 test'); assert.equal((await send('POST', '/api/photos', { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' }, body: pdf })).status, 403);
  const adm = (await (await send('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@demo.test', password: 'demo1234' }) })).json()).token;
  const up = await (await send('POST', '/api/photos', { headers: { Authorization: 'Bearer ' + adm, 'Content-Type': 'application/pdf' }, body: pdf })).json(); assert.match(up.url, /\.pdf$/);
  const got = await send('GET', up.url); assert.equal(got.headers.get('content-type'), 'application/pdf'); assert.deepEqual(Buffer.from(await got.arrayBuffer()), pdf);
  const biz = (await (await send('GET', '/api/owner/businesses', { headers: { Authorization: 'Bearer ' + token } })).json())[0];
  const add = await send('POST', '/api/owner/docs/' + biz.id, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'bir', file: up.url, fileName: 'bir.pdf', number: 'X' }) }); assert.equal(add.status, 403);   // owners cannot add papers
  assert.equal((await (await send('GET', '/api/accommodations')).json())[0].papers_status !== undefined, true);
});

test('email alerts: off by default, sent through the mail service when configured, never to demo accounts', async () => {
  assert.equal(makeMailer({}), undefined); assert.equal(makeMailer({ RESEND_API_KEY: 'k' }), undefined);
  const real = globalThis.fetch, calls = []; globalThis.fetch = async (u, o) => { calls.push({ u, o }); return { ok: true, status: 200 }; };
  try {
    const mail = makeMailer({ RESEND_API_KEY: 'key123', NOTIFY_FROM: 'Alerts <alerts@site.test>' });
    await mail({ to: 'owner@demo.test', subject: 's', text: 't' }); assert.equal(calls.length, 0);
    await mail({ to: 'real@inn.test.ph', subject: 'New booking', text: 'Body' }); assert.equal(calls.length, 1); assert.equal(calls[0].u, 'https://api.resend.com/emails');
    assert.equal(calls[0].o.headers.Authorization, 'Bearer key123'); assert.deepEqual(JSON.parse(calls[0].o.body), { from: 'Alerts <alerts@site.test>', to: ['real@inn.test.ph'], subject: 'New booking', text: 'Body' });
  } finally { globalThis.fetch = real; }
});
test('owner dashboard works through the shared backend: alerts, reservations and the site link', async () => {
  const call = mk(); const owner = await login(call, 'owner'), tourist = await login(call, 'tourist');
  const bid = (await call('GET', '/api/owner/businesses', null, owner)).body[0].id; const inn = (await call('GET', '/api/owner/business/' + bid, null, owner)).body;
  const fam = inn.rooms.find(r => r.name === 'Family room'); const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const q = (await call('GET', `/api/bookings/quote?roomId=${fam.id}&checkIn=${d(6)}&checkOut=${d(7)}`)).body; const card = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
  assert.equal((await call('POST', '/api/bookings/stay', { roomId: fam.id, checkIn: d(6), checkOut: d(7), guests: 2 }, tourist)).status, 400); // no card, no policy acceptance: refused
  const bk = await call('POST', '/api/bookings/stay', { roomId: fam.id, checkIn: d(6), checkOut: d(7), guests: 2, acceptPolicy: true, card, expect: { tier: q.tier, dueNow: q.dueNow } }, tourist); assert.equal(bk.status, 200);
  assert.equal((await call('GET', '/api/notifications', null, owner)).body.unread, 1);
  assert.equal((await call('PATCH', '/api/owner/reservations/stay/' + bk.body.booking.id, { status: 'confirmed' }, owner)).status, 200);
  assert.equal((await call('GET', '/api/notifications', null, tourist)).body.items[0].link, '/bookings');
  assert.equal((await call('GET', '/api/owner/business/' + bid, null, tourist)).status, 403);
});


// ---- two people acting at the same moment
const CARD = { token: 'sbx_ok_4242', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2040 };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
async function setup(env, opts) {
  const call = mk(env, opts), owner = await login(call, 'owner'), guests = [];
  for (let i = 0; i < 8; i++) { const r = await call('POST', '/api/auth/register', { email: `guest${i}@example.com`, password: 'Passw0rd!x', fullName: `Guest ${i}`, role: 'tourist' }); assert.equal(r.status, 200, JSON.stringify(r.body)); guests.push(r.body.token); }
  const acc = (await call('GET', '/api/accommodations')).body.find(a => /Seaside/.test(a.name)), detail = (await call('GET', `/api/accommodations/${acc.accommodation_id}`)).body;
  return { call, owner, guests, room: detail.rooms.find(r => r.name === 'Family room'), std: detail.rooms.find(r => r.name === 'Standard room') }; // Family room: 1 unit, Standard room: 2 units
}
const bookBody = async (call, room, ci, co, extra = {}) => { const q = (await call('GET', `/api/bookings/quote?roomId=${room.id}&checkIn=${ci}&checkOut=${co}`)).body; return { roomId: room.id, checkIn: ci, checkOut: co, guests: 2, acceptPolicy: true, card: CARD, expect: { tier: q.tier, dueNow: q.dueNow }, ...extra }; };

test('two guests booking the last room at the same moment: exactly one gets it', async () => {
  for (let round = 0; round < 5; round++) {
    const { call, guests, room } = await setup({}, { slow: true }), ci = day(12 + round), co = day(13 + round), body = await bookBody(call, room, ci, co);
    const res = await Promise.all([call('POST', '/api/bookings/stay', body, guests[0]), call('POST', '/api/bookings/stay', body, guests[1])]);
    assert.deepEqual(res.map(r => r.status).sort(), [200, 400], `round ${round}: ${JSON.stringify(res.map(r => r.body))}`);
    assert.match(res.find(r => r.status === 400).body.error, /just taken/);
    const winner = res.findIndex(r => r.status === 200), mineW = (await call('GET', '/api/bookings/mine', null, guests[winner])).body.stays, mineL = (await call('GET', '/api/bookings/mine', null, guests[1 - winner])).body.stays;
    assert.equal(mineW.length, 1); assert.equal(mineL.length, 0); // the winner's booking really was saved, and the loser has nothing and was not charged
  }
});
test('eight guests racing for a room with two units: exactly two get one, and every booking is really saved', async () => {
  const { call, guests, std } = await setup({}, { slow: true }), ci = day(15), co = day(16), body = await bookBody(call, std, ci, co);
  const res = await Promise.all(guests.map(g => call('POST', '/api/bookings/stay', body, g)));
  assert.equal(res.filter(r => r.status === 200).length, 2, JSON.stringify(res.map(r => r.status))); assert.ok(res.filter(r => r.status !== 200).every(r => /just taken/.test(r.body.error)));
  const saved = (await Promise.all(guests.map(g => call('GET', '/api/bookings/mine', null, g)))).reduce((t, r) => t + r.body.stays.length, 0); assert.equal(saved, 2);
});
test('a request that has to be repeated never sends its email twice', async () => {
  const sent = [], { call, guests, std } = await setup({}, { slow: true, mailer: async (m) => { sent.push(m); } }); sent.length = 0;
  const body = await bookBody(call, std, day(18), day(19)), res = await Promise.all(guests.map(g => call('POST', '/api/bookings/stay', body, g)));
  const ok = res.filter(r => r.status === 200).length; assert.equal(ok, 2);
  assert.equal(sent.filter(m => m.to === 'owner@demo.test').length, ok); // one alert per booking that really happened, none for attempts that were repeated or refused
});
test('a repeated booking request over the shared backend returns the same booking', async () => {
  const { call, guests, std } = await setup({}), body = await bookBody(call, std, day(25), day(26), { requestId: 'req-1' });
  const [a, b] = [await call('POST', '/api/bookings/stay', body, guests[0]), await call('POST', '/api/bookings/stay', body, guests[0])];
  assert.equal(a.status, 200); assert.equal(b.body.booking.id, a.body.booking.id); assert.equal((await call('GET', '/api/bookings/mine', null, guests[0])).body.stays.length, 1);
});
test('nothing is lost when many people write at once: every message from both sides is kept', async () => {
  const { call, owner, guests, room } = await setup({}, { slow: true }), ci = day(20), co = day(21), id = (await call('POST', '/api/bookings/stay', await bookBody(call, room, ci, co), guests[0])).body.booking.id;
  await Promise.all([...Array.from({ length: 4 }, (_, i) => call('POST', `/api/messages/stay/${id}`, { body: `guest ${i}` }, guests[0])), ...Array.from({ length: 4 }, (_, i) => call('POST', `/api/messages/stay/${id}`, { body: `owner ${i}` }, owner)),
    ...guests.slice(1, 5).map((g, i) => call('POST', '/api/auth/register', { email: `late${i}@example.com`, password: 'Passw0rd!x', fullName: 'Late', role: 'tourist' }))]);
  const th = (await call('GET', `/api/messages/stay/${id}`, null, guests[0])).body.messages.map(m => m.body).sort();
  assert.deepEqual(th, [...Array.from({ length: 4 }, (_, i) => `guest ${i}`), ...Array.from({ length: 4 }, (_, i) => `owner ${i}`)].sort());
  for (let i = 0; i < 4; i++) assert.equal((await call('POST', '/api/auth/login', { email: `late${i}@example.com`, password: 'Passw0rd!x' })).status, 200); // and none of the sign-ups were overwritten
});

test('if the data is too busy to save, the guest gets a clear "try again" and nothing half-happens', async () => {
  const flags = { conflict: false }, call = mk({}, { flags }); await login(call, 'admin'); flags.conflict = true; // every save now loses to somebody else
  const r = await call('POST', '/api/auth/register', { email: 'busy@example.com', password: 'Passw0rd!x', fullName: 'Busy Guest', role: 'tourist' });
  assert.equal(r.status, 503); assert.match(r.body.error, /busy/); flags.conflict = false;
  assert.equal((await call('POST', '/api/auth/login', { email: 'busy@example.com', password: 'Passw0rd!x' })).status, 401); // the sign-up was not half-saved
  assert.equal((await call('POST', '/api/auth/register', { email: 'busy@example.com', password: 'Passw0rd!x', fullName: 'Busy Guest', role: 'tourist' })).status, 200); // and trying again works
});
