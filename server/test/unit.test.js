import test from 'node:test';
import assert from 'node:assert/strict';
import { km, legMinutes, nearestOrder, withLegs } from '../src/lib/itinerary.js';

test('km: zero distance and symmetry', () => {
  const a = { lat: 13.58, lng: 124.23 }, b = { lat: 13.7, lng: 124.35 };
  assert.equal(km(a, a), 0);
  assert.ok(Math.abs(km(a, b) - km(b, a)) < 1e-9);
  assert.ok(km(a, b) > 15 && km(a, b) < 25);
});
test('legMinutes returns null when coordinates are missing', () => {
  assert.equal(legMinutes({ lat: null, lng: null }, { lat: 13, lng: 124 }), null);
  assert.ok(legMinutes({ lat: 13.5, lng: 124.2 }, { lat: 13.6, lng: 124.3 }) >= 1);
});
test('nearestOrder visits nearer stops first and keeps coordinate-less stops last', () => {
  const out = nearestOrder([{ id: 'far', lat: 14.0, lng: 124.5 }, { id: 'none' }, { id: 'near', lat: 13.59, lng: 124.24 }]);
  assert.deepEqual(out.map(x => x.id), ['near', 'far', 'none']);
});
test('withLegs totals cost, counts unpriced stops and flags over-budget', () => {
  const items = [{ day_no: 1, est_cost: '100', lat: 13.5, lng: 124.2 }, { day_no: 1, est_cost: null, lat: 13.6, lng: 124.3 }, { day_no: 2, est_cost: '50', lat: 13.5, lng: 124.2 }];
  const r = withLegs(items, 120);
  assert.equal(r.totals.cost, 150); assert.equal(r.totals.unpriced, 1); assert.equal(r.totals.overBudget, true);
  assert.equal(r.items[0].travel_minutes, null); assert.ok(r.items[1].travel_minutes > 0); assert.equal(r.items[2].travel_minutes, null); // no leg across days
});
