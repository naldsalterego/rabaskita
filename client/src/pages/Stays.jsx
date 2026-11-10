import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Users, MapPin, Phone, Clock, BedDouble, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import Cover from '../components/Cover.jsx';
import RouteMap from '../components/RouteMap.jsx';
import Reviews from '../components/Reviews.jsx';
import { PapersPublic, PaperChip } from '../components/Docs.jsx';
import Album, { albumOf, CountBadge } from '../components/Album.jsx';
import { inp, btn } from '../components/ui.jsx';
import { Banner, Fact, Section, hoursText, Err, useOne } from './Listings.jsx';
const today = () => new Date().toISOString().slice(0, 10);
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

function Field({ Icon, label, children }) { return <label className="flex flex-1 min-w-[10rem] items-center gap-3 rounded-2xl px-4 py-2 hover:bg-foam"><Icon size={18} className="text-teal" /><span className="grid text-xs text-ocean/60">{label}{children}</span></label>; }
const bare = 'bg-transparent text-base font-medium text-ocean outline-none';

export default function Stays() {
  const [list, setList] = useState(null), [f, setF] = useState({ in: '', out: '', g: 2 }), [type, setType] = useState('');
  const ver = useSyncVersion();
  useEffect(() => { api('/accommodations').then(setList).catch(() => setList([])); }, [ver]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), types = [...new Set((list || []).map(a => a.type))];
  const chip = (on) => `shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm border ${on ? 'bg-ocean text-foam border-ocean' : 'bg-white border-line hover:border-teal'}`;
  const shown = (list || []).filter(a => !type || a.type === type);
  return (<main className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="font-display text-4xl md:text-5xl">Where to stay</h1><p className="mt-1 text-ocean/75">Pick your dates, then choose a place. Availability is checked live.</p>
    <div className="mt-5 flex flex-wrap items-center gap-1 rounded-3xl border border-line bg-white p-2">
      <Field Icon={CalendarDays} label="Check-in"><input type="date" min={today()} className={bare} value={f.in} onChange={e => setF({ ...f, in: e.target.value, out: f.out > e.target.value ? f.out : '' })} /></Field>
      <Field Icon={CalendarDays} label="Check-out"><input type="date" min={f.in || today()} className={bare} value={f.out} onChange={e => setF({ ...f, out: e.target.value })} /></Field>
      <Field Icon={Users} label="Guests"><input type="number" min="1" className={`${bare} w-20`} value={f.g} onChange={e => setF({ ...f, g: e.target.value })} /></Field></div>
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"><button className={chip(!type)} onClick={() => setType('')}>All</button>{types.map(t => <button key={t} className={chip(type === t)} onClick={() => setType(t)}>{cap(t)}</button>)}</div>
    {list === null ? <p className="mt-6">Loading…</p> : shown.length === 0 ? <p className="mt-6">No accommodations listed yet.</p> :
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map(a => <Link key={a.accommodation_id} to={`/accommodations/${a.accommodation_id}${qs ? `?${qs}` : ''}`} className="lift block overflow-hidden rounded-3xl border border-line bg-white">
        <Cover name={a.name} photo={a.cover_photo || a.photos?.[0]} className="h-44"><CountBadge n={albumOf(a).length} /><span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ocean">{cap(a.type)}</span>{a.from_price != null && <span className="absolute bottom-3 right-3 rounded-full bg-sand px-3 py-1 text-sm font-semibold text-ocean">from ₱{a.from_price.toLocaleString()}/night</span>}</Cover>
        <div className="p-4"><h2 className="font-display text-xl">{a.name}</h2><p className="flex items-center gap-1 text-sm text-teal"><MapPin size={14} />{a.municipality}</p>{a.papers_status === 'complete' && <PaperChip />}
          {a.amenities?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{a.amenities.slice(0, 3).map(x => <span key={x} className="rounded-full bg-foam px-2.5 py-0.5 text-xs">{x}</span>)}</div>}</div></Link>)}</div>}</main>);
}

