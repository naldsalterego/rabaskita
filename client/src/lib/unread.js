// The number on the Alerts bell. It refreshes whenever alerts are read, when you move to another page, when you come back
// to the tab, and every 30 seconds, so it never keeps showing an old count.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api.js';
import { useSyncVersion } from './sync.js';
const subs = new Set();
/** Call after anything that changes what is read or unread, so the bell updates straight away. */
export const refreshUnread = () => subs.forEach(f => f());
export function useUnread() {
  const [n, setN] = useState(0), { pathname } = useLocation(), ver = useSyncVersion();
  useEffect(() => {
    let on = true; const get = () => api('/notifications').then(d => { if (on) setN(d.unread || 0); }).catch(() => {});
    const seen = () => { if (!document.hidden) get(); }, timer = setInterval(seen, 30000);
    get(); subs.add(get); document.addEventListener('visibilitychange', seen);
    return () => { on = false; subs.delete(get); clearInterval(timer); document.removeEventListener('visibilitychange', seen); };
  }, [pathname, ver]);
  return n;
}
