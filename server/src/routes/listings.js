import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
const base = `SELECT b.id,b.name,b.description,b.address,b.lat,b.lng,b.phone,b.hours,m.name AS municipality`;
r.get('/restaurants', async (req, res) => {
  const { cuisine, municipality } = req.query;
  res.json((await query(`${base},r.id AS restaurant_id,r.cuisines,r.price_range,r.accepts_reservations FROM restaurants r JOIN businesses b ON b.id=r.business_id LEFT JOIN municipalities m ON m.id=b.municipality_id
    WHERE b.status='approved' AND ($1::text IS NULL OR $1=ANY(r.cuisines)) AND ($2::text IS NULL OR m.name=$2) ORDER BY b.name LIMIT 100`, [cuisine || null, municipality || null])).rows);
});
r.get('/accommodations', async (req, res) => {
  const { municipality } = req.query;
  res.json((await query(`${base},a.id AS accommodation_id,a.type,a.amenities,(SELECT MIN(price_per_night) FROM rooms WHERE accommodation_id=a.id) AS from_price
    FROM accommodations a JOIN businesses b ON b.id=a.business_id LEFT JOIN municipalities m ON m.id=b.municipality_id
    WHERE b.status='approved' AND ($1::text IS NULL OR m.name=$1) ORDER BY b.name LIMIT 100`, [municipality || null])).rows);
});
// Owner submits a business; it stays 'pending' until the tourism office approves it.
r.post('/businesses', requireAuth('business_owner'), async (req, res) => {
  const p = z.object({ name: z.string().min(2), municipalityId: z.number().int(), description: z.string().optional(), address: z.string().optional(), phone: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check your business details' });
  const d = p.data;
  const { rows } = await query('INSERT INTO businesses(owner_id,name,municipality_id,description,address,phone) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status', [req.user.id, d.name, d.municipalityId, d.description, d.address, d.phone]);
  res.status(201).json(rows[0]);
});

r.get('/municipalities', async (_q, res) => res.json((await query('SELECT id,name FROM municipalities ORDER BY name')).rows));


r.get('/restaurants/:id', async (req, res) => {
  const { rows } = await query(`${base},r.id AS restaurant_id,r.cuisines,r.price_range,r.accepts_reservations FROM restaurants r JOIN businesses b ON b.id=r.business_id LEFT JOIN municipalities m ON m.id=b.municipality_id WHERE r.id=$1 AND b.status='approved'`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Restaurant not found' });
  const menu = (await query('SELECT id,item_name,description,price FROM menus WHERE restaurant_id=$1 ORDER BY item_name', [req.params.id])).rows;
  res.json({ ...rows[0], menu });
});
r.get('/businesses', async (req, res) => res.json((await query(`${base},c.name AS category FROM businesses b LEFT JOIN municipalities m ON m.id=b.municipality_id LEFT JOIN business_categories c ON c.id=b.category_id WHERE b.status='approved' AND c.name IN ('Souvenir shops','Groceries') AND ($1::text IS NULL OR c.name=$1) ORDER BY b.name LIMIT 100`, [req.query.category || null])).rows));
r.get('/businesses/:id', async (req, res) => {
  const { rows } = await query(`${base},c.name AS category FROM businesses b LEFT JOIN municipalities m ON m.id=b.municipality_id LEFT JOIN business_categories c ON c.id=b.category_id WHERE b.id=$1 AND b.status='approved'`, [req.params.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Business not found' });
});
r.get('/business-categories', async (_q, res) => res.json((await query('SELECT id,name FROM business_categories ORDER BY name')).rows));
r.get('/reviews', async (req, res) => {
  const p = z.object({ type: z.enum(['destination', 'accommodation', 'restaurant', 'business']), id: z.string().uuid() }).safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'Invalid request' });
  const rows = (await query(`SELECT rv.rating,rv.comment,rv.created_at,split_part(u.full_name,' ',1) AS name FROM reviews rv JOIN users u ON u.id=rv.user_id WHERE rv.listing_type=$1 AND rv.listing_id=$2 ORDER BY rv.created_at DESC LIMIT 50`, [p.data.type, p.data.id])).rows;
  res.json({ average: rows.length ? Math.round(rows.reduce((s, x) => s + x.rating, 0) / rows.length * 10) / 10 : null, count: rows.length, reviews: rows });
});
r.post('/reviews', requireAuth(), async (req, res) => { // one review per person per listing; posting again updates it
  const p = z.object({ type: z.enum(['destination', 'accommodation', 'restaurant', 'business']), id: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Choose a rating from 1 to 5' });
  await query(`INSERT INTO reviews(user_id,listing_type,listing_id,rating,comment) VALUES($1,$2,$3,$4,$5) ON CONFLICT (user_id,listing_type,listing_id) DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment`, [req.user.id, p.data.type, p.data.id, p.data.rating, p.data.comment ?? null]);
  res.status(201).json({ ok: true });
});

r.get('/accommodations/:id', async (req, res) => {
  const { rows } = await query(`${base},a.id AS accommodation_id,a.type,a.amenities FROM accommodations a JOIN businesses b ON b.id=a.business_id LEFT JOIN municipalities m ON m.id=b.municipality_id WHERE a.id=$1 AND b.status='approved'`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Accommodation not found' });
  const rooms = (await query('SELECT id,name,capacity,price_per_night FROM rooms WHERE accommodation_id=$1 ORDER BY price_per_night', [req.params.id])).rows;
  res.json({ ...rows[0], rooms });
});
export default r;
