import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Clock, Ticket, Car, Gift, QrCode, Phone } from 'lucide-react';
import { api } from '../lib/api.js';
import Reviews from '../components/Reviews.jsx';
import Cover from '../components/Cover.jsx';
import RouteMap from '../components/RouteMap.jsx';
import { PapersPublic, PaperChip } from '../components/Docs.jsx';
import Album, { albumOf, CountBadge } from '../components/Album.jsx';
import { inp, btn } from '../components/ui.jsx';
export function useOne(path) { const [d, setD] = useState(null), [err, setErr] = useState(''), ver = useSyncVersion(); useEffect(() => { api(path).then(setD).catch(e => setErr(e.message)); }, [path, ver]); return [d, err]; }
export const Banner = ({ name, sub, badge, photo }) => <Cover name={name} photo={photo} className="h-56 md:h-72"><div className="absolute inset-0 bg-gradient-to-t from-ocean/80 via-ocean/20 to-transparent" />
  <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-5xl px-4 pb-6 text-foam"><span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm backdrop-blur"><MapPin size={14} />{sub}</span><h1 className="mt-2 font-display text-4xl md:text-6xl font-bold">{name}</h1></div>{badge && <span className="absolute right-4 top-4 rounded-full bg-sand px-4 py-1.5 text-sm font-semibold text-ocean">{badge}</span>}</Cover>;
export const Fact = ({ Icon, label, value }) => value ? <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><Icon size={18} /></span><div><p className="text-xs uppercase tracking-wide text-ocean/55">{label}</p><p className="font-medium">{value}</p></div></div> : null;
export const Section = ({ title, children }) => <section className="mt-8"><h2 className="font-display text-2xl mb-3">{title}</h2>{children}</section>;
export const hoursText = (h) => h ? Object.entries(h).map(([k, v]) => `${k}: ${v}`).join(' · ') : null;
export const Err = ({ m }) => <p className="p-8">{m}</p>;

