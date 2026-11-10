// Local mode: the backend runs in the browser. Shared mode: a Netlify function stores data for every visitor.
// mode.checked says what was found: shared | no-function | unreachable | shared-unreachable | dev | server
export const mode = { shared: false, adminLocked: false, checked: '' };
export async function detectMode() {
  if (import.meta.env.VITE_API_URL) { mode.checked = 'server'; return mode; }
  if (import.meta.env.DEV) { mode.checked = 'dev'; return mode; }
  for (const ms of [4000, 7000, 10000]) { // slow phones and cold starts get several tries before we give up on the function
    try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), ms), r = await fetch('/api/ping', { signal: c.signal, cache: 'no-store' }); clearTimeout(t);
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const j = await r.json(); if (j.shared) { Object.assign(mode, { shared: true, adminLocked: !!j.adminLocked, checked: 'shared' }); try { localStorage.setItem('cat_shared', '1'); } catch { /* ignore */ } return mode; } }
      if (r.ok || r.status === 404) { try { localStorage.removeItem('cat_shared'); } catch { /* ignore */ } mode.checked = 'no-function'; return mode; } // the site answered, but there is no function behind /api
    } catch { /* slow or offline: try again */ }
  }
  let was = false; try { was = localStorage.getItem('cat_shared') === '1'; } catch { /* ignore */ }
  if (was) { mode.shared = true; mode.checked = 'shared-unreachable'; } else mode.checked = 'unreachable'; // never silently drop a known shared site into private mode
  return mode;
}
