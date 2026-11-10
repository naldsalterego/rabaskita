import { Router } from 'express';
import { tx, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
const DEFAULT_POINTS = 10; // fallback when a listing has no tier/override; admins change tiers in point_tiers

r.post('/', requireAuth(), async (req, res) => {
  const token = String(req.body?.token || '');
  try {
    const out = await tx(async (c) => {
      const q = (await c.query('SELECT * FROM qr_codes WHERE token=$1', [token])).rows[0];
      if (!q) return { code: 404, error: 'This QR code is not recognized' };
      if (!q.is_active) return { code: 410, error: 'This QR code has been deactivated' };
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.user.id + q.id]); // blocks double-claims
      const recent = (await c.query(`SELECT 1 FROM checkins WHERE user_id=$1 AND qr_code_id=$2 AND created_at > now() - make_interval(hours => $3)`, [req.user.id, q.id, q.cooldown_hours])).rows[0];
      if (recent) return { code: 429, error: `You already checked in here. Try again after ${q.cooldown_hours} hours.` };
      let pts = q.points_override;
      if (pts == null && q.listing_type === 'destination')
        pts = (await c.query('SELECT t.points FROM destinations d JOIN point_tiers t ON t.id=d.point_tier_id WHERE d.id=$1', [q.listing_id])).rows[0]?.points;
      pts = pts ?? DEFAULT_POINTS;
      const ci = (await c.query('INSERT INTO checkins(user_id,qr_code_id,points_awarded) VALUES($1,$2,$3) RETURNING id', [req.user.id, q.id, pts])).rows[0];
      await c.query(`INSERT INTO points_transactions(user_id,delta,reason,checkin_id) VALUES($1,$2,'check-in',$3)`, [req.user.id, pts, ci.id]);
      return { code: 200, points: pts };
    });
    out.error ? res.status(out.code).json({ error: out.error }) : res.json({ points: out.points });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Check-in failed. Try again.' }); }
});

r.get('/me', requireAuth(), async (req, res) => {
  const bal = await query('SELECT COALESCE(SUM(delta),0)::int AS balance FROM points_transactions WHERE user_id=$1', [req.user.id]);
  const hist = await query('SELECT c.created_at,c.points_awarded FROM checkins c WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ balance: bal.rows[0].balance, history: hist.rows });
});
export default r;
