import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link } from 'react-router-dom';
import { Compass, BedDouble, Utensils, Bus, Route as RouteIcon, Gift, Store, QrCode, Sparkles, ArrowRight, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import Cover from '../components/Cover.jsx';
import DestMap from '../components/DestMap.jsx';
import TileStrip from '../components/TileStrip.jsx';
const LETTER = ['text-coral', 'text-tang', 'text-sun', 'text-leaf', 'text-aqua', 'text-sky', 'text-rose'];
const quick = [[Compass, 'Explore', '/explore', 'bg-coral'], [BedDouble, 'Stays', '/accommodations', 'bg-sky'], [Bus, 'Rides', '/transportation', 'bg-leaf'], [RouteIcon, 'Plan a trip', '/itinerary', 'bg-tang']];
const more = [[BedDouble, 'Book a stay', 'Inns, resorts and homestays with live availability.', '/accommodations', 'bg-sky'], [Utensils, 'Eat local', 'Menus, cuisines and table reservations.', '/restaurants', 'bg-coral'], [Bus, 'Airport and port rides', 'Request a van or tricycle from Virac Airport or the ports.', '/transportation', 'bg-leaf'], [Gift, 'Rewards', 'Scan QR codes, earn points and redeem local prizes.', '/rewards', 'bg-teal'], [Store, 'Shops', 'Souvenir shops and groceries run by locals.', '/businesses', 'bg-tang'], [RouteIcon, 'Itinerary planner', 'Drag, drop and edit a plan with budget and travel time.', '/itinerary', 'bg-rose']];
export default function Home() {
  const [dest, setDest] = useState(null), signedIn = !!localStorage.getItem('token');
  const ver = useSyncVersion();
  useEffect(() => { api('/destinations').then(setDest).catch(() => setDest([])); }, [ver]);
  return (<main>
    <section className="relative overflow-hidden bg-gradient-to-br from-ocean via-[#3340B5] to-sky text-foam">
      <div aria-hidden className="floaty absolute right-[8%] top-6 hidden h-24 w-24 rounded-full bg-sun md:block" /><div aria-hidden className="floaty absolute right-[22%] top-52 hidden h-14 w-14 rotate-45 bg-coral xl:block" style={{ '--r': '45deg', animationDelay: '1s' }} />
      <div aria-hidden className="floaty absolute left-[6%] bottom-40 hidden h-12 w-12 rounded-full bg-aqua xl:block" style={{ animationDelay: '2s' }} /><div aria-hidden className="floaty absolute left-[40%] top-10 hidden h-8 w-8 rotate-45 bg-rose xl:block" style={{ '--r': '45deg', animationDelay: '3s' }} />
      <div aria-hidden className="absolute -bottom-20 right-10 hidden h-72 w-72 rounded-full bg-leaf/70 md:block" /><div aria-hidden className="absolute -bottom-10 right-52 hidden h-44 w-44 rounded-full bg-tang/80 md:block" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-36 pt-14 md:pb-44 md:pt-20">
        <p className="eyebrow !text-sun inline-flex items-center gap-2"><Sparkles size={14} />Tourism, bookings and rewards</p>
        <p className="mt-4 font-display text-3xl font-semibold md:text-4xl">Discover</p>
        <h1 className="font-display font-bold leading-[0.92] tracking-tight [font-size:30vw] sm:leading-[0.95] sm:[font-size:clamp(2.4rem,13vw,6.5rem)]" aria-label="Catanduanes">{[...'CATANDUANES'].map((c, i) => <span key={i} aria-hidden><span className={LETTER[i % 7]}>{c}</span>{(i === 3 || i === 6) && <br className="sm:hidden" />}</span>)}</h1>
        <p className="mt-3 font-display text-2xl font-semibold uppercase tracking-widest text-foam/90">The Happy Island</p>
        <p className="mt-5 max-w-xl text-lg text-foam/85">Waterfalls, surf beaches and hidden corners. Book your stay and your ride from the airport or port. Scan, collect points and win local rewards.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/itinerary" className="inline-flex items-center gap-2 rounded-full bg-sun px-8 py-3.5 font-display text-lg font-semibold text-ocean hover:bg-white">Plan my trip <ArrowRight size={18} /></Link><Link to="/explore" className="rounded-full border-2 border-white/60 px-8 py-3.5 font-display text-lg font-semibold hover:bg-white/10">Browse destinations</Link></div>
      </div>
      <TileStrip className="absolute inset-x-0 bottom-0 h-12" />
    </section>
    <section className="relative z-10 mx-auto -mt-6 max-w-5xl px-4"><div className="grid grid-cols-2 gap-3 rounded-3xl border border-line bg-white p-3 shadow-xl md:grid-cols-4">
      {quick.map(([Icon, l, to, bg]) => <Link key={l} to={to} className="lift flex items-center gap-3 rounded-2xl p-4 hover:bg-foam"><span className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${bg}`}><Icon size={22} /></span><span className="font-display text-lg">{l}</span></Link>)}</div></section>
    <section className="mx-auto max-w-6xl px-4 pt-16"><div className="mb-6 flex items-end justify-between"><div><p className="eyebrow">Featured</p><h2 className="font-display text-3xl md:text-5xl">Places worth the trip</h2></div><Link to="/explore" className="hidden font-semibold underline sm:block">See all</Link></div>
      {dest === null ? <p>Loading…</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{dest.slice(0, 6).map(d => <Link key={d.id} to={`/explore/${d.id}`} className="lift group block overflow-hidden rounded-3xl border border-line bg-white">
        <Cover name={d.name} photo={d.cover_photo || d.photos?.[0]} className="h-48">{signedIn && d.points && <span className="absolute right-3 top-3 rounded-full bg-sun px-3 py-1 text-xs font-bold text-ocean">{d.points} pts</span>}</Cover>
        <div className="p-5"><h3 className="font-display text-2xl">{d.name}</h3><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-teal"><MapPin size={14} />{d.municipality}{d.travel_minutes_from_virac != null && ` · ${d.travel_minutes_from_virac} min from Virac`}</p><p className="mt-2 line-clamp-2 text-sm text-ocean/75">{d.description}</p></div></Link>)}</div>}</section>
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-20 lg:grid-cols-5"><div className="lg:col-span-2"><p className="eyebrow">The map</p><h2 className="font-display text-3xl md:text-5xl">See the whole island at a glance</h2><p className="mt-3 text-ocean/80">Every listed destination on one map. Open a place to get driving directions from Virac Airport or your own location, right on the page.</p><Link to="/explore" className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral px-7 py-3 font-display text-lg font-semibold text-white hover:bg-ocean">Open the map <ArrowRight size={16} /></Link></div>
      <div className="overflow-hidden rounded-3xl border-4 border-white shadow-xl lg:col-span-3">{dest && <DestMap items={dest} className="h-80" />}</div></section>
    <section className="mx-auto max-w-6xl px-4 pt-20"><p className="eyebrow">Everything you need</p><h2 className="mb-6 font-display text-3xl md:text-5xl">One platform, the whole trip</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{more.map(([Icon, t, d, to, bg]) => <Link key={t} to={to} className="lift rounded-3xl border border-line bg-white p-6"><span className={`grid h-14 w-14 place-items-center rounded-2xl text-white ${bg}`}><Icon size={24} /></span><h3 className="mt-4 font-display text-2xl">{t}</h3><p className="mt-1 text-sm text-ocean/75">{d}</p></Link>)}</div></section>
    <section className="mt-20"><TileStrip className="h-10" /><div className="bg-ocean text-foam"><div className="mx-auto max-w-6xl px-4 py-14"><p className="eyebrow !text-sun">Rewards</p><h2 className="font-display text-3xl md:text-5xl">Explore more, earn more</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">{[[QrCode, '1. Scan', 'Scan the QR code at a participating place.', 'bg-coral'], [Sparkles, '2. Earn', 'Farther and harder-to-reach places give more points.', 'bg-tang'], [Gift, '3. Redeem', 'Trade points for souvenirs, meals and discounts.', 'bg-leaf']].map(([Icon, t, d, bg]) => <div key={t} className="rounded-3xl bg-white/10 p-6 backdrop-blur"><span className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${bg}`}><Icon /></span><h3 className="mt-3 font-display text-2xl">{t}</h3><p className="mt-1 text-sm text-foam/80">{d}</p></div>)}</div>
      <Link to="/rewards" className="mt-8 inline-flex items-center gap-2 rounded-full bg-sun px-7 py-3 font-display text-lg font-semibold text-ocean hover:bg-white">See rewards <ArrowRight size={16} /></Link></div></div></section>
  </main>);
}
