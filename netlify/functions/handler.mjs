// Request handler for the shared demo backend. The storage (Netlify Blobs in production) is injected so it can be tested.
import { createBackend } from '../../client/src/lib/backend.js';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const statusFor = (m) => (/Sign in|Wrong email or password/.test(m) ? 401 : /Forbidden/.test(m) ? 403 : /Not found/.test(m) ? 404 : /system is busy/.test(m) ? 503 : 400);
// The whole database is one document, and every request reads it, changes it and writes it back. Two requests at the same moment would
// each start from the same copy, and the second write would silently erase the first (two guests "booking" the last room, lost messages...).
// So every write is conditional: it only succeeds if nobody saved since this request read the data. If somebody did, the request is
// simply run again from the fresh data, where its checks (is the room still free?) see the other person's change.
class Conflict extends Error {}
const MAX_TRIES = 8;
// Optional email alerts (bookings, reservations). Off unless RESEND_API_KEY and NOTIFY_FROM are set in Netlify. Demo accounts (@demo.test) never get mail.
export const makeMailer = (env) => (env.RESEND_API_KEY && env.NOTIFY_FROM ? async ({ to, subject, text }) => {
  if (/@demo\.test$/i.test(to)) return;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.NOTIFY_FROM, to: [to], subject, text }) });
  if (!r.ok) console.error('Email could not be sent:', r.status);
} : undefined);
export function makeHandler(getStore, env = {}, mailer = makeMailer(env)) {
  return async (req) => {
    const url = new URL(req.url), path = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (path === '/ping') return json({ shared: true, adminLocked: !!env.ADMIN_PASSWORD });
    const store = getStore(), photo = path.match(/^\/photos\/([\w-]+(?:\.(?:png|pdf))?)$/);
    if (path === '/sync') return json({ rev: Number(await store.get('rev')) || 0 }); // tiny read so other devices can tell when data changed
    if (photo && req.method === 'GET') { const data = await store.get('photo/' + photo[1], { type: 'arrayBuffer' }); return data ? new Response(data, { headers: { 'Content-Type': photo[1].endsWith('.png') ? 'image/png' : photo[1].endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=31536000, immutable' } }) : new Response('Not found', { status: 404 }); }
    // One attempt = one fresh copy of the data. Anything with an outside effect (email, deleting photos) waits in a queue and is only
    // done after the write went through, so an attempt that has to be repeated never sends an email twice.
    const open = () => {
      let etag; const outbox = [], photoDeletes = []; let wipe = false;
      const be = createBackend({
        token: () => token,
        load: async () => { const r = await store.getWithMetadata('db', { type: 'json' }); etag = r?.etag; return r?.data ?? null; },
        save: async (d) => {
          d.rev = Math.max(Date.now(), (d.rev || 0) + 1);
          const w = await store.setJSON('db', d, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
          if (!w.modified) throw new Conflict('Someone else saved at the same moment.');
          etag = w.etag; await store.set('rev', String(d.rev));
        },
        adminPassword: () => env.ADMIN_PASSWORD || 'demo1234',
        email: mailer ? async (m) => { outbox.push(m); } : undefined, siteUrl: () => url.origin,
        deletePhoto: async (ref) => { photoDeletes.push(ref); },
        wipePhotos: async () => { wipe = true; },
      });
      const flush = () => Promise.allSettled([
        ...outbox.map(m => mailer(m)),
        ...photoDeletes.map(async (ref) => { const m = String(ref).match(/\/api\/photos\/([\w-]+(?:\.(?:png|pdf))?)$/); if (m) await store.delete('photo/' + m[1]); }),
        wipe && (async () => { const { blobs } = await store.list({ prefix: 'photo/' }); await Promise.all(blobs.map(b => store.delete(b.key))); })(),
      ].filter(Boolean));
      return { be, flush };
    };
    try {
      if (path === '/photos' && req.method === 'POST') {
        const { be } = open(); const user = await be.whoami(); if (!user || !['admin', 'business_owner', 'transport_provider'].includes(user.role)) return json({ error: user ? 'Forbidden' : 'Sign in required' }, user ? 403 : 401);
        if (/pdf/.test(req.headers.get('content-type') || '') && user.role !== 'admin') return json({ error: 'Forbidden. Only the tourism office can upload papers.' }, 403);
        const buf = await req.arrayBuffer(); if (!buf.byteLength) return json({ error: 'Empty image' }, 400); if (buf.byteLength > 5.5e6) return json({ error: 'Image is too large' }, 413);
        const id = crypto.randomUUID() + (/png/.test(req.headers.get('content-type') || '') ? '.png' : /pdf/.test(req.headers.get('content-type') || '') ? '.pdf' : ''); await store.set('photo/' + id, buf); return json({ url: '/api/photos/' + id });
      }
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await req.json().catch(() => ({})) : undefined;
      for (let tries = 1; ; tries++) {
        const { be, flush } = open();
        try { const out = await be.handle(req.method, path + url.search, body); await flush(); return json(out); }
        catch (e) {
          if (!(e instanceof Conflict)) throw e;
          if (tries >= MAX_TRIES) throw new Error('The system is busy right now. Please try again in a moment.');
          await new Promise(r => setTimeout(r, Math.random() * 25 * tries)); // a short random pause so the competing requests do not collide again in lockstep
        }
      }
    } catch (e) { return json({ error: e.message }, statusFor(e.message)); }
  };
}
