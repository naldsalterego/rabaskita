import { Router } from 'express';
import { z } from 'zod';
import { tx, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createPayment } from './payments.js';
const r = Router();
const prov = (uid) => query(`SELECT id FROM transport_providers WHERE owner_id=$1 AND status='approved'`, [uid]).then(x => x.rows[0]);

r.get('/routes', async (req, res) => { // pickup hubs: 'Virac Airport', 'San Andres Port', 'Virac Port', ...
  const { origin } = req.query;
  res.json((await query(`SELECT tr.id,tr.origin,tr.destination,tr.fare,tr.est_minutes,p.name AS provider,
    (SELECT json_agg(json_build_object('id',v.id,'type',v.type,'capacity',v.capacity)) FROM vehicles v WHERE v.provider_id=p.id AND v.is_available) AS vehicles
    FROM transport_routes tr JOIN transport_providers p ON p.id=tr.provider_id WHERE p.status='approved' AND ($1::text IS NULL OR tr.origin ILIKE $1) ORDER BY tr.fare`, [origin || null])).rows);
});
r.post('/book', requireAuth(), async (req, res) => {
  const p = z.object({ routeId: z.string().uuid(), vehicleId: z.string().uuid().optional(), pickupAt: z.string().datetime(), passengers: z.number().int().min(1), luggage: z.string().max(200).optional() }).safeParse(req.body);
  if (!p.success || new Date(p.data.pickupAt) < new Date()) return res.status(400).json({ error: 'Check your ride details' });
  const d = p.data;
  const out = await tx(async (c) => {
    const rt = (await c.query(`SELECT tr.* FROM transport_routes tr JOIN transport_providers p ON p.id=tr.provider_id WHERE tr.id=$1 AND p.status='approved'`, [d.routeId])).rows[0];
    if (!rt) return { code: 404, error: 'Route not available' };
    if (d.vehicleId) { const v = (await c.query('SELECT capacity FROM vehicles WHERE id=$1 AND provider_id=$2 AND is_available', [d.vehicleId, rt.provider_id])).rows[0]; if (!v || v.capacity < d.passengers) return { code: 400, error: 'That vehicle cannot take your group' }; }
    const pay = await createPayment(c, req.user.id, rt.fare);
    const b = (await c.query('INSERT INTO transport_bookings(user_id,route_id,vehicle_id,pickup,dropoff,pickup_at,passengers,luggage,fare,payment_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status', [req.user.id, rt.id, d.vehicleId ?? null, rt.origin, rt.destination, d.pickupAt, d.passengers, d.luggage, rt.fare, pay.id])).rows[0];
    return { code: 201, booking: b, payment: pay };
  });
  out.error ? res.status(out.code).json({ error: out.error }) : res.status(201).json(out);
});
// Provider side
r.post('/provider', requireAuth('transport_provider'), async (req, res) => {
  const p = z.object({ name: z.string().min(2), phone: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check your details' });
  const { rows } = await query('INSERT INTO transport_providers(owner_id,name,phone) VALUES($1,$2,$3) RETURNING id,status', [req.user.id, p.data.name, p.data.phone]);
  res.status(201).json(rows[0]); // stays pending until the tourism office approves
});
r.post('/vehicles', requireAuth('transport_provider'), async (req, res) => {
  const pv = await prov(req.user.id); if (!pv) return res.status(403).json({ error: 'Your provider account is not approved yet' });
  const p = z.object({ type: z.enum(['tricycle', 'van', 'multicab', 'motorcycle', 'car', 'other']), capacity: z.number().int().min(1), plateNo: z.string().optional(), driverName: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check vehicle details' });
  const d = p.data; res.status(201).json((await query('INSERT INTO vehicles(provider_id,type,capacity,plate_no,driver_name) VALUES($1,$2,$3,$4,$5) RETURNING id', [pv.id, d.type, d.capacity, d.plateNo, d.driverName])).rows[0]);
});
r.post('/routes', requireAuth('transport_provider'), async (req, res) => {
  const pv = await prov(req.user.id); if (!pv) return res.status(403).json({ error: 'Your provider account is not approved yet' });
  const p = z.object({ origin: z.string().min(2), destination: z.string().min(2), fare: z.number().min(0), estMinutes: z.number().int().nullish() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check route details' });
  const d = p.data; res.status(201).json((await query('INSERT INTO transport_routes(provider_id,origin,destination,fare,est_minutes) VALUES($1,$2,$3,$4,$5) RETURNING id', [pv.id, d.origin, d.destination, d.fare, d.estMinutes ?? null])).rows[0]);
});
r.get('/provider/bookings', requireAuth('transport_provider'), async (req, res) => {
  const pv = await prov(req.user.id); if (!pv) return res.json([]);
  res.json((await query(`SELECT t.id,t.pickup,t.dropoff,t.pickup_at,t.passengers,t.luggage,t.status,t.fare,u.full_name,p.status AS payment_status FROM transport_bookings t JOIN transport_routes tr ON tr.id=t.route_id JOIN users u ON u.id=t.user_id LEFT JOIN payments p ON p.id=t.payment_id WHERE tr.provider_id=$1 AND t.pickup_at >= now() - interval '1 day' ORDER BY t.pickup_at`, [pv.id])).rows);
});
r.patch('/bookings/:id', requireAuth('transport_provider'), async (req, res) => {
  const s = z.enum(['confirmed', 'rejected', 'completed']).safeParse(req.body?.status);
  const pv = await prov(req.user.id); if (!s.success || !pv) return res.status(400).json({ error: 'Invalid request' });
  const { rows } = await query(`UPDATE transport_bookings t SET status=$1 FROM transport_routes tr WHERE t.id=$2 AND tr.id=t.route_id AND tr.provider_id=$3 RETURNING t.id`, [s.data, req.params.id, pv.id]);
  rows[0] ? res.json({ ok: true }) : res.status(404).json({ error: 'Booking not found' });
});

r.get('/provider/me', requireAuth('transport_provider'), async (req, res) => {
  const p = (await query('SELECT id,name,phone,status FROM transport_providers WHERE owner_id=$1', [req.user.id])).rows[0];
  if (!p) return res.json({ provider: null });
  const [v, rt] = await Promise.all([query('SELECT id,type,capacity,plate_no,driver_name,is_available FROM vehicles WHERE provider_id=$1', [p.id]), query('SELECT id,origin,destination,fare,est_minutes FROM transport_routes WHERE provider_id=$1', [p.id])]);
  res.json({ provider: p, vehicles: v.rows, routes: rt.rows });
});

export default r;
