import { Link, useNavigate } from 'react-router-dom';
import { Bell, CalendarCheck, Utensils, BedDouble } from 'lucide-react';
import { api } from '../lib/api.js';
import { PageHeader, Empty, useLoad, btnGhost } from '../components/ui.jsx';
const ICON = { booking: BedDouble, reservation: Utensils };
export default function Notifications() {
  const [d, reload, err] = useLoad(() => api('/notifications')), go = useNavigate();
  const read = async (id) => { await api('/notifications/read', { method: 'POST', body: id ? { id } : {} }).catch(() => {}); reload(); };
  if (err && !d) return <main className="mx-auto max-w-3xl px-4 py-10"><Empty>{err.includes('Sign in') ? <>Please <Link className="underline" to="/login">sign in</Link> to see your alerts.</> : err}</Empty></main>;
  if (!d) return <p className="p-8">Loading…</p>;
  return (<main className="mx-auto max-w-3xl px-4 py-6"><PageHeader title="Alerts" sub="Bookings, reservations and replies about them." />
    <div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm text-ocean/70">{d.unread > 0 ? `${d.unread} new` : 'You are all caught up.'}</p>{d.unread > 0 && <button className={btnGhost} onClick={() => read()}>Mark all as read</button>}</div>
    {d.items.length === 0 ? <div className="mt-4"><Empty Icon={Bell}>No alerts yet. When someone books or replies, you will see it here.</Empty></div> : <ul className="mt-4 grid gap-3">{d.items.map(n => { const I = ICON[n.type] || CalendarCheck; return <li key={n.id}><button onClick={async () => { if (!n.read) await read(n.id); if (n.link) go(n.link); }} className={`flex w-full items-start gap-4 rounded-3xl border p-4 text-left ${n.read ? 'border-line bg-white' : 'border-teal/40 bg-teal/5'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${n.read ? 'bg-ocean/40' : 'bg-teal'}`}><I size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block font-display text-lg leading-tight">{n.title}</span>{n.body && <span className="mt-0.5 block text-sm text-ocean/75">{n.body}</span>}<span className="mt-1 block text-xs text-ocean/55">{new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></span>{!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-coral" aria-label="Unread" />}</button></li>; })}</ul>}
  </main>);
}
