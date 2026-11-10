// Request handler for the shared demo backend. The storage (Netlify Blobs in production) is injected so it can be tested.
import { createBackend } from '../../client/src/lib/backend.js';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const statusFor = (m) => (/Sign in|Wrong email or password/.test(m) ? 401 : /Forbidden/.test(m) ? 403 : /Not found/.test(m) ? 404 : 400);
export function makeHandler(getStore, env = {}) {
  return async (req) => {
    const url = new URL(req.url), path = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (path === '/ping') return json({ shared: true, adminLocked: !!env.ADMIN_PASSWORD });
    const store = getStore(), photo = path.match(/^\/photos\/([\w-]+(?:\.(?:png|pdf))?)$/);
    if (path === '/sync') return json({ rev: Number(await store.get('rev')) || 0 }); // tiny read so other devices can tell when data changed
    if (photo && req.method === 'GET') { const data = await store.get('photo/' + photo[1], { type: 'arrayBuffer' }); return data ? new Response(data, { headers: { 'Content-Type': photo[1].endsWith('.png') ? 'image/png' : photo[1].endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=31536000, immutable' } }) : new Response('Not found', { status: 404 }); }
    const be = createBackend({
      token: () => token,
      load: () => store.get('db', { type: 'json' }),
      save: async (d) => { const prev = Number(await store.get('rev')) || 0; d.rev = Math.max(Date.now(), prev + 1, (d.rev || 0) + 1); await Promise.all([store.setJSON('db', d), store.set('rev', String(d.rev))]); },
      adminPassword: () => env.ADMIN_PASSWORD || 'demo1234',
      deletePhoto: async (ref) => { const m = String(ref).match(/\/api\/photos\/([\w-]+(?:\.(?:png|pdf))?)$/); if (m) await store.delete('photo/' + m[1]); },
      wipePhotos: async () => { const { blobs } = await store.list({ prefix: 'photo/' }); await Promise.all(blobs.map(b => store.delete(b.key))); },
    });
    try {
      if (path === '/photos' && req.method === 'POST') {
        const user = await be.whoami(); if (!user || !['admin', 'business_owner', 'transport_provider'].includes(user.role)) return json({ error: user ? 'Forbidden' : 'Sign in required' }, user ? 403 : 401);
        const buf = await req.arrayBuffer(); if (!buf.byteLength) return json({ error: 'Empty image' }, 400); if (buf.byteLength > 5.5e6) return json({ error: 'Image is too large' }, 413);
        const id = crypto.randomUUID() + (/png/.test(req.headers.get('content-type') || '') ? '.png' : /pdf/.test(req.headers.get('content-type') || '') ? '.pdf' : ''); await store.set('photo/' + id, buf); return json({ url: '/api/photos/' + id });
      }
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await req.json().catch(() => ({})) : undefined;
      return json(await be.handle(req.method, path + url.search, body));
    } catch (e) { return json({ error: e.message }, statusFor(e.message)); }
  };
}
