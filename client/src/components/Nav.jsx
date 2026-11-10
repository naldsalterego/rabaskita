import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Brand from './Brand.jsx';
import { useBranding, DEFAULT_LOGO } from '../lib/branding.js';
import { photoUrl } from '../lib/photos.js';
import { Compass, BedDouble, Utensils, Ship, Route as RouteIcon, Gift, Store, LogIn, UserPlus, Menu, X, LayoutDashboard, Ticket, LogOut } from 'lucide-react';
// [label, path, icon, color classes used when the tile is active]
const ITEMS = [['Explore', '/explore', Compass, 'bg-coral'], ['Stays', '/accommodations', BedDouble, 'bg-sky'], ['Eat', '/restaurants', Utensils, 'bg-tang'], ['Ship', '/transportation', Ship, 'bg-leaf'], ['Planner', '/itinerary', RouteIcon, 'bg-rose'], ['Rewards', '/rewards', Gift, 'bg-teal'], ['Shops', '/businesses', Store, 'bg-ocean']];
const out = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); location.href = '/'; };
const tile = 'grid h-14 w-14 place-items-center rounded-2xl shadow-[0_6px_16px_-6px_rgba(37,48,143,.35)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_20px_-6px_rgba(37,48,143,.45)]';

function Tile({ to, label, Icon, on, solid, onClick, big }) {
  const inner = (active) => (<span className="group flex w-[4.6rem] flex-col items-center gap-1.5">
    <span className={`${tile} ${active ? `${on} text-white` : solid ? `${solid} text-white` : 'bg-white text-ocean'}`}><Icon size={26} strokeWidth={1.7} /></span>
    <span className={`font-display text-xs font-bold leading-none ${active ? 'text-ocean' : 'text-ocean/85'}`}>{label}</span></span>);
  return to ? <NavLink to={to} onClick={onClick} className="rounded-2xl" aria-label={label}>{({ isActive }) => inner(isActive)}</NavLink>
    : <button type="button" onClick={onClick} className="rounded-2xl" aria-label={label}>{inner(false)}</button>;
}

function Account({ u }) {
  const [open, setOpen] = useState(false); const item = 'flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left hover:bg-foam';
  return (<div className="relative">
    <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu" className="group flex w-[4.6rem] flex-col items-center gap-1.5 rounded-2xl">
      <span className={`${tile} overflow-hidden bg-white`}><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-coral to-tang font-display text-lg font-bold text-white">{u.full_name?.[0]?.toUpperCase()}</span></span>
      <span className="font-display text-xs font-bold leading-none text-ocean/85">Me</span></button>
    {open && <><div className="fixed inset-0 z-30" onClick={() => setOpen(false)} /><div onClick={() => setOpen(false)} className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-line bg-white p-2 text-sm shadow-xl">
      <p className="truncate px-3 py-2 font-display text-lg">{u.full_name}</p><Link to="/dashboard" className={item}><LayoutDashboard size={16} />Dashboard</Link><Link to="/bookings" className={item}><Ticket size={16} />My bookings</Link><button onClick={out} className={item}><LogOut size={16} />Sign out</button></div></>}
  </div>);
}

export default function Nav() {
  const [open, setOpen] = useState(false), brand = useBranding(); const u = JSON.parse(localStorage.getItem('user') || 'null'); const close = () => setOpen(false);
  useEffect(() => { // the browser tab title and icon follow the branding
    document.title = brand.siteName; let off = false;
    photoUrl(brand.logo || DEFAULT_LOGO).then(url => { if (off || !url) return; for (const rel of ['icon', 'apple-touch-icon']) { let l = document.querySelector(`link[rel="${rel}"]`); if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); } l.removeAttribute('type'); l.href = url; } }).catch(() => {});
    return () => { off = true; };
  }, [brand.siteName, brand.logo]);
  return (<header className="sticky top-0 z-20 border-b border-line bg-foam/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
      <Brand />
      <nav aria-label="Main" className="hidden items-start gap-1 lg:flex">{ITEMS.map(([l, to, I, on]) => <Tile key={to} to={to} label={l} Icon={I} on={on} />)}<span className="mx-2 mt-1 h-12 w-px bg-line" />
        {u ? <Account u={u} /> : <><Tile to="/login" label="Sign in" Icon={LogIn} on="bg-ocean" /><Tile to="/register" label="Join" Icon={UserPlus} on="bg-coral" solid="bg-coral" /></>}</nav>
      <button className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-md lg:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
    {open && <nav aria-label="Main" className="grid grid-cols-3 justify-items-center gap-y-4 border-t border-line px-4 pb-5 pt-4 sm:grid-cols-4 lg:hidden">
      {ITEMS.map(([l, to, I, on]) => <Tile key={to} to={to} label={l} Icon={I} on={on} onClick={close} />)}
      {u ? <><Tile to="/bookings" label="Bookings" Icon={Ticket} on="bg-sky" onClick={close} /><Tile to="/dashboard" label="Dashboard" Icon={LayoutDashboard} on="bg-ocean" onClick={close} /><Tile label="Sign out" Icon={LogOut} onClick={out} /></>
        : <><Tile to="/login" label="Sign in" Icon={LogIn} on="bg-ocean" onClick={close} /><Tile to="/register" label="Join" Icon={UserPlus} on="bg-coral" solid="bg-coral" onClick={close} /></>}</nav>}
  </header>);
}
