import { Router } from 'express';
import crypto from 'node:crypto';
import { tx, query, audit } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.get('/', async (_q, res) => res.json((await query('SELECT id,name,description,points_cost,stock FROM rewards WHERE is_active ORDER BY points_cost')).rows));
r.get('/leaderboard', async (_q, res) => res.json((await query(
  `SELECT u.full_name, SUM(p.delta)::int AS points FROM points_transactions p JOIN users u ON u.id=p.user_id WHERE p.checkin_id IS NOT NULL
   GROUP BY u.id ORDER BY points DESC LIMIT 20`)).rows)); // verified (check-in) points only

r.post('/:id/redeem', requireAuth(), async (req, res) => {
  try {
    const out = await tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.user.id]);
      const rw = (await c.query('SELECT * FROM rewards WHERE id=$1 AND is_active FOR UPDATE', [req.params.id])).rows[0];
      if (!rw) return { code: 404, error: 'Reward not available' };
      if (rw.stock !== null && rw.stock < 1) return { code: 409, error: 'This reward is out of stock' };
      const bal = (await c.query('SELECT COALESCE(SUM(delta),0)::int AS b FROM points_transactions WHERE user_id=$1', [req.user.id])).rows[0].b;
      if (bal < rw.points_cost) return { code: 402, error: `You need ${rw.points_cost - bal} more points` };
      const claim = crypto.randomBytes(5).toString('hex').toUpperCase();
      const rd = (await c.query('INSERT INTO reward_redemptions(user_id,reward_id,claim_code) VALUES($1,$2,$3) RETURNING id', [req.user.id, rw.id, claim])).rows[0];
      await c.query(`INSERT INTO points_transactions(user_id,delta,reason,redemption_id) VALUES($1,$2,'redeemed: '||$3,$4)`, [req.user.id, -rw.points_cost, rw.name, rd.id]);
      if (rw.stock !== null) await c.query('UPDATE rewards SET stock=stock-1 WHERE id=$1', [rw.id]);
      return { code: 200, claim };
    });
    out.error ? res.status(out.code).json({ error: out.error }) : res.json({ claimCode: out.claim });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Redemption failed' }); }
});

// Tourism office staff (admin) validates a claim code; single-use.
r.post('/claim', requireAuth('admin'), async (req, res) => {
  const { rows } = await query(`UPDATE reward_redemptions SET claimed_at=now(), claimed_by=$2 WHERE claim_code=$1 AND claimed_at IS NULL RETURNING id`, [String(req.body?.code || '').toUpperCase(), req.user.id]);
  if (!rows[0]) return res.status(409).json({ error: 'Code is invalid or already claimed' });
  await audit(req.user.id, 'reward.claim', 'reward_redemptions', rows[0].id);
  res.json({ ok: true });
});
export default r;
