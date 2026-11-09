import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { tx, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { HUB, nearestOrder, withLegs } from '../lib/itinerary.js';
const r = Router();

const LOAD = `SELECT it.id,it.day_no,it.position,it.listing_type,it.listing_id,it.start_time,it.duration_min,it.est_cost,it.notes,
  COALESCE(d.name,rb.name,ab.name,bb.name,it.title) AS name, COALESCE(d.lat,rb.lat,ab.lat,bb.lat) AS lat, COALESCE(d.lng,rb.lng,ab.lng,bb.lng) AS lng
  FROM itinerary_items it
  LEFT JOIN destinations d ON it.listing_type='destination' AND d.id=it.listing_id
  LEFT JOIN restaurants r ON it.listing_type='restaurant' AND r.id=it.listing_id LEFT JOIN businesses rb ON rb.id=r.business_id
  LEFT JOIN accommodations a ON it.listing_type='accommodation' AND a.id=it.listing_id LEFT JOIN businesses ab ON ab.id=a.business_id
  LEFT JOIN businesses bb ON it.listing_type='business' AND bb.id=it.listing_id
  WHERE it.itinerary_id=$1 ORDER BY it.day_no,it.position`;
async function full(c, where, params) {
  const it = (await c.query(`SELECT id,title,budget,preferences,share_token FROM itineraries WHERE ${where}`, params)).rows[0];
  if (!it) return null;
  const { items, totals } = withLegs((await c.query(LOAD, [it.id])).rows, it.budget);
  return { ...it, items, totals };
}
// Public read-only view for shared links (no personal data returned).
r.get('/shared/:token', async (req, res) => {
  const x = await full({ query }, 'share_token=$1', [req.params.token]);
  if (!x) return res.status(404).json({ error: 'Itinerary not found' });
  delete x.share_token; res.json(x);
});
r.use(requireAuth());
r.get('/', async (req, res) => res.json((await query('SELECT id,title,budget,updated_at FROM itineraries WHERE user_id=$1 ORDER BY updated_at DESC', [req.user.id])).rows));
r.get('/:id', async (req, res) => { const x = await full({ query }, 'id=$1 AND user_id=$2', [req.params.id, req.user.id]); x ? res.json(x) : res.status(404).json({ error: 'Itinerary not found' }); });

const gen = z.object({ title: z.string().min(1).max(80), days: z.number().int().min(1).max(10), pace: z.enum(['relaxed', 'balanced', 'adventurous']), budget: z.number().min(0).nullish(), municipality: z.string().nullish(), destinationIds: z.array(z.string().uuid()).default([]), cuisine: z.string().nullish() });
r.post('/generate', async (req, res) => {
  const p = gen.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Check your trip preferences' });
  const g = p.data, per = { relaxed: 2, balanced: 3, adventurous: 4 }[g.pace];
  const dests = (await query(`SELECT d.id,d.name,d.lat,d.lng,d.entrance_fee FROM destinations d JOIN municipalities m ON m.id=d.municipality_id WHERE d.is_published AND ($1::text IS NULL OR m.name=$1)`, [g.municipality || null])).rows;
  dests.sort((a, b) => g.destinationIds.includes(b.id) - g.destinationIds.includes(a.id));
  const ordered = nearestOrder(dests.slice(0, g.days * per));
  const foods = (await query(`SELECT r.id,b.name,b.lat,b.lng,(SELECT round(avg(price)) FROM menus WHERE restaurant_id=r.id) AS avg_price FROM restaurants r JOIN businesses b ON b.id=r.business_id WHERE b.status='approved' AND ($1::text IS NULL OR $1=ANY(r.cuisines))`, [g.cuisine || null])).rows;
  const stay = g.days > 1 ? (await query(`SELECT a.id,min(r.price_per_night) AS price FROM accommodations a JOIN businesses b ON b.id=a.business_id JOIN rooms r ON r.accommodation_id=a.id WHERE b.status='approved' GROUP BY a.id ORDER BY price LIMIT 1`)).rows[0] : null;
  const id = await tx(async (c) => {
    const it = (await c.query('INSERT INTO itineraries(user_id,title,preferences,budget) VALUES($1,$2,$3,$4) RETURNING id', [req.user.id, g.title, g, g.budget ?? null])).rows[0];
    let n = 0;
    for (let day = 1; day <= g.days; day++) {
      const todays = ordered.slice((day - 1) * per, day * per); let mins = 9 * 60, pos = 0;
      const put = async (type, lid, title, cost, dur) => {
        const t = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; mins += dur + 30; // 90-min default stay, 30-min buffer; user can edit
        await c.query('INSERT INTO itinerary_items(itinerary_id,day_no,position,listing_type,listing_id,title,start_time,duration_min,est_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [it.id, day, pos++, type, lid, title, t, dur, cost]);
      };
      for (let i = 0; i < todays.length; i++) {
        if (i === Math.ceil(todays.length / 2) && foods.length) { const f = foods[(n++) % foods.length]; await put('restaurant', f.id, null, f.avg_price, 60); }
        const d = todays[i]; await put('destination', d.id, null, d.entrance_fee, 90);
      }
      if (day === 1 && stay) await c.query('INSERT INTO itinerary_items(itinerary_id,day_no,position,listing_type,listing_id,est_cost,notes) VALUES($1,1,$2,$3,$4,$5,$6)', [it.id, pos, 'accommodation', stay.id, Number(stay.price) * (g.days - 1), `Cheapest listed room, ${g.days - 1} night(s). Change it if you prefer.`]);
    }
    return it.id;
  });
  res.status(201).json(await full({ query }, 'id=$1', [id]));
});

const item = z.object({ day_no: z.number().int().min(1), listing_type: z.enum(['destination', 'accommodation', 'restaurant', 'business']).nullish(), listing_id: z.string().uuid().nullish(), title: z.string().max(120).nullish(), start_time: z.string().regex(/^\d{2}:\d{2}/).nullish(), duration_min: z.number().int().min(0).nullish(), est_cost: z.number().min(0).nullish(), notes: z.string().max(500).nullish() });
r.put('/:id', async (req, res) => { // full replace keeps drag-and-drop simple; server recalculates travel/cost on return
  const p = z.object({ title: z.string().min(1).max(80), budget: z.number().min(0).nullish(), items: z.array(item).max(120) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check your itinerary changes' });
  const out = await tx(async (c) => {
    const own = (await c.query('UPDATE itineraries SET title=$1,budget=$2,updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING id', [p.data.title, p.data.budget ?? null, req.params.id, req.user.id])).rows[0];
    if (!own) return null;
    await c.query('DELETE FROM itinerary_items WHERE itinerary_id=$1', [own.id]);
    const pos = {};
    for (const i of p.data.items) { pos[i.day_no] = (pos[i.day_no] ?? -1) + 1;
      await c.query('INSERT INTO itinerary_items(itinerary_id,day_no,position,listing_type,listing_id,title,start_time,duration_min,est_cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [own.id, i.day_no, pos[i.day_no], i.listing_type ?? null, i.listing_id ?? null, i.title ?? null, i.start_time ?? null, i.duration_min ?? null, i.est_cost ?? null, i.notes ?? null]); }
    return full(c, 'id=$1', [own.id]);
  });
  out ? res.json(out) : res.status(404).json({ error: 'Itinerary not found' });
});
r.post('/:id/duplicate', async (req, res) => {
  const id = await tx(async (c) => {
    const o = (await c.query('INSERT INTO itineraries(user_id,title,preferences,budget) SELECT user_id,title||$3,preferences,budget FROM itineraries WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.id, ' (copy)'])).rows[0];
    if (!o) return null;
    await c.query('INSERT INTO itinerary_items(itinerary_id,day_no,position,listing_type,listing_id,title,start_time,duration_min,est_cost,notes) SELECT $1,day_no,position,listing_type,listing_id,title,start_time,duration_min,est_cost,notes FROM itinerary_items WHERE itinerary_id=$2', [o.id, req.params.id]);
    return o.id;
  });
  id ? res.status(201).json({ id }) : res.status(404).json({ error: 'Itinerary not found' });
});
r.post('/:id/share', async (req, res) => {
  const t = crypto.randomBytes(12).toString('hex');
  const { rows } = await query('UPDATE itineraries SET share_token=COALESCE(share_token,$1) WHERE id=$2 AND user_id=$3 RETURNING share_token', [t, req.params.id, req.user.id]);
  rows[0] ? res.json({ token: rows[0].share_token }) : res.status(404).json({ error: 'Itinerary not found' });
});
r.delete('/:id', async (req, res) => { await query('DELETE FROM itineraries WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); res.json({ ok: true }); });
export default r;
