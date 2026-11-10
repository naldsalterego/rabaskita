import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { query, audit } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.use(requireAuth('admin'));

r.get('/stats', async (_q, res) => {
  const n = async (sql) => (await query(sql)).rows[0].n;
  res.json({
    tourists: await n(`SELECT count(*)::int n FROM users WHERE role='tourist'`),
    businesses: await n(`SELECT count(*)::int n FROM businesses WHERE status='approved'`),
    pendingBusinesses: await n(`SELECT count(*)::int n FROM businesses WHERE status='pending'`),
    destinations: await n('SELECT count(*)::int n FROM destinations'),
    pointsIssued: await n('SELECT COALESCE(SUM(delta) FILTER (WHERE delta>0),0)::int n FROM points_transactions'),
    redemptions: await n('SELECT count(*)::int n FROM reward_redemptions'),
  });
});
r.get('/businesses/pending', async (_q, res) => res.json((await query(`SELECT b.*,u.email AS owner_email FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.status='pending' ORDER BY b.created_at`)).rows));
r.patch('/businesses/:id/status', async (req, res) => {
  const s = z.enum(['approved', 'rejected', 'suspended']).safeParse(req.body?.status);
  if (!s.success) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query('UPDATE businesses SET status=$1 WHERE id=$2 RETURNING id', [s.data, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Business not found' });
  await audit(req.user.id, `business.${s.data}`, 'businesses', req.params.id);
  res.json({ ok: true });
});
const dest = z.object({ name: z.string().min(2), municipalityId: z.number().int(), description: z.string().optional(), lat: z.number().min(-90).max(90).nullish(), lng: z.number().min(-180).max(180).nullish(), pointTierId: z.number().int().nullish(), travelMinutes: z.number().int().nullish(), isPublished: z.boolean().default(false) });
r.post('/destinations', async (req, res) => {
  const p = dest.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check the destination details' });
  const d = p.data;
  const { rows } = await query('INSERT INTO destinations(name,municipality_id,description,lat,lng,point_tier_id,travel_minutes_from_virac,is_published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [d.name, d.municipalityId, d.description, d.lat, d.lng, d.pointTierId, d.travelMinutes, d.isPublished]);
  await audit(req.user.id, 'destination.create', 'destinations', rows[0].id);
  res.status(201).json(rows[0]);
});
r.put('/point-tiers/:id', async (req, res) => {
  const pts = Number(req.body?.points);
  if (!Number.isInteger(pts) || pts < 0) return res.status(400).json({ error: 'Points must be a whole number' });
  await query('UPDATE point_tiers SET points=$1 WHERE id=$2', [pts, req.params.id]);
  await audit(req.user.id, 'tier.update', 'point_tiers', req.params.id, { pts });
  res.json({ ok: true });
});
r.post('/qr', async (req, res) => {
  const p = z.object({ listingType: z.enum(['destination', 'accommodation', 'restaurant', 'business']), listingId: z.string().uuid(), pointsOverride: z.number().int().min(0).nullish(), cooldownHours: z.number().int().min(1).default(24) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid QR request' });
  const { listingType, listingId, pointsOverride, cooldownHours } = p.data;
  const { rows } = await query('INSERT INTO qr_codes(listing_type,listing_id,points_override,cooldown_hours) VALUES($1,$2,$3,$4) RETURNING id', [listingType, listingId, pointsOverride ?? null, cooldownHours]);
  res.status(201).json(rows[0]);
});
r.get('/qr/:id.png', async (req, res) => {
  const q = (await query('SELECT token FROM qr_codes WHERE id=$1', [req.params.id])).rows[0];
  if (!q) return res.status(404).end();
  res.type('png').send(await QRCode.toBuffer(`${process.env.CLIENT_ORIGIN}/checkin/${q.token}`, { width: 512, margin: 2 }));
});
r.patch('/qr/:id/deactivate', async (req, res) => {
  await query('UPDATE qr_codes SET is_active=false WHERE id=$1', [req.params.id]);
  await audit(req.user.id, 'qr.deactivate', 'qr_codes', req.params.id);
  res.json({ ok: true });
});

r.get('/providers/pending', async (_q, res) => res.json((await query(`SELECT p.id,p.name,p.phone,u.email FROM transport_providers p JOIN users u ON u.id=p.owner_id WHERE p.status='pending' ORDER BY p.id`)).rows));
r.patch('/providers/:id/status', async (req, res) => {
  const s = z.enum(['approved', 'rejected', 'suspended']).safeParse(req.body?.status);
  if (!s.success) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query('UPDATE transport_providers SET status=$1 WHERE id=$2 RETURNING id', [s.data, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Provider not found' });
  await audit(req.user.id, `provider.${s.data}`, 'transport_providers', req.params.id);
  res.json({ ok: true });
});
r.get('/point-tiers', async (_q, res) => res.json((await query('SELECT id,name,points FROM point_tiers ORDER BY points')).rows));
r.post('/rewards', async (req, res) => {
  const p = z.object({ name: z.string().min(2), description: z.string().optional(), pointsCost: z.number().int().min(1), stock: z.number().int().min(0).nullish() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check the reward details' });
  const d = p.data; const { rows } = await query('INSERT INTO rewards(name,description,points_cost,stock) VALUES($1,$2,$3,$4) RETURNING id', [d.name, d.description, d.pointsCost, d.stock ?? null]);
  await audit(req.user.id, 'reward.create', 'rewards', rows[0].id); res.status(201).json(rows[0]);
});
r.get('/qr', async (_q, res) => res.json((await query(`SELECT q.id,q.listing_type,q.listing_id,q.is_active,q.cooldown_hours,q.points_override,COALESCE(d.name,b.name) AS name FROM qr_codes q LEFT JOIN destinations d ON q.listing_type='destination' AND d.id=q.listing_id LEFT JOIN businesses b ON q.listing_type='business' AND b.id=q.listing_id ORDER BY q.created_at DESC LIMIT 200`)).rows));
r.get('/users', async (_q, res) => res.json((await query('SELECT id,email,full_name,role,is_active,created_at FROM users ORDER BY created_at DESC LIMIT 200')).rows));
r.patch('/users/:id/active', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });
  await query('UPDATE users SET is_active=$1 WHERE id=$2', [!!req.body?.active, req.params.id]);
  await audit(req.user.id, 'user.active', 'users', req.params.id, { active: !!req.body?.active }); res.json({ ok: true });
});
r.get('/reports', async (_q, res) => {
  const [checkins, bookings, top, pays] = await Promise.all([
    query(`SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS month,count(*)::int AS n FROM checkins GROUP BY 1 ORDER BY 1 DESC LIMIT 12`),
    query(`SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS month,count(*)::int AS n FROM (SELECT created_at FROM accommodation_bookings UNION ALL SELECT created_at FROM transport_bookings) x GROUP BY 1 ORDER BY 1 DESC LIMIT 12`),
    query(`SELECT d.name,count(c.id)::int AS visits FROM checkins c JOIN qr_codes q ON q.id=c.qr_code_id AND q.listing_type='destination' JOIN destinations d ON d.id=q.listing_id GROUP BY d.name ORDER BY visits DESC LIMIT 10`),
    query(`SELECT status,count(*)::int AS n,COALESCE(sum(amount),0) AS total FROM payments GROUP BY status`)]);
  res.json({ checkinsByMonth: checkins.rows, bookingsByMonth: bookings.rows, topDestinations: top.rows, payments: pays.rows });
});
r.get('/audit', async (_q, res) => res.json((await query('SELECT a.created_at,a.action,a.entity,a.entity_id,u.email AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100')).rows));


r.get('/destinations', async (_q, res) => res.json((await query('SELECT d.id,d.name,d.is_published,d.lat,d.lng,m.name AS municipality FROM destinations d JOIN municipalities m ON m.id=d.municipality_id ORDER BY d.name')).rows));
r.put('/destinations/:id', async (req, res) => {
  const p = dest.partial().safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Check the destination details' });
  const d = p.data;
  const { rows } = await query('UPDATE destinations SET name=COALESCE($1,name),municipality_id=COALESCE($2,municipality_id),description=COALESCE($3,description),lat=COALESCE($4,lat),lng=COALESCE($5,lng),point_tier_id=COALESCE($6,point_tier_id),travel_minutes_from_virac=COALESCE($7,travel_minutes_from_virac),is_published=COALESCE($8,is_published) WHERE id=$9 RETURNING id', [d.name, d.municipalityId, d.description, d.lat, d.lng, d.pointTierId, d.travelMinutes, d.isPublished, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Destination not found' });
  await audit(req.user.id, 'destination.update', 'destinations', req.params.id); res.json({ ok: true });
});

export default r;
