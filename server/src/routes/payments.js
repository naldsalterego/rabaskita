import { Router } from 'express';
import crypto from 'node:crypto';
import { tx, query, audit } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
export const SANDBOX = (process.env.PAYMENT_MODE || 'sandbox') === 'sandbox';

// Creates a pending payment inside the caller's transaction. A real gateway (PayMongo, Xendit, etc.)
// plugs in here: call its API and store its reference/QR payload instead of the sandbox reference.
export async function createPayment(c, userId, amount, method = 'qrph') {
  const ref = (SANDBOX ? 'SBX-' : 'PAY-') + crypto.randomBytes(6).toString('hex').toUpperCase();
  const { rows } = await c.query('INSERT INTO payments(user_id,amount,method,provider_ref) VALUES($1,$2,$3,$4) RETURNING id,provider_ref,amount,status', [userId, amount, method, ref]);
  return rows[0];
}
export async function markPaid(reference) {
  return tx(async (c) => {
    const p = (await c.query(`UPDATE payments SET status='paid', paid_at=now() WHERE provider_ref=$1 AND status='pending' RETURNING id`, [reference])).rows[0];
    if (!p) return false; // unknown or already processed: idempotent
    await c.query(`UPDATE accommodation_bookings SET status='confirmed' WHERE payment_id=$1 AND status='pending'`, [p.id]);
    return true;
  });
}
// Mounted in index.js BEFORE express.json so the signature covers the exact raw bytes.
export async function webhook(req, res) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook secret not configured' });
  const want = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  const got = String(req.headers['x-signature'] || '');
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return res.status(401).json({ error: 'Bad signature' });
  const evt = JSON.parse(req.body.toString());
  if (evt.status === 'paid') await markPaid(String(evt.reference));
  res.json({ received: true });
}
r.get('/:id', requireAuth(), async (req, res) => { // digital receipt
  const { rows } = await query('SELECT id,amount,method,provider_ref,status,paid_at,created_at FROM payments WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Payment not found' });
});
// Demo only. Disabled unless PAYMENT_MODE=sandbox; never counts as real money.
r.post('/:id/sandbox-confirm', requireAuth(), async (req, res) => {
  if (!SANDBOX) return res.status(404).end();
  const p = (await query('SELECT provider_ref FROM payments WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])).rows[0];
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  res.json({ paid: await markPaid(p.provider_ref), sandbox: true });
});
export default r;
