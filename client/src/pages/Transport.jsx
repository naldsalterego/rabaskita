import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bike, Car, Bus, Truck, Users, Plane, Ship, ArrowRight, CalendarClock, Phone, UserRound, KeyRound, Check, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import Cover from '../components/Cover.jsx';
import DestMap from '../components/DestMap.jsx';
import Album, { albumOf, CountBadge } from '../components/Album.jsx';
import { Empty, btn, inp } from '../components/ui.jsx';
import { Photo } from '../components/Photo.jsx';
import { PapersPublic, PaperChip } from '../components/Docs.jsx';
import { Banner, Fact, Section, Err, useOne } from './Listings.jsx';
const ICON = { motorcycle: Bike, tricycle: Bike, car: Car, van: Bus, multicab: Truck, other: Car };
const TYPES = ['motorcycle', 'tricycle', 'car', 'van', 'multicab'];
const peso = (n) => `₱${Number(n).toLocaleString()}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const cheapest = (v) => Math.min(...[v.rent_self, v.rent_driver].filter(x => x != null));
const chip = (on) => `shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`;

export default function Transport() {
  const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') === 'rides' ? 'rides' : 'rent';
  return (<main className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="font-display text-4xl md:text-5xl">Rent a ride</h1><p className="mt-1 text-ocean/75">Pick a vehicle, choose where you're going, and rent it with a driver or drive it yourself.</p>
    <div className="mt-5 flex gap-2"><button className={chip(tab === 'rent')} onClick={() => setSp({})}>Rent a vehicle</button><button className={chip(tab === 'rides')} onClick={() => setSp({ tab: 'rides' })}>Airport and port rides</button></div>
    {tab === 'rent' ? <Rent /> : <Rides />}</main>);
}

function Rent() {
  const [list, setList] = useState(null), [type, setType] = useState(''), [mode, setMode] = useState('');
  const ver = useSyncVersion();
  useEffect(() => { const p = new URLSearchParams(); if (type) p.set('type', type); if (mode) p.set('mode', mode); api(`/rentals/vehicles?${p}`).then(setList).catch(() => setList([])); }, [type, mode, ver]);
  const row = 'mt-3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap';
  return (<>
    <div className={row}><button className={chip(!type)} onClick={() => setType('')}>All vehicles</button>{TYPES.map(t => <button key={t} className={chip(type === t)} onClick={() => setType(t)}>{cap(t)}</button>)}</div>
    <div className={row}>{[['', 'Any option'], ['driver', 'With driver'], ['self', 'Self-drive']].map(([v, l]) => <button key={v} className={chip(mode === v)} onClick={() => setMode(v)}>{l}</button>)}</div>
    {list === null ? <p className="mt-6">Loading…</p> : list.length === 0 ? <div className="mt-6"><Empty Icon={Car}>No vehicles match. Try another filter.</Empty></div> :
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map(v => { const I = ICON[v.type] || Car; return (<Link key={v.id} to={`/transportation/${v.id}`} className="lift block overflow-hidden rounded-3xl border border-line bg-white">
        <Cover name={v.name} photo={v.cover_photo || v.photos?.[0]} className="h-44"><CountBadge n={albumOf(v).length} /><span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ocean">{cap(v.type)}</span>{!albumOf(v).length && <I size={52} strokeWidth={1.4} className="absolute bottom-3 left-4 text-white/90" />}<span className="absolute bottom-3 right-3 rounded-full bg-sun px-3 py-1 text-sm font-bold text-ocean">from {peso(cheapest(v))}/day</span></Cover>
        <div className="p-4"><h2 className="font-display text-xl">{v.name}</h2><p className="flex items-center gap-1 text-sm font-semibold text-teal"><Users size={14} />Seats {v.capacity} · {v.provider}</p>{v.papers_status === 'complete' && <PaperChip />}
          <div className="mt-2 flex flex-wrap gap-1.5">{v.rent_driver != null && <span className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-0.5 text-xs"><UserRound size={12} />With driver {peso(v.rent_driver)}</span>}{v.rent_self != null && <span className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-0.5 text-xs"><KeyRound size={12} />Self-drive {peso(v.rent_self)}</span>}</div></div></Link>); })}</div>}
  </>);
}

export function VehicleDetail() {
  const { id } = useParams(), [v, err] = useOne(`/rentals/vehicles/${id}`), [dests, setDests] = useState([]), today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ mode: '', start: '', end: '', pickup: 'Virac Airport', pax: 1, sel: [], license: false }), [free, setFree] = useState(null), [msg, setMsg] = useState(null);
  const ver = useSyncVersion();
  useEffect(() => { api('/destinations').then(setDests).catch(() => {}); }, [ver]);
  useEffect(() => { if (v && !f.mode) setF(x => ({ ...x, mode: v.rent_driver != null ? 'driver' : 'self' })); }, [v]);
  const valid = f.start && f.end && f.end >= f.start, nDays = valid ? Math.round((new Date(f.end) - new Date(f.start)) / 864e5) + 1 : 0;
  useEffect(() => { if (!valid) return setFree(null); api(`/rentals/availability?vehicleId=${id}&start=${f.start}&end=${f.end}`).then(r => setFree(r.available)).catch(() => setFree(null)); }, [id, f.start, f.end, msg?.ok, ver]);
  if (err) return <Err m={err} />; if (!v) return <Err m="Loading…" />;
  const rate = f.mode === 'driver' ? v.rent_driver : v.rent_self, total = rate != null && nDays ? rate * nDays : 0;
  const toggle = (did) => setF(x => ({ ...x, sel: x.sel.includes(did) ? x.sel.filter(y => y !== did) : [...x.sel, did] }));
  const chosen = dests.filter(d => f.sel.includes(d.id)), can = valid && free !== false && f.sel.length > 0 && rate != null && (f.mode !== 'self' || f.license);
  async function book() { try { await api('/rentals/book', { method: 'POST', body: { vehicleId: id, mode: f.mode, start: f.start, end: f.end, destinations: f.sel, pickup: f.pickup, passengers: Number(f.pax), licenseOk: f.license } }); setMsg({ ok: true }); } catch (e) { setMsg({ text: e.message.includes('Sign in') ? 'Please sign in to rent a vehicle.' : e.message }); } }
  const lab = 'grid gap-1 text-xs font-medium text-ocean/60';
  return (<main><Banner name={v.name} photo={v.cover_photo || v.photos?.[0]} sub={`${cap(v.type)} · ${v.provider}`} badge={`from ${peso(cheapest(v))}/day`} />
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-3"><div className="lg:col-span-2">
      <p className="text-lg leading-relaxed">{v.description}</p>
      <Section title="At a glance"><div className="grid grid-cols-2 gap-4 rounded-3xl border border-line bg-white p-5 sm:grid-cols-3"><Fact Icon={Users} label="Seats" value={v.capacity} /><Fact Icon={(ICON[v.type] || Car)} label="Type" value={cap(v.type)} /><Fact Icon={Phone} label="Provider phone" value={v.provider_phone} /></div>
        <p className="mt-2 text-xs text-ocean/60">Ask the provider what is included (fuel, tolls, meals) before you travel.</p></Section>
      {albumOf(v).length > 0 && <Section title="Photos of this vehicle"><Album photos={albumOf(v)} name={v.name} /></Section>}<Section title={`${v.provider}'s business papers`}><PapersPublic papers={v.papers} /></Section>{albumOf({ cover_photo: v.provider_cover, photos: v.provider_photos }).length > 0 && <Section title={`From ${v.provider}`}><Album photos={albumOf({ cover_photo: v.provider_cover, photos: v.provider_photos })} name={v.provider} /></Section>}<Section title="Where do you want to go?"><p className="mb-3 text-sm text-ocean/70">Pick one or more destinations for this rental.</p>
        <div className="grid gap-2 sm:grid-cols-2">{dests.map(d => { const on = f.sel.includes(d.id); return <button key={d.id} type="button" aria-pressed={on} onClick={() => toggle(d.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? 'bg-sun text-ocean' : 'bg-foam'}`}>{on && <Check size={14} />}</span><span><b>{d.name}</b><br /><span className="opacity-70">{d.municipality}{d.travel_minutes_from_virac != null && ` · ${d.travel_minutes_from_virac} min from Virac`}</span></span></button>; })}</div></Section>
      <Section title="Your trip on the map">{chosen.length ? <div className="overflow-hidden rounded-3xl border border-line"><DestMap items={chosen} className="h-72" /></div> : <Empty>Choose destinations above to see them here.</Empty>}</Section></div>
    <aside><div className="grid gap-4 rounded-3xl border border-line bg-white p-5 lg:sticky lg:top-24"><p className="font-display text-2xl">Rent this vehicle</p>
      <div className="grid grid-cols-2 gap-2">{[['driver', 'With driver', UserRound, v.rent_driver], ['self', 'Self-drive', KeyRound, v.rent_self]].map(([m, l, I, r]) => <button key={m} type="button" disabled={r == null} onClick={() => setF({ ...f, mode: m })} className={`rounded-2xl border p-3 text-left text-sm disabled:opacity-40 ${f.mode === m && r != null ? 'border-ocean bg-ocean text-foam' : 'border-line'}`}><I size={18} /><b className="mt-1 block">{l}</b>{r != null ? `${peso(r)}/day` : 'Not offered'}</button>)}</div>
      <label className={lab}>Pick-up date<input type="date" min={today} className={inp} value={f.start} onChange={e => setF({ ...f, start: e.target.value, end: f.end >= e.target.value ? f.end : '' })} /></label>
      <label className={lab}>Return date<input type="date" min={f.start || today} className={inp} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} /></label>
      <label className={lab}>Pick-up place<select className={inp} value={f.pickup} onChange={e => setF({ ...f, pickup: e.target.value })}>{['Virac Airport', 'Virac Port', 'San Andres Port', 'My hotel (tell the provider)'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label className={lab}>Passengers<input type="number" min="1" max={v.capacity} className={inp} value={f.pax} onChange={e => setF({ ...f, pax: e.target.value })} /></label>
      {f.mode === 'self' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.license} onChange={e => setF({ ...f, license: e.target.checked })} />I confirm I hold a valid driver's license.</label>}
      <div className="rounded-2xl bg-foam p-3 text-sm">{nDays > 0 && rate != null ? <><p>{nDays} day{nDays > 1 ? 's' : ''} × {peso(rate)}</p><p className="font-display text-2xl">{peso(total)}</p></> : <p className="text-ocean/60">Choose your dates to see the price.</p>}
        {free === false && <p className="mt-1 text-red-700">Already booked on those dates.</p>}{free === true && <p className="mt-1 text-teal">Available on those dates.</p>}</div>
      <button disabled={!can} onClick={book} className={`${btn} py-3 disabled:opacity-40`}>{f.sel.length === 0 ? 'Choose a destination' : 'Request rental'}</button>
      {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? 'bg-teal/10' : 'bg-red-50 text-red-800'}`}>{msg.ok ? <>Request sent. <Link className="underline" to="/bookings">Open My bookings</Link> to pay and track it.</> : msg.text}</p>}
      <p className="text-xs text-ocean/55">Payment in this prototype is simulated.</p></div></aside></div></main>);
}

