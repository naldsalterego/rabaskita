import QRCode from 'qrcode';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.use(requireAuth('business_owner'));
const mine = (uid, bid) => query(`SELECT id FROM businesses WHERE id=$1 AND owner_id=$2 AND status='approved'`, [bid, uid]).then(x => x.rows[0]);
r.get('/businesses', async (req, res) => res.json((await query('SELECT id,name,status FROM businesses WHERE owner_id=$1', [req.user.id])).rows));
r.post('/accommodations', async (req, res) => {
  const p = z.object({ businessId: z.string().uuid(), type: z.enum(['hotel', 'resort', 'inn', 'staycation', 'homestay', 'private']), amenities: z.array(z.string()).default([]) }).safeParse(req.body);
  if (!p.success || !(await mine(req.user.id, p.data.businessId))) return res.status(400).json({ error: 'Business not found or not approved yet' });
  res.status(201).json((await query('INSERT INTO accommodations(business_id,type,amenities) VALUES($1,$2,$3) RETURNING id', [p.data.businessId, p.data.type, p.data.amenities])).rows[0]);
});
r.post('/rooms', async (req, res) => {
  const p = z.object({ accommodationId: z.string().uuid(), name: z.string().min(2), capacity: z.number().int().min(1), pricePerNight: z.number().min(0), quantity: z.number().int().min(1).default(1) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check room details' });
  const d = p.data;
  const { rows } = await query(`INSERT INTO rooms(accommodation_id,name,capacity,price_per_night,quantity) SELECT a.id,$2,$3,$4,$5 FROM accommodations a JOIN businesses b ON b.id=a.business_id WHERE a.id=$1 AND b.owner_id=$6 RETURNING id`, [d.accommodationId, d.name, d.capacity, d.pricePerNight, d.quantity, req.user.id]);
  rows[0] ? res.status(201).json(rows[0]) : res.status(403).json({ error: 'Not your accommodation' });
});
r.get('/bookings', async (req, res) => res.json((await query(`SELECT bk.id,bk.check_in,bk.check_out,bk.guests,bk.total,bk.status,u.full_name,r.name AS room FROM accommodation_bookings bk JOIN rooms r ON r.id=bk.room_id JOIN accommodations a ON a.id=r.accommodation_id JOIN businesses b ON b.id=a.business_id JOIN users u ON u.id=bk.user_id WHERE b.owner_id=$1 ORDER BY bk.check_in DESC`, [req.user.id])).rows));

r.get('/accommodations', async (req, res) => res.json((await query(`SELECT a.id,a.type,b.name,(SELECT COALESCE(json_agg(json_build_object('id',r.id,'name',r.name,'capacity',r.capacity,'price',r.price_per_night,'quantity',r.quantity)),'[]') FROM rooms r WHERE r.accommodation_id=a.id) AS rooms FROM accommodations a JOIN businesses b ON b.id=a.business_id WHERE b.owner_id=$1`, [req.user.id])).rows));
r.get('/analytics', async (req, res) => res.json((await query(`SELECT count(*)::int AS bookings, COALESCE(sum(bk.total) FILTER (WHERE bk.status='confirmed'),0) AS confirmed_revenue,
  count(*) FILTER (WHERE bk.status='pending')::int AS pending FROM accommodation_bookings bk JOIN rooms r ON r.id=bk.room_id JOIN accommodations a ON a.id=r.accommodation_id JOIN businesses b ON b.id=a.business_id WHERE b.owner_id=$1`, [req.user.id])).rows[0]));
// Owners can create/download a QR for their own approved business. Point values are set only by the tourism office.
r.post('/qr', async (req, res) => {
  const b = await mine(req.user.id, req.body?.businessId); if (!b) return res.status(400).json({ error: 'Business not found or not approved yet' });
  const ex = (await query(`SELECT id FROM qr_codes WHERE listing_type='business' AND listing_id=$1 AND is_active`, [b.id])).rows[0];
  const row = ex || (await query(`INSERT INTO qr_codes(listing_type,listing_id) VALUES('business',$1) RETURNING id`, [b.id])).rows[0];
  res.status(ex ? 200 : 201).json(row);
});
r.get('/qr/:id.png', async (req, res) => {
  const q = (await query(`SELECT q.token FROM qr_codes q JOIN businesses b ON b.id=q.listing_id WHERE q.id=$1 AND q.listing_type='business' AND b.owner_id=$2`, [req.params.id, req.user.id])).rows[0];
  if (!q) return res.status(404).end();
  res.type('png').send(await QRCode.toBuffer(`${process.env.CLIENT_ORIGIN}/checkin/${q.token}`, { width: 512, margin: 2 }));
});


r.put('/businesses/:id', async (req, res) => {
  const p = z.object({ description: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), lat: z.number().min(-90).max(90).nullish(), lng: z.number().min(-180).max(180).nullish(), categoryId: z.number().int().nullish(), hours: z.record(z.string()).nullish() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check your business details' });
  const d = p.data;
  const { rows } = await query('UPDATE businesses SET description=COALESCE($1,description),address=COALESCE($2,address),phone=COALESCE($3,phone),lat=COALESCE($4,lat),lng=COALESCE($5,lng),category_id=COALESCE($6,category_id),hours=COALESCE($7,hours) WHERE id=$8 AND owner_id=$9 RETURNING id', [d.description, d.address, d.phone, d.lat, d.lng, d.categoryId, d.hours, req.params.id, req.user.id]);
  rows[0] ? res.json({ ok: true }) : res.status(404).json({ error: 'Business not found' });
});
r.get('/restaurants', async (req, res) => res.json((await query(`SELECT r.id,b.name,r.cuisines,r.price_range,r.accepts_reservations,(SELECT COALESCE(json_agg(json_build_object('id',m.id,'name',m.item_name,'price',m.price)),'[]') FROM menus m WHERE m.restaurant_id=r.id) AS menu FROM restaurants r JOIN businesses b ON b.id=r.business_id WHERE b.owner_id=$1`, [req.user.id])).rows));
r.post('/restaurants', async (req, res) => {
  const p = z.object({ businessId: z.string().uuid(), cuisines: z.array(z.string()).default([]), priceRange: z.number().int().min(1).max(4).nullish(), acceptsReservations: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success || !(await mine(req.user.id, p.data.businessId))) return res.status(400).json({ error: 'Business not found or not approved yet' });
  const d = p.data; res.status(201).json((await query('INSERT INTO restaurants(business_id,cuisines,price_range,accepts_reservations) VALUES($1,$2,$3,$4) RETURNING id', [d.businessId, d.cuisines, d.priceRange ?? null, d.acceptsReservations])).rows[0]);
});
r.post('/menu-items', async (req, res) => {
  const p = z.object({ restaurantId: z.string().uuid(), itemName: z.string().min(2), description: z.string().optional(), price: z.number().min(0) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check the menu item' });
  const d = p.data;
  const { rows } = await query('INSERT INTO menus(restaurant_id,item_name,description,price) SELECT r.id,$2,$3,$4 FROM restaurants r JOIN businesses b ON b.id=r.business_id WHERE r.id=$1 AND b.owner_id=$5 RETURNING id', [d.restaurantId, d.itemName, d.description, d.price, req.user.id]);
  rows[0] ? res.status(201).json(rows[0]) : res.status(403).json({ error: 'Not your restaurant' });
});

export default r;