export function StayDetail() {
  const { id } = useParams(), [sp] = useSearchParams(), [a, err] = useOne(`/accommodations/${id}`);
  const [d, setD] = useState({ ci: sp.get('in') || '', co: sp.get('out') || '', g: Number(sp.get('g')) || 2 }), [avail, setAvail] = useState(null), [msg, setMsg] = useState(null), [tick, setTick] = useState(0);
  const valid = d.ci && d.co && d.co > d.ci, nights = valid ? nightsBetween(d.ci, d.co) : 0;
  const ver = useSyncVersion();
  useEffect(() => { if (!valid) return setAvail(null); api(`/bookings/availability?accommodationId=${id}&checkIn=${d.ci}&checkOut=${d.co}&guests=1`).then(r => setAvail(Object.fromEntries(r.map(x => [x.id, x.available])))).catch(() => setAvail(null)); }, [id, d.ci, d.co, tick, ver]);
  async function book(roomId) {
    try { await api('/bookings/stay', { method: 'POST', body: { roomId, checkIn: d.ci, checkOut: d.co, guests: Number(d.g) } }); setMsg({ ok: true }); setTick(t => t + 1); }
    catch (e) { setMsg({ ok: false, text: e.message.includes('Sign in') ? 'Please sign in to book.' : e.message }); }
  }
  if (err) return <Err m={err} />; if (!a) return <Err m="Loading…" />;
  const state = (r) => !valid ? 'Choose dates' : r.capacity < d.g ? `Sleeps ${r.capacity} max` : avail && !avail[r.id] ? 'Not available' : null;
  return (<main><Banner name={a.name} photo={a.cover_photo || a.photos?.[0]} sub={`${a.municipality} · ${cap(a.type)}`} badge={a.from_price != null && `from ₱${a.from_price.toLocaleString()}/night`} />
    <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-3"><div className="lg:col-span-2">
      <p className="text-lg leading-relaxed">{a.description}</p>
      {a.amenities?.length > 0 && <Section title="Amenities"><div className="flex flex-wrap gap-2">{a.amenities.map(x => <span key={x} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-sm"><Check size={14} className="text-teal" />{x}</span>)}</div></Section>}
      {albumOf(a).length > 0 && <Section title="Photo album"><Album photos={albumOf(a)} name={a.name} /></Section>}<Section title="Rooms">{a.rooms.length === 0 ? <p>No rooms listed yet.</p> : <div className="grid gap-3">{a.rooms.map(r => { const blocked = state(r); return (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal/10 text-teal"><BedDouble size={20} /></span><div><p className="font-display text-lg">{r.name}</p><p className="text-sm text-ocean/70">Sleeps {r.capacity} · ₱{r.price_per_night.toLocaleString()}/night{nights > 0 && ` · ₱${(r.price_per_night * nights).toLocaleString()} for ${nights} night${nights > 1 ? 's' : ''}`}</p></div></div>
          <button disabled={!!blocked} onClick={() => book(r.id)} className={`${btn} disabled:opacity-40`}>{blocked || 'Book this room'}</button></div>); })}</div>}
        {msg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-teal/10' : 'bg-red-50 text-red-800'}`}>{msg.ok ? <>Booked! <Link className="underline" to="/bookings">Open My bookings</Link> to pay and confirm it.</> : msg.text}</p>}</Section>
      <Section title="Business papers"><PapersPublic papers={a.papers} /></Section><Section title="Find us"><RouteMap lat={a.lat} lng={a.lng} name={a.name} /></Section><Reviews type="accommodation" id={id} /></div>
      <aside><div className="lg:sticky lg:top-24 grid gap-4 rounded-3xl border border-line bg-white p-5"><p className="font-display text-xl">Your stay</p>
        <label className="grid gap-1 text-xs text-ocean/60">Check-in<input type="date" min={today()} className={inp} value={d.ci} onChange={e => setD({ ...d, ci: e.target.value, co: d.co > e.target.value ? d.co : '' })} /></label>
        <label className="grid gap-1 text-xs text-ocean/60">Check-out<input type="date" min={d.ci || today()} className={inp} value={d.co} onChange={e => setD({ ...d, co: e.target.value })} /></label>
        <label className="grid gap-1 text-xs text-ocean/60">Guests<input type="number" min="1" className={inp} value={d.g} onChange={e => setD({ ...d, g: e.target.value })} /></label>
        <hr className="border-line" /><Fact Icon={MapPin} label="Address" value={a.address} /><Fact Icon={Phone} label="Phone" value={a.phone} /><Fact Icon={Clock} label="Hours" value={hoursText(a.hours)} /></div></aside></div></main>);
}
