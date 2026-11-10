import { Router } from 'express';
import { z } from 'zod';
import { tx, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createPayment } from './payments.js';
const r = Router();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FREE = `r.quantity - COALESCE((SELECT count(*) FROM accommodation_bookings b WHERE b.room_id=r.id AND b.status IN ('pending','confirmed') AND b.check_in < $3::date AND b.check_out > $2::date),0)`;

r.get('/availability', async (req, res) => {
  const p = z.object({ accommodationId: z.string().uuid(), checkIn: day, checkOut: day, guests: z.coerce.number().int().min(1).default(1) }).safeParse(req.query);
  if (!p.success || p.data.checkOut <= p.data.checkIn) return res.status(400).json({ error: 'Choose valid dates' });
  const { accommodationId, checkIn, checkOut, guests } = p.data;
  const { rows } = await query(`SELECT r.id,r.name,r.capacity,r.price_per_night,r.photos,(${FREE})::int AS available FROM rooms r WHERE r.accommodation_id=$1 AND r.capacity>=$4 ORDER BY r.price_per_night`, [accommodationId, checkIn, checkOut, guests]);
  res.json(rows.filter(x => x.available > 0));
});
r.post('/stay', requireAuth(), async (req, res) => {
  const p = z.object({ roomId: z.string().uuid(), checkIn: day, checkOut: day, guests: z.number().int().min(1) }).safeParse(req.body);
  if (!p.success || p.data.checkOut <= p.data.checkIn) return res.status(400).json({ error: 'Check your booking details' });
  const d = p.data;
  const out = await tx(async (c) => {
    const room = (await c.query('SELECT * FROM rooms WHERE id=$1 FOR UPDATE', [d.roomId])).rows[0]; // serializes bookings per room
    if (!room || room.capacity < d.guests) return { code: 400, error: 'Room not available for that group size' };
    const free = (await c.query(`SELECT (${FREE})::int AS n FROM rooms r WHERE r.id=$1`, [d.roomId, d.checkIn, d.checkOut])).rows[0].n;
    if (free < 1) return { code: 409, error: 'Sorry, that room was just taken for those dates' };
    const nights = (await c.query('SELECT ($1::date-$2::date) AS n', [d.checkOut, d.checkIn])).rows[0].n;
    const total = Number(room.price_per_night) * nights;
    const pay = await createPayment(c, req.user.id, total);
    const b = (await c.query('INSERT INTO accommodation_bookings(user_id,room_id,check_in,check_out,guests,total,payment_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,total', [req.user.id, d.roomId, d.checkIn, d.checkOut, d.guests, total, pay.id])).rows[0];
    return { code: 201, booking: b, payment: pay };
  });
  out.error ? res.status(out.code).json({ error: out.error }) : res.status(201).json(out);
});
r.post('/stay/:id/cancel', requireAuth(), async (req, res) => {
  const { rows } = await query(`UPDATE accommodation_bookings SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status IN ('pending','confirmed') AND check_in > current_date RETURNING id`, [req.params.id, req.user.id]);
  // Refunds are handled per business policy through the payment gateway; marking is manual until a gateway is connected.
  rows[0] ? res.json({ ok: true }) : res.status(409).json({ error: 'This booking can no longer be cancelled' });
});
r.post('/reservation', requireAuth(), async (req, res) => {
  const p = z.object({ restaurantId: z.string().uuid(), reservedAt: z.string().datetime(), partySize: z.number().int().min(1).max(50) }).safeParse(req.body);
  if (!p.success || new Date(p.data.reservedAt) < new Date()) return res.status(400).json({ error: 'Choose a future time' });
  const ok = (await query('SELECT 1 FROM restaurants WHERE id=$1 AND accepts_reservations', [p.data.restaurantId])).rows[0];
  if (!ok) return res.status(400).json({ error: 'This restaurant does not take reservations here' });
  const { rows } = await query('INSERT INTO restaurant_reservations(user_id,restaurant_id,reserved_at,party_size) VALUES($1,$2,$3,$4) RETURNING id,status', [req.user.id, p.data.restaurantId, p.data.reservedAt, p.data.partySize]);
  res.status(201).json(rows[0]);
});
r.get('/mine', requireAuth(), async (req, res) => {
  const u = req.user.id;
  const [stays, rides, tables] = await Promise.all([
    query(`SELECT b.id,b.check_in,b.check_out,b.total,b.status,b.payment_id,p.status AS payment_status,p.provider_ref,biz.name FROM accommodation_bookings b JOIN rooms r ON r.id=b.room_id JOIN accommodations a ON a.id=r.accommodation_id JOIN businesses biz ON biz.id=a.business_id LEFT JOIN payments p ON p.id=b.payment_id WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [u]),
    query(`SELECT t.id,t.pickup,t.dropoff,t.pickup_at,t.passengers,t.fare,t.status,t.payment_id,v.driver_name,pr.phone AS provider_phone,pr.name AS provider FROM transport_bookings t LEFT JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN transport_routes tr ON tr.id=t.route_id LEFT JOIN transport_providers pr ON pr.id=tr.provider_id WHERE t.user_id=$1 ORDER BY t.created_at DESC`, [u]),
    query(`SELECT x.id,x.reserved_at,x.party_size,x.status,b.name FROM restaurant_reservations x JOIN restaurants r ON r.id=x.restaurant_id JOIN businesses b ON b.id=r.business_id WHERE x.user_id=$1 ORDER BY x.reserved_at DESC`, [u])]);
  res.json({ stays: stays.rows, rides: rides.rows, tables: tables.rows });
});
export default r;