const HUBS = [['Virac Airport', Plane], ['San Andres Port', Ship], ['Virac Port', Ship]];
function Rides() {
  const [origin, setOrigin] = useState(HUBS[0][0]), [routes, setRoutes] = useState(null), [when, setWhen] = useState(''), [pax, setPax] = useState(2), [msg, setMsg] = useState(null);
  const ver = useSyncVersion();
  useEffect(() => { api(`/transport/routes?origin=${encodeURIComponent(origin)}`).then(setRoutes).catch(() => setRoutes([])); }, [origin, ver]);
  async function book(routeId) { try { await api('/transport/book', { method: 'POST', body: { routeId, pickupAt: new Date(when).toISOString(), passengers: Number(pax) } }); setMsg({ ok: 1 }); } catch (e) { setMsg({ text: e.message.includes('Sign in') ? 'Please sign in to request a ride.' : e.message }); } }
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  return (<div className="mt-5">
    <div className="grid gap-3 sm:grid-cols-3">{HUBS.map(([h, I]) => <button key={h} onClick={() => setOrigin(h)} className={`lift flex items-center gap-3 rounded-3xl border p-4 text-left ${origin === h ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white'}`}><span className={`grid h-11 w-11 place-items-center rounded-2xl ${origin === h ? 'bg-white/20' : 'bg-teal/10 text-teal'}`}><I size={20} /></span><span><span className="block text-xs opacity-70">Pickup</span><b>{h}</b></span></button>)}</div>
    <div className="mt-4 flex flex-wrap gap-3 rounded-3xl border border-line bg-white p-3">
      <label className="flex min-w-[12rem] flex-1 items-center gap-3 rounded-2xl px-3 py-1 hover:bg-foam"><CalendarClock size={18} className="text-teal" /><span className="grid text-xs text-ocean/60">Pickup time<input type="datetime-local" min={now} value={when} onChange={e => setWhen(e.target.value)} className="bg-transparent text-base font-medium text-ocean outline-none" /></span></label>
      <label className="flex items-center gap-3 rounded-2xl px-3 py-1 hover:bg-foam"><Users size={18} className="text-teal" /><span className="grid text-xs text-ocean/60">Passengers<input type="number" min="1" value={pax} onChange={e => setPax(e.target.value)} className="w-20 bg-transparent text-base font-medium text-ocean outline-none" /></span></label></div>
    {msg && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${msg.ok ? 'bg-teal/10' : 'bg-red-50 text-red-800'}`}>{msg.ok ? <>Request sent. The driver will confirm it. <Link to="/bookings" className="underline">See My bookings</Link></> : msg.text}</p>}
    <div className="mt-5 grid gap-4">{routes === null ? <p>Loading…</p> : routes.length === 0 ? <Empty Icon={Bus}>No registered providers serve this pickup yet.</Empty> : routes.map(r => <article key={r.id} className="lift flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-5">
      <div className="flex items-center gap-4">{r.provider_cover ? <Photo src={r.provider_cover} alt={r.provider} className="h-12 w-12 rounded-2xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-ocean to-teal text-white"><Bus size={22} /></span>}<div><p className="flex items-center gap-2 font-display text-xl">{r.origin} <ArrowRight size={16} /> {r.destination}</p><p className="text-sm text-ocean/65">{r.provider}{r.est_minutes && <> · <Clock size={13} className="inline" /> about {r.est_minutes} min</>}</p></div></div>
      <div className="text-right"><p className="font-display text-3xl font-bold">{peso(r.fare)}</p><p className="mb-2 text-xs text-ocean/60">per trip</p><button disabled={!when} onClick={() => book(r.id)} className={`${btn} disabled:opacity-40`}>{when ? 'Request this ride' : 'Pick a time first'}</button></div></article>)}</div></div>);
}
