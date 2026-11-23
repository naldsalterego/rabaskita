import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, CalendarClock, Users, ArrowUpDown, Bike, Info } from 'lucide-react';
import { useSyncVersion } from '../lib/sync.js';
import { api } from '../lib/api.js';
import { peso } from '../lib/policy.js';
import { Photo } from '../components/Photo.jsx';
import { PaperChip } from '../components/Docs.jsx';
import { Empty, btn, inp } from '../components/ui.jsx';
import { RoamDialog, RoamPolicySummary } from '../components/RoamBooking.jsx';

// Where am I / where am I going. A value is a place id from the list, or 'geo:lat,lng' for the guest's own position.
function PlacePicker({ label, value, onChange, places }) {
  const [state, setState] = useState(''), groups = [...new Set(places.map(p => p.group))], isGeo = String(value).startsWith('geo:');
  function locate() {
    if (!navigator.geolocation) return setState('This device cannot share its location.'); setState('Finding you…');
    navigator.geolocation.getCurrentPosition(p => { onChange(`geo:${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`); setState(''); }, () => setState('Could not get your location. Please pick a place from the list.'), { enableHighAccuracy: true, timeout: 10000 });
  }
  return (<div className="grid gap-1"><label className="grid gap-1 text-xs font-medium text-ocean/60">{label}
    <select className={inp} value={isGeo ? 'geo' : value} onChange={e => e.target.value !== 'geo' && onChange(e.target.value)}>
      <option value="">Choose a place…</option>{isGeo && <option value="geo">My current location</option>}
      {groups.map(g => <optgroup key={g} label={g}>{places.filter(p => p.group === g).map(p => <option key={p.id} value={p.id}>{p.label}{p.municipality ? ` · ${p.municipality}` : ''}</option>)}</optgroup>)}
    </select></label>
    <button type="button" onClick={locate} className="inline-flex items-center gap-1 justify-self-start text-xs text-teal underline"><Navigation size={12} />Use my current location</button>
    {state && <p className="text-xs text-ocean/65">{state}</p>}</div>);
}

