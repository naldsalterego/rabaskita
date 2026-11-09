import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { sign } from '../middleware/auth.js';
const r = Router();
const reg = z.object({ email: z.string().email(), password: z.string().min(8), fullName: z.string().min(2),
  role: z.enum(['tourist', 'business_owner', 'transport_provider']).default('tourist') }); // admin is never self-assigned
r.post('/register', async (req, res) => {
  const p = reg.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Check your details and try again' });
  const { email, password, fullName, role } = p.data;
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query('INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) RETURNING id,role,full_name', [email.toLowerCase(), hash, fullName, role]);
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Email already registered' : 'Server error' }); }
});
r.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const { rows } = await query('SELECT * FROM users WHERE email=$1 AND is_active', [String(email).toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(String(password), rows[0].password_hash))) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(rows[0]), user: { id: rows[0].id, role: rows[0].role, full_name: rows[0].full_name } });
});
export default r;