export default function Listings({ kind }) {
  const [rows, setRows] = useState(null), [f, setF] = useState('');
  const ver = useSyncVersion();
  useEffect(() => { api(`/${kind}${f ? `?${kind === 'restaurants' ? 'cuisine' : 'category'}=${encodeURIComponent(f)}` : ''}`).then(setRows).catch(() => setRows([])); }, [kind, f, ver]);
  const base = kind === 'restaurants' ? 'restaurants' : 'businesses';
  return (<main className="mx-auto max-w-6xl px-4 py-8"><h1 className="font-display text-4xl md:text-5xl">{kind === 'restaurants' ? 'Where to eat' : 'Souvenirs and groceries'}</h1><p className="mt-1 text-ocean/75">Own a business? <Link to="/join" className="underline">Join Rabas Kita!</Link> Look for the “Papers complete” badge to see which businesses have their papers verified.</p>
    {kind === 'restaurants' ? <input className={`${inp} mt-4 w-full max-w-sm`} placeholder="Filter by cuisine (e.g. Seafood)" value={f} onChange={e => setF(e.target.value)} /> : <div className="mt-4 flex gap-2 overflow-x-auto">{[['', 'All'], ['Souvenir shops', 'Souvenir shops'], ['Groceries', 'Groceries']].map(([v, l]) => <button key={v} onClick={() => setF(v)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${f === v ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white'}`}>{l}</button>)}</div>}
    {rows === null ? <p className="mt-6">Loading…</p> : rows.length === 0 ? <p className="mt-6">{kind === 'restaurants' ? 'No restaurants listed yet.' : 'No shops listed yet.'}</p> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r => <Link key={r.id} to={`/${base}/${r.restaurant_id || r.id}`} className="lift block overflow-hidden rounded-3xl bg-white border border-line"><Cover name={r.name} photo={r.cover_photo || r.photos?.[0]} className="h-36"><CountBadge n={albumOf(r).length} /></Cover>
      <div className="p-4"><h2 className="font-display text-xl">{r.name}</h2><p className="text-sm text-teal">{r.municipality}{r.cuisines?.length ? ` · ${r.cuisines.join(', ')}` : ''}{r.category && ` · ${r.category}`}</p>{r.papers_status === 'complete' && <PaperChip />}<p className="mt-1 text-sm text-ocean/75 line-clamp-2">{r.description}</p></div></Link>)}</div>}</main>);
}
export function DestinationDetail() {
  const { id } = useParams(); const [d, err] = useOne(`/destinations/${id}`), signedIn = !!localStorage.getItem('token'); if (err) return <Err m={err} />; if (!d) return <Err m="Loading…" />;
  const album = [...new Set([d.cover_photo, ...(d.photos || [])].filter(Boolean))];
  return (<main><Banner name={d.name} sub={d.municipality} photo={d.cover_photo || d.photos?.[0]} badge={signedIn && d.points ? `${d.points} points` : null} />
    <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-3"><div className="lg:col-span-2">
      <p className="text-lg leading-relaxed">{d.description}</p>{d.history && <p className="mt-3 text-ocean/80">{d.history}</p>}
      {album.length > 0 && <Section title="Photo album"><Album photos={album} name={d.name} /></Section>}
      {d.facilities?.length > 0 && <Section title="Facilities"><div className="flex flex-wrap gap-2">{d.facilities.map(f => <span key={f} className="rounded-full bg-white border border-line px-3 py-1 text-sm">{f}</span>)}</div></Section>}
      {d.accessibility_notes && <Section title="Accessibility"><p>{d.accessibility_notes}</p></Section>}{d.safety_notes && <Section title="Safety reminders"><p>{d.safety_notes}</p></Section>}
      <Section title="Getting there"><RouteMap lat={d.lat} lng={d.lng} name={d.name} /></Section><Reviews type="destination" id={id} /></div>
      <aside><div className="lg:sticky lg:top-24 rounded-3xl bg-white border border-line p-5 grid gap-4"><Fact Icon={Ticket} label="Entrance fee" value={d.entrance_fee != null && (d.entrance_fee === 0 ? 'Free' : `₱${d.entrance_fee}`)} /><Fact Icon={Car} label="From Virac" value={d.travel_minutes_from_virac != null && `about ${d.travel_minutes_from_virac} min`} /><Fact Icon={Clock} label="Hours" value={hoursText(d.hours)} />{signedIn ? <Fact Icon={Gift} label="Check-in reward" value={d.points && `${d.points} points`} /> : <p className="flex items-center gap-2 text-sm text-ocean/70"><Gift size={16} className="text-teal" /><span><Link className="underline" to="/login">Sign in</Link> to see the points you can earn here.</span></p>}
        {signedIn ? <Link to={`/scan?name=${encodeURIComponent(d.name)}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-ocean px-5 py-2.5 text-sm font-medium text-foam"><QrCode size={16} />Scan this place's QR</Link> : <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-ocean px-5 py-2.5 text-sm font-medium text-foam"><QrCode size={16} />Sign in to scan the QR</Link>}</div></aside></div></main>);
}
export function RestaurantDetail() {
  const { id } = useParams(); const [r, err] = useOne(`/restaurants/${id}`); const [when, setWhen] = useState(''), [size, setSize] = useState(2), [msg, setMsg] = useState('');
  async function reserve(e) { e.preventDefault(); try { await api('/bookings/reservation', { method: 'POST', body: { restaurantId: id, reservedAt: new Date(when).toISOString(), partySize: Number(size) } }); setMsg('Reservation requested. The restaurant will confirm it.'); } catch (x) { setMsg(x.message); } }
  if (err) return <Err m={err} />; if (!r) return <Err m="Loading…" />;
  return (<main><Banner name={r.name} photo={r.cover_photo || r.photos?.[0]} sub={`${r.municipality}${r.cuisines?.length ? ' · ' + r.cuisines.join(', ') : ''}`} badge={r.price_range && '₱'.repeat(r.price_range)} />
    <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-3"><div className="lg:col-span-2"><p className="text-lg">{r.description}</p>
      {albumOf(r).length > 0 && <Section title="Photo album"><Album photos={albumOf(r)} name={r.name} /></Section>}<Section title="Menu">{r.menu.length === 0 ? <p>Menu not posted yet.</p> : <ul className="rounded-2xl bg-white border border-line divide-y divide-line">{r.menu.map(m => <li key={m.id} className="flex justify-between p-3"><span>{m.item_name}{m.description && <span className="text-sm text-ocean/60"> · {m.description}</span>}</span><b>₱{m.price}</b></li>)}</ul>}</Section>
      <Section title="Business papers"><PapersPublic papers={r.papers} /></Section><Section title="Find us"><RouteMap lat={r.lat} lng={r.lng} name={r.name} /></Section><Reviews type="restaurant" id={id} /></div>
      <aside><div className="lg:sticky lg:top-24 rounded-3xl bg-white border border-line p-5 grid gap-4"><Fact Icon={MapPin} label="Address" value={r.address} /><Fact Icon={Phone} label="Phone" value={r.phone} /><Fact Icon={Clock} label="Hours" value={hoursText(r.hours)} />
        {r.accepts_reservations ? <form onSubmit={reserve} className="grid gap-2"><p className="font-display text-lg">Reserve a table</p><input type="datetime-local" required className={inp} value={when} onChange={e => setWhen(e.target.value)} aria-label="Date and time" /><input type="number" min="1" className={inp} value={size} onChange={e => setSize(e.target.value)} aria-label="Party size" /><button className={btn}>Reserve</button></form> : <p className="text-sm text-ocean/70">This place doesn't take online reservations.</p>}{msg && <p role="status" className="text-sm">{msg}</p>}</div></aside></div></main>);
}
export function BusinessDetail() {
  const { id } = useParams(); const [b, err] = useOne(`/businesses/${id}`); if (err) return <Err m={err} />; if (!b) return <Err m="Loading…" />;
  return (<main><Banner name={b.name} photo={b.cover_photo || b.photos?.[0]} sub={`${b.municipality}${b.category ? ' · ' + b.category : ''}`} />
    <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-3"><div className="lg:col-span-2"><p className="text-lg">{b.description}</p>{albumOf(b).length > 0 && <Section title="Photo album"><Album photos={albumOf(b)} name={b.name} /></Section>}<Section title="Business papers"><PapersPublic papers={b.papers} /></Section><Section title="Find us"><RouteMap lat={b.lat} lng={b.lng} name={b.name} /></Section><Reviews type="business" id={id} /></div>
      <aside><div className="rounded-3xl bg-white border border-line p-5 grid gap-4"><Fact Icon={MapPin} label="Address" value={b.address} /><Fact Icon={Phone} label="Phone" value={b.phone} /><Fact Icon={Clock} label="Hours" value={hoursText(b.hours)} /></div></aside></div></main>);
}