/** Tricycle commute: point A to point B, priced by the distance. */
export default function Commute({ goRent }) {
  const [places, setPlaces] = useState([]), [from, setFrom] = useState(''), [to, setTo] = useState(''), [when, setWhen] = useState(''), [pax, setPax] = useState(1);
  const [res, setRes] = useState(null), [err, setErr] = useState(''), [dlg, setDlg] = useState(null), [done, setDone] = useState(false), ver = useSyncVersion();
  useEffect(() => { api('/transport/places').then(setPlaces).catch(() => setPlaces([])); }, [ver]);
  useEffect(() => {
    setRes(null); setErr(''); if (!from || !to) return; if (from === to) return setErr('Choose two different places.');
    api(`/transport/commute/options?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(setRes).catch(e => setErr(e.message));
  }, [from, to, ver]);
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const q = (o) => `/transport/ride-quote?vehicleId=${o.vehicle_id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pickupAt=${encodeURIComponent(new Date(when).toISOString())}`;
  return (<div className="mt-5">
    <div className="flex items-start gap-2 rounded-2xl bg-foam p-3 text-sm"><Info size={16} className="mt-0.5 shrink-0 text-teal" /><p><b>Commute</b> is for getting from one place to another: you pay by the distance. Want a tricycle for the day, with stops of your choice? Use <button type="button" onClick={goRent} className="underline">Rent a vehicle</button> instead.</p></div>
    <div className="mt-4 grid gap-4 rounded-3xl border border-line bg-white p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
      <PlacePicker label="From (point A)" value={from} onChange={setFrom} places={places} />
      <button type="button" aria-label="Swap the two places" onClick={() => { setFrom(to); setTo(from); }} className="mt-5 hidden rounded-full border border-line p-2 hover:border-teal sm:block"><ArrowUpDown size={16} /></button>
      <PlacePicker label="To (point B)" value={to} onChange={setTo} places={places} />
    </div>
    <div className="mt-3 flex flex-wrap gap-3 rounded-3xl border border-line bg-white p-3">
      <label className="flex min-w-[12rem] flex-1 items-center gap-3 rounded-2xl px-3 py-1 hover:bg-foam"><CalendarClock size={18} className="text-teal" /><span className="grid text-xs text-ocean/60">Pick-up time<input type="datetime-local" min={now} value={when} onChange={e => setWhen(e.target.value)} className="bg-transparent text-base font-medium text-ocean outline-none" /></span></label>
      <label className="flex items-center gap-3 rounded-2xl px-3 py-1 hover:bg-foam"><Users size={18} className="text-teal" /><span className="grid text-xs text-ocean/60">Passengers<input type="number" min="1" value={pax} onChange={e => setPax(e.target.value)} className="w-20 bg-transparent text-base font-medium text-ocean outline-none" /></span></label></div>
    {done && <p role="status" className="mt-4 rounded-xl bg-teal/10 p-3 text-sm">Request sent. The driver will confirm it. <Link to="/bookings" className="underline">See My bookings</Link></p>}
    {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
    {res && <div className="mt-5">
      <p className="flex flex-wrap items-center gap-2 text-sm"><MapPin size={16} className="text-teal" /><b>{res.from.label}</b> to <b>{res.to.label}</b> · about <b>{res.km} km</b> by road <span className="text-ocean/60">(estimate)</span></p>
      {res.too_far ? <div className="mt-3"><Empty Icon={Bike}>That trip is about {res.km} km, and commutes cover up to {res.max_km} km. For a longer trip, <button type="button" onClick={goRent} className="underline">rent a vehicle</button>.</Empty></div>
        : res.options.length === 0 ? <div className="mt-3"><Empty Icon={Bike}>No tricycle offers commute rides yet.</Empty></div>
        : <div className="mt-3 grid gap-4">{res.options.map(o => { const tooMany = Number(pax) > o.capacity; return (<article key={o.vehicle_id} className="lift flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-5">
          <div className="flex items-center gap-4">{o.cover_photo ? <Photo src={o.cover_photo} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-ocean to-teal text-white"><Bike size={24} /></span>}
            <div><p className="font-display text-xl">{o.name}</p><p className="text-sm text-ocean/65">{o.provider}{o.driver_name && ` · driver ${o.driver_name}`} · seats {o.capacity}</p>{o.papers_status === 'complete' && <PaperChip />}
              <p className="mt-1 text-xs text-ocean/60">{peso(o.rates.base)} for the first {o.rates.baseKm} km, then {peso(o.rates.perKm)} for each extra km</p></div></div>
          <div className="text-right"><p className="font-display text-3xl font-bold">{peso(o.fare)}</p><p className="mb-2 text-xs text-ocean/60">for this trip, paid to the driver</p>
            <button disabled={!when || tooMany} onClick={() => { setDone(false); setDlg(o); }} className={`${btn} disabled:opacity-40`}>{!when ? 'Pick a time first' : tooMany ? `Seats ${o.capacity} only` : 'Request this tricycle'}</button></div></article>); })}</div>}
    </div>}
    <div className="mt-6"><RoamPolicySummary show={['ride']} /></div>
    <p className="mt-3 text-xs text-ocean/55">Distances are estimates from the two places on the map, stretched for the curves of the road. Fares are the drivers' own, so check them against the official tricycle fare matrix of your municipality. Sample data in this prototype.</p>
    {dlg && <RoamDialog kind="ride" title="Request a tricycle" sub={`${dlg.name} · ${dlg.provider}`} summary={`${res.from.label} to ${res.to.label} · about ${res.km} km · ${pax} passenger${Number(pax) === 1 ? '' : 's'}`} who="the driver"
      quotePath={q(dlg)} postPath="/transport/commute" payload={{ vehicleId: dlg.vehicle_id, from, to, pickupAt: new Date(when).toISOString(), passengers: Number(pax) }}
      onClose={() => setDlg(null)} onDone={() => { setDlg(null); setDone(true); }} />}
  </div>);
}
