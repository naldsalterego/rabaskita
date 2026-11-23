import { useEffect, useState } from 'react';
import { BedDouble, Lock, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSyncVersion } from '../../lib/sync.js';
import { localDate } from '../../lib/policy.js';
import AvailabilityCalendar, { gridStart } from '../AvailabilityCalendar.jsx';
import { Badge, btn, btnGhost, inp } from '../ui.jsx';
const REASONS = ['Walk-in or booked offline', 'Booked on another site', 'Maintenance or repairs', 'Personal use', 'Other'];
const longDay = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDay = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Monitor every room by date and close dates (walk-ins, repairs, rooms sold elsewhere) so tourists cannot book them. */
export default function Availability({ businessId }) {
  const [month, setMonth] = useState(localDate().slice(0, 7)), [data, setData] = useState(null), [roomId, setRoomId] = useState(''), [sel, setSel] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), ver = useSyncVersion();
  const [f, setF] = useState({ start: '', lastNight: '', units: 1, reason: REASONS[0] });
  const load = () => api(`/owner/business/${businessId}/availability?from=${gridStart(month)}&days=42`).then(d => { setData(d); setRoomId(r => r || d.rooms[0]?.id || ''); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [businessId, month, ver]); // eslint-disable-line
  if (!data) return <p className="text-sm">{err || 'Loading…'}</p>;
  if (!data.rooms.length) return <p className="text-sm text-ocean/70">Add your rooms first (Rooms tab). They will show up here.</p>;
  const room = data.rooms.find(r => r.id === roomId) || data.rooms[0], today = data.today, u = sel ? room.days[sel] : null;
  const cell = (date) => {
    const x = room.days[date]; if (!x) return null; const used = x.booked + x.blocked;
    const label = [x.booked > 0 && `${x.booked} booked`, x.blocked > 0 && `${x.blocked} closed`].filter(Boolean).join('\n');
    const title = `${x.free} of ${room.quantity} free${x.booked ? `, ${x.booked} booked` : ''}${x.blocked ? `, ${x.blocked} closed` : ''}`;
    return { state: x.free === 0 ? (x.booked === 0 && x.blocked > 0 ? 'blocked' : 'full') : used > 0 ? 'few' : 'free', label, title };
  };
  const pick = (date) => { setSel(date); setF(p => ({ ...p, start: date >= today ? date : '', lastNight: date >= today ? date : '' })); setMsg(''); setErr(''); };
  async function close(e) {
    e.preventDefault(); setBusy(true); setMsg(''); setErr('');
    try { await api(`/owner/business/${businessId}/blocks`, { method: 'POST', body: { roomId: room.id, start: f.start, lastNight: f.lastNight, units: Number(f.units), reason: f.reason } });
      setMsg(`Closed ${f.units} × ${room.name} from ${shortDay(f.start)} to ${shortDay(f.lastNight)}. Tourists can no longer book ${Number(f.units) >= room.quantity ? 'it' : 'those units'} on those nights.`); await load(); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  async function reopen(id) { if (!confirm('Reopen these dates so tourists can book them again?')) return; setErr(''); try { await api(`/owner/blocks/${id}`, { method: 'DELETE' }); setMsg('Dates reopened.'); await load(); } catch (x) { setErr(x.message); } }
  return (<div className="grid gap-5">
    <p className="text-sm text-ocean/70">See every room by date. Tourists see a date crossed out when none of that room is left. Close dates here for walk-ins, repairs or rooms you sold somewhere else. Guests who already booked are not affected.</p>
    <div><p className="mb-2 font-display text-lg">Tonight, {shortDay(today)}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.tonight.map(t => <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><BedDouble size={18} /></span>
        <span><b>{t.name}</b><br /><span className={t.free === 0 ? 'text-red-700' : 'text-ocean/75'}>{t.free} of {t.quantity} free</span>{t.booked > 0 && <span className="text-ocean/60"> · {t.booked} occupied</span>}{t.blocked > 0 && <span className="text-ocean/60"> · {t.blocked} closed</span>}</span></li>)}</ul></div>
    {data.rooms.length > 1 && <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a room">{data.rooms.map(r => <button key={r.id} role="tab" aria-selected={r.id === room.id} onClick={() => { setRoomId(r.id); setSel(''); }} className={`rounded-full border px-4 py-1.5 text-sm ${r.id === room.id ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`}>{r.name} <span className="opacity-70">×{r.quantity}</span></button>)}</div>}
    <AvailabilityCalendar month={month} onMonth={(m) => { setMonth(m); setSel(''); }} today={today} cell={cell} canPick={() => true} onPick={pick} picked={sel ? [sel] : []} legend={['free', 'few', 'full', 'blocked']} />
    {msg && <p role="status" className="rounded-xl bg-teal/10 p-3 text-sm text-teal">{msg}</p>}{err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
    {u && <div className="rounded-2xl border border-line bg-white p-4 text-sm"><p className="font-display text-lg">{longDay(sel)}</p><p className="text-ocean/70">{room.name}: {u.free} of {room.quantity} free</p>
      {u.stays.length === 0 && u.blocks.length === 0 && <p className="mt-2 text-ocean/60">Nobody is booked in and nothing is closed on this night.</p>}
      {u.stays.length > 0 && <ul className="mt-2 grid gap-1">{u.stays.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2"><b>{s.guest}</b> <span className="text-ocean/70">{shortDay(s.check_in)} to {shortDay(s.check_out)} · {s.guests} guest{s.guests === 1 ? '' : 's'}</span><Badge s={s.status} /></li>)}</ul>}
      {u.blocks.length > 0 && <ul className="mt-2 grid gap-1">{u.blocks.map(k => <li key={k.id} className="flex flex-wrap items-center gap-2"><Lock size={14} className="text-ocean/60" /><span>{k.units} closed · {shortDay(k.start)} to {shortDay(k.last_night)}{k.reason && ` · ${k.reason}`}</span><button className="inline-flex items-center gap-1 text-red-700 underline" onClick={() => reopen(k.id)}><Trash2 size={13} />Reopen</button></li>)}</ul>}</div>}
    <form onSubmit={close} className="grid gap-3 rounded-2xl border border-line bg-white p-4">
      <p className="font-display text-lg">Close dates for {room.name}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-xs text-ocean/60">First night<input type="date" required min={today} className={inp} value={f.start} onChange={e => setF({ ...f, start: e.target.value, lastNight: f.lastNight < e.target.value ? e.target.value : f.lastNight })} /></label>
        <label className="grid gap-1 text-xs text-ocean/60">Last night<input type="date" required min={f.start || today} className={inp} value={f.lastNight} onChange={e => setF({ ...f, lastNight: e.target.value })} /></label>
        <label className="grid gap-1 text-xs text-ocean/60">How many rooms<input type="number" required min="1" max={room.quantity} className={inp} value={f.units} onChange={e => setF({ ...f, units: e.target.value })} /></label>
        <label className="grid gap-1 text-xs text-ocean/60">Reason (only you see this)<select className={inp} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>{REASONS.map(r => <option key={r}>{r}</option>)}</select></label></div>
      <div className="flex flex-wrap items-center gap-3"><button disabled={busy} className={`${btn} disabled:opacity-50`}>{busy ? 'Closing…' : 'Close these dates'}</button><span className="text-xs text-ocean/60">Tip: tap a day on the calendar to fill in the dates.</span></div>
    </form>
    <div><p className="mb-2 font-display text-lg">Closed dates coming up</p>
      {data.blocks.length === 0 ? <p className="text-sm text-ocean/60">Nothing is closed.</p> : <ul className="grid gap-2">{data.blocks.map(k => <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm"><span><b>{k.room}</b> × {k.units} · {shortDay(k.start)} to {shortDay(k.last_night)}{k.reason && <span className="text-ocean/65"> · {k.reason}</span>}</span><button onClick={() => reopen(k.id)} className={btnGhost}>Reopen</button></li>)}</ul>}</div>
  </div>);
}
