import { useState } from 'react';
import { api, openQr } from '../lib/api.js';
import { Link } from 'react-router-dom';
import { DocsPanel } from '../components/Docs.jsx';
import { BedDouble, Clock, Coins, Store } from 'lucide-react';
import { Card, Form, useLoad, PageHeader, Stat, Badge, btn } from '../components/ui.jsx';
export default function OwnerDash() {
  const [biz, rb] = useLoad(() => api('/owner/businesses')); const [acc, ra] = useLoad(() => api('/owner/accommodations'));
  const [bk] = useLoad(() => api('/owner/bookings')); const [an] = useLoad(() => api('/owner/analytics')); const [munis] = useLoad(() => api('/municipalities'));
  const [rest, rr] = useLoad(() => api('/owner/restaurants'));
  const [msg, setMsg] = useState('');
  const run = async (fn, after) => { try { await fn(); setMsg('Saved.'); after?.(); } catch (e) { setMsg(e.message); return false; } };
  async function qr(businessId) {
    try { const q = await api('/owner/qr', { method: 'POST', body: { businessId } }); await openQr(q.id, 'owner'); } catch (e) { setMsg(e.message); }
  }
  const approved = (biz || []).filter(b => b.status === 'approved');
  return (<main className="mx-auto max-w-5xl px-4 py-6"><PageHeader title="Business dashboard" sub="Register your business, list rooms and menus, and watch bookings come in." />
    {msg && <p role="status" className="mb-3 rounded-lg bg-sand/60 p-3">{msg}</p>}
    {an && <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat Icon={Store} tone="ocean" label="Businesses" value={(biz || []).length} /><Stat Icon={BedDouble} label="Bookings" value={an.bookings} /><Stat Icon={Clock} tone="gold" label="Awaiting payment" value={an.pending} /><Stat Icon={Coins} tone="moss" label="Confirmed revenue" value={`₱${an.confirmed_revenue.toLocaleString()}`} /></div>}
    <Card title="Your businesses"><p className="mb-3 rounded-xl bg-foam p-3 text-sm">To be listed, upload your required papers under each business (<b>Business papers</b>). The tourism office verifies them before approving your listing. <Link className="underline" to="/join">Get the application form</Link>.</p>
      {(biz || []).map(b => <OwnerBiz key={b.id} b={b} qr={qr} />)}
      {munis && <div className="mt-2"><Form label="Submit for approval" fields={[['name', 'Business name'], ['municipalityId', 'Municipality', null, munis.map(m => [m.id, m.name])], ['category', 'Category', null, ['Souvenir shops', 'Groceries', 'Hotels and resorts', 'Staycation houses', 'Restaurants', 'Cafes', 'Tour operators', 'Other'].map(c => [c, c])], ['address', 'Address (optional)'], ['phone', 'Phone (optional)'], ['description', 'Description (optional)']]}
        onSubmit={v => run(() => api('/businesses', { method: 'POST', body: { name: v.name, municipalityId: Number(v.municipalityId), category: v.category, address: v.address, phone: v.phone, description: v.description } }), rb)} /></div>}</Card>
    {approved.length > 0 && <Card title="Add accommodation"><Form label="Add" fields={[['businessId', 'Business', null, approved.map(b => [b.id, b.name])], ['type', 'Type', null, ['hotel', 'resort', 'inn', 'staycation', 'homestay', 'private'].map(t => [t, t])]]}
      onSubmit={v => run(() => api('/owner/accommodations', { method: 'POST', body: v }), ra)} /></Card>}
    {(acc || []).map(a => <Card key={a.id} title={`${a.name} (${a.type})`}>{a.rooms.map(r => <p key={r.id} className="text-sm">{r.name} · sleeps {r.capacity} · ₱{r.price}/night · {r.quantity} unit(s)</p>)}
      <div className="mt-2"><Form label="Add room" fields={[['name', 'Room name'], ['capacity', 'Capacity', 'number'], ['pricePerNight', 'Price per night', 'number'], ['quantity', 'Units', 'number']]}
        onSubmit={v => run(() => api('/owner/rooms', { method: 'POST', body: { accommodationId: a.id, name: v.name, capacity: Number(v.capacity), pricePerNight: Number(v.pricePerNight), quantity: Number(v.quantity) } }), ra)} /></div></Card>)}
    {approved.length > 0 && <Card title="Restaurants"><Form label="Add restaurant" fields={[['businessId', 'Business', null, approved.map(b => [b.id, b.name])], ['cuisines', 'Cuisines, comma separated (optional)'], ['priceRange', 'Price level', null, [[1, '₱ budget'], [2, '₱₱ moderate'], [3, '₱₱₱ upscale'], [4, '₱₱₱₱ fine dining']]], ['acceptsReservations', 'Takes table reservations', 'checkbox']]}
      onSubmit={v => run(() => api('/owner/restaurants', { method: 'POST', body: { businessId: v.businessId, cuisines: (v.cuisines || '').split(',').map(x => x.trim()).filter(Boolean), priceRange: Number(v.priceRange), acceptsReservations: !!v.acceptsReservations } }), rr)} />
      {(rest || []).map(x => <div key={x.id} className="mt-3 border-t border-line pt-2"><b className="text-sm">{x.name}</b>{x.menu.map(m => <p key={m.id} className="text-sm">{m.name} · ₱{m.price}</p>)}
        <Form label="Add menu item" fields={[['itemName', 'Dish'], ['price', 'Price', 'number'], ['description', 'Description (optional)']]} onSubmit={v => run(() => api('/owner/menu-items', { method: 'POST', body: { restaurantId: x.id, itemName: v.itemName, price: Number(v.price), description: v.description } }), rr)} /></div>)}</Card>}
    <Card title="Guest bookings">{bk && !bk.length && <p className="text-sm">No bookings yet.</p>}{(bk || []).map(b => <p key={b.id} className="text-sm">{b.full_name} · {b.room} · {b.check_in.slice(0, 10)} to {b.check_out.slice(0, 10)} · {b.guests} guest(s) · ₱{b.total} · {b.status}</p>)}</Card>
  </main>);
}

function OwnerBiz({ b, qr }) {
  const [open, setOpen] = useState(false);
  return (<div className="border-b border-line py-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{b.name}</b> <Badge s={b.status}>{b.status === 'pending' ? 'waiting for approval' : b.status}</Badge></span><span className="flex gap-3"><button className="underline" onClick={() => setOpen(!open)}>{open ? 'Hide papers' : 'Business papers'}</button>{b.status === 'approved' && <button className="underline" onClick={() => qr(b.id)}>Get check-in QR</button>}</span></div>
    {open && <div className="mt-3 rounded-2xl bg-foam p-4"><DocsPanel base={`/owner/docs/${b.id}`} /></div>}</div>);
}
