import { useEffect, useState } from 'react';
import { BedDouble, Utensils, Mail, Inbox } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSyncVersion } from '../../lib/sync.js';
import { Badge, Empty, btn, btnGhost } from '../ui.jsx';
const dayText = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const timeText = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const DONE = { confirmed: 'accepted', declined: 'declined', cancelled: 'cancelled', completed: 'marked as completed', no_show: 'marked as a no-show' }, TOLD = ['confirmed', 'declined', 'cancelled'];
const LABEL = { pending: 'needs your reply', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled', declined: 'declined', no_show: 'no-show' };
// what the owner can do next: [new status, button text, is it a warning action]
const NEXT = {
  stay: { pending: [['confirmed', 'Accept'], ['declined', 'Decline', 1]], confirmed: [['completed', 'Mark completed'], ['cancelled', 'Cancel booking', 1]] },
  table: { pending: [['confirmed', 'Accept'], ['declined', 'Decline', 1]], confirmed: [['completed', 'Mark completed'], ['no_show', 'No-show', 1], ['cancelled', 'Cancel', 1]] },
};
const isOpen = (r, today, nowIso) => r.status === 'confirmed' && (r.kind === 'stay' ? r.check_out >= today : r.reserved_at >= nowIso);
const FILTERS = [['needs', 'Needs reply', (r) => r.status === 'pending'], ['upcoming', 'Upcoming', (r, t, n) => isOpen(r, t, n)], ['past', 'Past and closed', (r, t, n) => r.status !== 'pending' && !isOpen(r, t, n)], ['all', 'All', () => true]];
export default function Reservations({ businessId, onChanged }) {
  const [rows, setRows] = useState(null), [f, setF] = useState(null), [msg, setMsg] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(''), ver = useSyncVersion();
  const today = new Date().toISOString().slice(0, 10), nowIso = new Date().toISOString();
  const load = () => api(`/owner/business/${businessId}/reservations`).then(setRows).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, [businessId, ver]); // eslint-disable-line
  useEffect(() => { if (rows && f === null) setF(rows.some(r => r.status === 'pending') ? 'needs' : rows.some(r => isOpen(r, today, nowIso)) ? 'upcoming' : 'all'); }, [rows]); // eslint-disable-line
  async function move(r, status, text) {
    const paid = r.kind === 'stay' && r.payment === 'paid' && status === 'cancelled';
    if (['declined', 'cancelled', 'no_show'].includes(status) && !confirm(paid ? `This guest already paid ₱${r.total}. Cancelling does not refund automatically, so you will need to arrange the refund with them directly.\n\nCancel this booking?` : `${text}? The guest will be told.`)) return;
    setBusy(r.id); setMsg(''); setNote('');
    try { await api(`/owner/reservations/${r.kind}/${r.id}`, { method: 'PATCH', body: { status } }); setNote(`${r.guest}'s ${r.kind === 'stay' ? 'booking' : 'table reservation'} was ${DONE[status]}.${TOLD.includes(status) ? ' They have been notified.' : ''} You can find it under “${status === 'confirmed' ? 'Upcoming' : 'Past and closed'}”.`); await load(); onChanged?.(); } catch (e) { setMsg(e.message); }
    setBusy('');
  }
  if (!rows) return <p className="text-sm">{msg || 'Loading…'}</p>;
  const shown = rows.filter(r => (FILTERS.find(x => x[0] === f) || FILTERS[3])[2](r, today, nowIso)).sort((a, b) => (f === 'upcoming' ? (a.check_in || a.reserved_at).localeCompare(b.check_in || b.reserved_at) : String(b.created_at).localeCompare(String(a.created_at))));
  return (<div>
    <p className="mb-3 text-sm text-ocean/70">Guests book on your page. You get an alert here for each new request, and the guest gets one when you reply.</p>
    <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Reservation filters">{FILTERS.map(([k, l, fn]) => { const n = rows.filter(r => fn(r, today, nowIso)).length; return <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${f === k ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white'}`}>{l} <span className={f === k ? 'text-foam/80' : 'text-ocean/50'}>{n}</span></button>; })}</div>
    {note && <p role="status" className="mb-3 rounded-xl bg-teal/10 p-3 text-sm text-teal">{note}</p>}{msg && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{msg}</p>}
    {shown.length === 0 ? <Empty Icon={Inbox}>{rows.length === 0 ? 'No reservations yet. They will show up here as soon as a guest books.' : 'Nothing in this list.'}</Empty> : <ul className="grid gap-3">{shown.map(r => <li key={r.kind + r.id} className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${r.kind === 'stay' ? 'bg-sky' : 'bg-coral'}`}>{r.kind === 'stay' ? <BedDouble size={18} /> : <Utensils size={18} />}</span>
        <div className="text-sm"><p className="font-display text-lg leading-tight">{r.guest}</p>
          {r.kind === 'stay' ? <p>{r.room} · {dayText(r.check_in)} to {dayText(r.check_out)} ({r.nights} night{r.nights === 1 ? '' : 's'}) · {r.guests} guest{r.guests === 1 ? '' : 's'}</p> : <p>Table for {r.party_size} · {timeText(r.reserved_at)}</p>}
          {r.kind === 'stay' && <p className="text-ocean/75">₱{Number(r.total).toLocaleString()} · payment {r.payment === 'paid' ? 'received' : 'not yet received'}</p>}
          {r.email && <a href={`mailto:${r.email}`} className="mt-1 inline-flex items-center gap-1 text-teal underline"><Mail size={13} />{r.email}</a>}</div></div>
        <Badge s={r.status}>{LABEL[r.status] || r.status}</Badge></div>
      {(NEXT[r.kind][r.status] || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{NEXT[r.kind][r.status].map(([st, text, warn]) => <button key={st} disabled={busy === r.id} onClick={() => move(r, st, text)} className={`${warn ? `${btnGhost} text-red-700` : btn} disabled:opacity-50`}>{text}</button>)}</div>}</li>)}</ul>}
  </div>);
}
