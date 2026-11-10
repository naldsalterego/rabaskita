import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link } from 'react-router-dom';
import { MapPin, Search, Camera } from 'lucide-react';
import { api } from '../lib/api.js';
import Cover from '../components/Cover.jsx';
import DestMap from '../components/DestMap.jsx';
const MUNIS = ['Virac', 'San Andres', 'Baras', 'Bato', 'Caramoran', 'Gigmoto', 'Pandan', 'Panganiban', 'San Miguel', 'Viga', 'Bagamanoc'];
export default function Explore() {
  const [items, setItems] = useState(null), [q, setQ] = useState(''), [muni, setMuni] = useState(''), signedIn = !!localStorage.getItem('token');
  const ver = useSyncVersion();
  useEffect(() => { const p = new URLSearchParams(); if (q) p.set('q', q); if (muni) p.set('municipality', muni); api(`/destinations?${p}`).then(setItems).catch(() => setItems([])); }, [q, muni, ver]);
  const chip = (on) => `shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm border ${on ? 'bg-ocean text-foam border-ocean' : 'bg-white border-line hover:border-teal'}`;
  return (<main className="mx-auto max-w-7xl px-4 py-8">
    <h1 className="font-display text-4xl md:text-5xl">Explore Catanduanes</h1><p className="mt-1 text-ocean/75">Pick a place to see details, directions and reviews.</p>
    <div className="mt-5 relative max-w-md"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ocean/50" /><input className="w-full rounded-full border border-line bg-white pl-10 pr-4 py-2.5" placeholder="Search destinations" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"><button className={chip(!muni)} onClick={() => setMuni('')}>All</button>{MUNIS.map(m => <button key={m} className={chip(muni === m)} onClick={() => setMuni(m)}>{m}</button>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-3">{items === null ? <p>Loading…</p> : items.length === 0 ? <p>No destinations match. Try a different search.</p> :
        <div className="grid gap-5 sm:grid-cols-2">{items.map(d => <Link key={d.id} to={`/explore/${d.id}`} className="lift block overflow-hidden rounded-3xl bg-white border border-line">
          <Cover name={d.name} photo={d.cover_photo || d.photos?.[0]} className="h-40">{(() => { const c = new Set([d.cover_photo, ...(d.photos || [])].filter(Boolean)).size; return c > 0 && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white"><Camera size={12} />{c}</span>; })()}{signedIn && d.points && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ocean">{d.points} pts</span>}</Cover>
          <div className="p-4"><h2 className="font-display text-xl">{d.name}</h2><p className="flex items-center gap-1 text-sm text-teal"><MapPin size={14} />{d.municipality}{d.travel_minutes_from_virac != null && ` · ${d.travel_minutes_from_virac} min from Virac`}</p><p className="mt-2 text-sm text-ocean/75 line-clamp-2">{d.description}</p></div></Link>)}</div>}</section>
      <section className="lg:col-span-2"><div className="lg:sticky lg:top-24 rounded-3xl overflow-hidden border border-line">{items && <DestMap items={items} className="h-[420px] lg:h-[620px]" />}</div></section></div>
  </main>);
}
