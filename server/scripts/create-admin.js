// Usage: node --env-file=.env scripts/create-admin.js you@example.com "Full Name" "a-strong-password"
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';
const [email, name, pw] = process.argv.slice(2);
if (!email || !name || !pw || pw.length < 12) { console.error('Usage: create-admin.js <email> <name> <password of 12+ characters>'); process.exit(1); }
await query(`INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,'admin') ON CONFLICT (email) DO UPDATE SET role='admin'`, [email.toLowerCase(), await bcrypt.hash(pw, 12), name]);
console.log('Admin ready:', email); await pool.end();
