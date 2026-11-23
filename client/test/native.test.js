import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seed } from '../src/lib/backend.js';

const fails = (p, re) => assert.rejects(p, re);
const mkBackend = () => {
  let db = seed(), tok = ''; const be = createBackend({ token: () => tok, load: async () => structuredClone(db), save: async d => { db = structuredClone(d); } });
  return { h: be.handle, get db() { return db; }, as: async (who) => { tok = (await be.handle('POST', '/auth/login', { email: who + '@demo.test', password: 'demo1234' })).token; } };
};
const stop = { name: 'Lola Inday Native Kitchen', municipalityId: 3, description: 'Home-made rice cakes.', address: 'Purok 2', phone: '0917 000 0000', delicacies: 'Sinapot, Puto', leadTime: 'Order 1 day ahead', orderNote: 'Message to order.' };

test('an admin can add a native delicacies stop without any business papers, and it goes live at once', async () => {
  const t = mkBackend(); await t.as('admin'); const made = await t.h('POST', '/admin/manage/native', stop);
  assert.equal(made.title, 'Lola Inday Native Kitchen'); assert.deepEqual([made.leadTime, made.orderNote, made.delicacies], ['Order 1 day ahead', 'Message to order.', 'Sinapot, Puto']); assert.equal(made.status, 'approved'); assert.equal(made.papers.status, 'not_required');
  const pub = (await t.h('GET', '/restaurants?type=native')).find(r => r.name === 'Lola Inday Native Kitchen'); assert.ok(pub);
  assert.deepEqual([pub.type, pub.papers_status, pub.lead_time, pub.accepts_reservations, pub.cuisines], ['native', 'not_required', 'Order 1 day ahead', false, ['Sinapot', 'Puto']]);
  const detail = await t.h('GET', `/restaurants/${pub.restaurant_id}`); assert.equal(detail.papers.status, 'not_required'); assert.deepEqual(detail.papers.required, []);
});
test('made-to-order stops and restaurants are kept apart everywhere', async () => {
  const t = mkBackend(); const all = await t.h('GET', '/restaurants'), nat = await t.h('GET', '/restaurants?type=native'), rest = await t.h('GET', '/restaurants?type=restaurant');
  assert.ok(nat.length >= 2 && nat.every(r => r.type === 'native')); assert.ok(rest.length >= 2 && rest.every(r => r.type === 'restaurant')); assert.equal(all.length, nat.length + rest.length);
  await t.as('admin'); await t.h('POST', '/admin/manage/native', stop);
  const adminRest = await t.h('GET', '/admin/manage/restaurants'), adminNat = await t.h('GET', '/admin/manage/native');
  assert.ok(!adminRest.some(r => r.title === 'Lola Inday Native Kitchen')); assert.ok(adminNat.some(r => r.title === 'Lola Inday Native Kitchen')); assert.ok(adminNat.every(r => r.papers.status === 'not_required'));
  assert.ok(!(await t.h('GET', '/admin/manage/restaurants')).some(r => /Aling Rosa|Pili Treats/.test(r.title))); // the samples are native too
});
test('native stops take no table reservations, can be edited, and their delicacies list works', async () => {
  const t = mkBackend(); await t.as('admin'); const made = await t.h('POST', '/admin/manage/native', stop);
  const edited = await t.h('PUT', `/admin/manage/native/${made.id}`, { ...stop, delicacies: 'Sinapot', leadTime: 'Order 2 days ahead', acceptsReservations: true }); assert.deepEqual([edited.delicacies, edited.leadTime], ['Sinapot', 'Order 2 days ahead']);
  assert.equal((await t.h('GET', `/restaurants/${made.id}`)).accepts_reservations, false); // cannot be switched on
  const withMenu = await t.h('POST', `/admin/manage/native/${made.id}/menu`, { itemName: 'Sinapot (piece)', price: 25 }); assert.equal(withMenu.menu.length, 1);
  assert.equal((await t.h('GET', `/restaurants/${made.id}`)).menu[0].item_name, 'Sinapot (piece)');
  await t.as('tourist'); await fails(t.h('POST', '/bookings/reservation', { restaurantId: made.id, reservedAt: new Date(Date.now() + 864e5).toISOString(), partySize: 2 }), /does not take reservations/);
  await t.as('admin'); await t.h('DELETE', `/admin/manage/native/${made.id}`); assert.ok(!(await t.h('GET', '/restaurants?type=native')).some(r => r.name === stop.name));
});
test('only an admin can add them, the name and municipality are still required, and real restaurants still need their papers', async () => {
  const t = mkBackend(); await t.as('owner'); await fails(t.h('POST', '/admin/manage/native', stop), /Forbidden/); await t.as('tourist'); await fails(t.h('POST', '/admin/manage/native', stop), /Forbidden/);
  await t.as('admin'); await fails(t.h('POST', '/admin/manage/native', { ...stop, name: '' }), /Name and municipality/); await fails(t.h('POST', '/admin/manage/native', { ...stop, municipalityId: '' }), /Name and municipality/);
  const rest = await t.h('POST', '/admin/manage/restaurants', { name: 'Plain Eatery', municipalityId: 1, cuisines: 'Filipino', status: 'pending' }); assert.equal(rest.papers.status, 'incomplete');
  const biz = t.db.businesses.find(b => b.name === 'Plain Eatery'); await fails(t.h('PATCH', `/admin/businesses/${biz.id}/status`, { status: 'approved' }), /required documents/); // unchanged for restaurants
  const nat = await t.h('POST', '/admin/manage/native', { ...stop, status: 'pending' }); const nb = t.db.businesses.find(b => b.name === stop.name); await t.h('PATCH', `/admin/businesses/${nb.id}/status`, { status: 'approved' }); assert.equal(nat.papers.status, 'not_required'); // no papers to wait for
});
test('the business report lists native stops separately and never as missing papers', async () => {
  const t = mkBackend(); await t.as('admin'); const rep = await t.h('GET', '/admin/business-report'), nat = rep.rows.filter(r => r.type === 'Native delicacies');
  assert.ok(nat.length >= 2); assert.ok(nat.every(r => r.papers === 'not_required' && r.kind === 'native')); assert.ok(!rep.rows.filter(r => r.papers === 'incomplete').some(r => r.type === 'Native delicacies'));
  assert.ok(rep.rows.filter(r => r.type === 'Eat').every(r => r.kind === 'restaurants'));
});
test('a business owner\'s dashboard never contains native stops', async () => {
  const t = mkBackend(); for (const who of ['owner', 'owner2', 'owner3', 'owner4']) { await t.as(who); const mine = await t.h('GET', '/owner/businesses'); assert.ok(mine.every(b => b.kind !== 'native' && b.category !== 'Native delicacies'), who); }
});
