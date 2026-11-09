import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const query = (text, params) => pool.query(text, params); // always parameterized
export async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
export const audit = (actor, action, entity, id, meta) =>
  query('INSERT INTO audit_logs(actor_id,action,entity,entity_id,meta) VALUES($1,$2,$3,$4,$5)', [actor, action, entity, String(id ?? ''), meta ?? null]);
