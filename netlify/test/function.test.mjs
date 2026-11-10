import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../functions/handler.mjs';
const mem = () => { const m = new Map(); return { get: async (k, o) => { const v = m.get(k); if (v === undefined) return null; return o?.type === 'json' ? structuredClone(v) : v; }, setJSON: async (k, v) => { m.set(k, structuredClone(v)); }, set: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, list: async ({ prefix }) => ({ blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }) }; };
const mk = (env = {}) => { const store = mem(); const h = makeHandler(() => store, env); return async (method, path, body, token, raw) => { const r = await h(new Request('https://x.test' + path, { method, headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && !raw && { 'Content-Type': 'application/json' }) }, body: raw ? body : body && JSON.stringify(body) })); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; }; };
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
  const put = await send('PUT', '/api/branding', { headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName: 'Rabas Kita!', logo: up.url, partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' }) }); assert.equal(put.status, 200);
  assert.equal((await (await send('GET', '/api/branding')).json()).logo, up.url);                         // any visitor, no sign-in
  await send('PUT', '/api/branding', { headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName: 'Rabas Kita!', logo: '', partnerLogo: '', showPartner: true, partnerBackdrop: 'navy' }) });
  assert.equal((await send('GET', up.url)).status, 404);                                                  // the replaced logo file is removed
});

test('document uploads accept PDFs and serve them back as PDFs', async () => {
  const store = mem(), h = makeHandler(() => store, {}), send = (method, path, opts = {}) => h(new Request('https://x.test' + path, { method, headers: opts.headers, body: opts.body }));
  const token = (await (await send('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@demo.test', password: 'demo1234' }) })).json()).token;
  const pdf = Buffer.from('%PDF-1.4 test'); const up = await (await send('POST', '/api/photos', { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' }, body: pdf })).json(); assert.match(up.url, /\.pdf$/);
  const got = await send('GET', up.url); assert.equal(got.headers.get('content-type'), 'application/pdf'); assert.deepEqual(Buffer.from(await got.arrayBuffer()), pdf);
  const biz = (await (await send('GET', '/api/owner/businesses', { headers: { Authorization: 'Bearer ' + token } })).json())[0];
  const add = await send('POST', '/api/owner/docs/' + biz.id, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'bir', file: up.url, fileName: 'bir.pdf', number: 'X' }) }); assert.equal(add.status, 200);
  assert.equal((await (await send('GET', '/api/accommodations')).json())[0].papers_status !== undefined, true);
});
