import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Paintbrush, BedDouble, Utensils, ShoppingBag, CalendarCheck, FileCheck, ExternalLink, QrCode, Check, Circle, Clock, Coins, ListChecks, CalendarDays } from 'lucide-react';
import { api, openQr } from '../lib/api.js';
import { Card, Stat, Badge, useLoad, btn, btnGhost } from '../components/ui.jsx';
import Cover from '../components/Cover.jsx';
import { Photo } from '../components/Photo.jsx';
import { DocsPanel } from '../components/Docs.jsx';
import { CountBadge, albumOf } from '../components/Album.jsx';
import PageEditor from '../components/owner/PageEditor.jsx';
import ItemsPanel from '../components/owner/ItemsPanel.jsx';
import Reservations from '../components/owner/Reservations.jsx';
import Availability from '../components/owner/Availability.jsx';
const OFFER = { stays: ['offer', 'Rooms', BedDouble], restaurants: ['offer', 'Menu', Utensils], shops: ['offer', 'Products', ShoppingBag] };
const tabsFor = (b) => [['overview', 'Overview', LayoutDashboard], ['page', 'My page', Paintbrush], OFFER[b.kind], ...(b.kind === 'shops' ? [] : [['reservations', 'Reservations', CalendarCheck]]), ...(b.kind === 'stays' ? [['availability', 'Availability', CalendarDays]] : []), ['papers', 'Papers', FileCheck]];
const FIELDS = {
  rooms: [{ k: 'name', label: 'Room name', req: 1 }, { k: 'capacity', label: 'Sleeps (guests)', type: 'number', req: 1 }, { k: 'pricePerNight', label: 'Price per night (₱, final price with taxes and fees)', type: 'number', req: 1 }, { k: 'quantity', label: 'Units you have (0 pauses this room)', type: 'number' }],
  menu: [{ k: 'name', label: 'Dish or drink', req: 1 }, { k: 'price', label: 'Price (₱)', type: 'number', req: 1 }, { k: 'description', label: 'Short description (optional)', type: 'textarea' }],
  products: [{ k: 'name', label: 'Product name', req: 1 }, { k: 'price', label: 'Price (₱)', type: 'number', req: 1 }, { k: 'description', label: 'Short description (optional)', type: 'textarea' }, { k: 'photo', label: 'Product photo (optional)', type: 'image', empty: 'No photo yet.', upload: 'Upload product photo', replace: 'Change photo', removeLabel: 'Remove photo' }],
};
// A to-do list that shows how complete the public page is
function checklist(b) {
  const album = albumOf({ cover_photo: b.cover, photos: b.photos }).length, items = [['Add a cover photo', !!b.cover, 'page'], ['Add at least 3 photos to your album', album >= 3, 'page'], ['Write a description', b.description.trim().length >= 40, 'page'], ['Add your opening hours and phone', !!b.hoursText && !!b.phone, 'page']];
  if (b.kind === 'stays') items.push(['Add amenities', (b.amenities || '').length > 0, 'page'], ['Add a room people can book', b.rooms.some(r => r.quantity > 0), 'offer']);
  if (b.kind === 'restaurants') items.push(['Add your cuisines', (b.cuisines || '').length > 0, 'page'], ['Add dishes to your menu', b.menu.length > 0, 'offer'], ['Turn on table reservations (optional)', b.acceptsReservations, 'page']);
  if (b.kind === 'shops') items.push(['List your products', b.products.length > 0, 'offer']);
  items.push(['Get all your papers verified', b.papers.status === 'complete', 'papers']);
  return items;
}
export default function OwnerBusiness({ id, tab, setTab, onListChanged }) {
  const [b, reload, err] = useLoad(() => api(`/owner/business/${id}`), [id]); const [msg, setMsg] = useState('');
  const changed = () => { reload(); onListChanged?.(); };
  async function qr() { try { const q = await api('/owner/qr', { method: 'POST', body: { businessId: id } }); await openQr(q.id, 'owner'); } catch (e) { setMsg(e.message); } }
  if (err && !b) return <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>; if (!b) return <p className="mt-6">Loading…</p>;
  const tabs = tabsFor(b), cur = tabs.some(t => t[0] === tab) ? tab : 'overview', tabLabel = (t) => t[1];
  const todo = checklist(b), done = todo.filter(x => x[1]).length;
  return (<div className="mt-6">
    <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-4">
      <Cover name={b.name} photo={b.cover || b.photos[0]} className="h-20 w-28 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1"><h2 className="font-display text-2xl leading-tight">{b.name}</h2><p className="text-sm text-ocean/70">{b.municipality}{b.category ? ` · ${b.category}` : ''} <Badge s={b.status}>{b.status === 'pending' ? 'waiting for approval' : b.status}</Badge></p></div>
      <div className="flex flex-wrap gap-2">{b.publicPath && <Link to={b.publicPath} className={`${btnGhost} inline-flex items-center gap-1.5`}><ExternalLink size={14} />See it as a tourist</Link>}{b.status === 'approved' && <button onClick={qr} className={`${btnGhost} inline-flex items-center gap-1.5`}><QrCode size={14} />Check-in QR</button>}</div></section>
    {b.status !== 'approved' && <p className="mt-3 rounded-2xl bg-sand/50 p-3 text-sm">{b.status === 'pending' ? <>Your business is waiting for the tourism office. You can already set up your page, but tourists will only see it after approval. The quickest way to get approved is to give copies of your required papers to the tourism office; you can follow them under <button className="underline" onClick={() => setTab('papers')}>Papers</button>.</> : <>This business is {b.status}, so tourists cannot see it. Please contact the tourism office.</>}</p>}
    {msg && <p role="status" className="mt-3 rounded-lg bg-sand/60 p-3 text-sm">{msg}</p>}
    <nav aria-label="Business sections" className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist">{tabs.map(t => { const I = t[2], on = cur === t[0], n = t[0] === 'reservations' ? b.stats.pending : 0; return <button key={t[0]} role="tab" aria-selected={on} onClick={() => setTab(t[0])} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`}><I size={16} />{tabLabel(t)}{n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-bold text-white" aria-label={`${n} waiting for your reply`}>{n}</span>}</button>; })}</nav>
    <div className="mt-4">
      {cur === 'overview' && <div className="grid gap-5">
        <div className={`grid grid-cols-2 gap-3 ${b.kind === 'stays' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>{b.kind !== 'shops' && <><Stat Icon={Clock} tone="gold" label="Waiting for your reply" value={b.stats.pending} /><Stat Icon={CalendarCheck} label="Upcoming" value={b.stats.upcoming} /><Stat Icon={ListChecks} tone="ocean" label="All reservations" value={b.stats.total} /></>}{b.kind === 'stays' && <Stat Icon={Coins} tone="moss" label="Confirmed revenue" value={`₱${b.stats.revenue.toLocaleString()}`} />}{b.kind === 'shops' && <Stat Icon={ShoppingBag} label="Products listed" value={b.products.length} />}</div>
        {b.stats.pending > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tang/40 bg-sand/40 p-4"><p className="font-medium">{b.stats.pending} reservation{b.stats.pending === 1 ? ' is' : 's are'} waiting for your reply.</p><button className={btn} onClick={() => setTab('reservations')}>Review now</button></div>}
        <Card title={`Your page is ${Math.round(done / todo.length * 100)}% complete`}><p className="mb-3 text-sm text-ocean/70">A complete page gets more bookings. {done} of {todo.length} done.</p>
          <ul className="grid gap-1">{todo.map(([l, ok, to]) => <li key={l}><button onClick={() => setTab(to)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-foam">{ok ? <Check size={18} className="text-moss" /> : <Circle size={18} className="text-ocean/30" />}<span className={ok ? 'text-ocean/55 line-through' : ''}>{l}</span></button></li>)}</ul></Card>
        <Card title="How tourists see you in the list"><div className="max-w-sm overflow-hidden rounded-3xl border border-line bg-white"><Cover name={b.name} photo={b.cover || b.photos[0]} className="h-36"><CountBadge n={albumOf({ cover_photo: b.cover, photos: b.photos }).length} /></Cover><div className="p-4"><h3 className="font-display text-xl">{b.name}</h3><p className="text-sm text-teal">{b.municipality}{b.kind === 'restaurants' && b.cuisines ? ` · ${b.cuisines}` : ''}</p><p className="mt-1 line-clamp-2 text-sm text-ocean/75">{b.description || 'No description yet.'}</p></div></div></Card></div>}
      {cur === 'page' && <Card title="My page: how tourists see your business"><PageEditor key={b.id} b={b} onSaved={changed} /></Card>}
      {cur === 'offer' && b.kind === 'stays' && <Card title="Rooms"><ItemsPanel noun="room" items={b.rooms} fields={FIELDS.rooms} hint="Tourists can book the rooms you list here. Amenities (Wi-Fi, breakfast and so on) are under My page." empty="No rooms yet. Add your first room below so tourists can book it."
        initialOf={r => ({ name: r.name, capacity: r.capacity, pricePerNight: r.price, quantity: r.quantity })} addPath={`/owner/business/${b.id}/rooms`} itemPath={rid => `/owner/rooms/${rid}`} onChange={changed}
        row={r => <><div className="min-w-0"><p className="font-medium">{r.name}</p><p className="text-ocean/70">sleeps {r.capacity} · ₱{r.price.toLocaleString()} per night · {r.quantity === 0 ? <b className="text-red-700">paused</b> : `${r.quantity} unit${r.quantity === 1 ? '' : 's'}`}</p></div></>} /></Card>}
      {cur === 'offer' && b.kind === 'restaurants' && <Card title="Menu"><ItemsPanel noun="menu item" items={b.menu} fields={FIELDS.menu} hint="This is the menu tourists see on your page." empty="Your menu is empty. Add your dishes below."
        initialOf={m => ({ name: m.name, price: m.price, description: m.description })} addPath={`/owner/business/${b.id}/menu`} itemPath={mid => `/owner/menu-items/${mid}`} onChange={changed}
        row={m => <div className="min-w-0"><p className="font-medium">{m.name} · ₱{m.price.toLocaleString()}</p>{m.description && <p className="text-ocean/70">{m.description}</p>}</div>} /></Card>}
      {cur === 'offer' && b.kind === 'shops' && <Card title="Products"><ItemsPanel noun="product" items={b.products} fields={FIELDS.products} hint="Show tourists what you sell. Prices are for information; tourists pay you in the shop." empty="No products yet. Add what you sell below."
        initialOf={p => ({ name: p.name, price: p.price, description: p.description, photo: p.photo })} addPath={`/owner/business/${b.id}/products`} itemPath={pid => `/owner/products/${pid}`} onChange={changed}
        row={p => <>{p.photo ? <Photo src={p.photo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-foam text-ocean/40"><ShoppingBag size={18} /></span>}<div className="min-w-0"><p className="font-medium">{p.name} · ₱{p.price.toLocaleString()}</p>{p.description && <p className="text-ocean/70">{p.description}</p>}</div></>} /></Card>}
      {cur === 'availability' && b.kind === 'stays' && <Card title="Room availability"><Availability key={b.id} businessId={b.id} /></Card>}
      {cur === 'reservations' && <Card title={b.kind === 'stays' ? 'Bookings and reservations' : 'Table reservations'}>{b.kind === 'restaurants' && !b.acceptsReservations && <p className="mb-3 rounded-xl bg-foam p-3 text-sm">Online table reservations are off, so tourists cannot reserve yet. <button className="underline" onClick={() => setTab('page')}>Turn them on under My page</button>.</p>}<Reservations businessId={b.id} onChanged={changed} /></Card>}
      {cur === 'papers' && <Card title="Business papers"><p className="mb-3 rounded-xl bg-foam p-3 text-sm">The tourism office checks these before your business is approved. Tourists can see which papers are verified. <Link className="underline" to="/join">Get the application form</Link>.</p><DocsPanel base={`/owner/docs/${b.id}`} onChange={changed} /></Card>}
    </div>
  </div>);
}
