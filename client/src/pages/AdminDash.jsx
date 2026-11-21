import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, LayoutDashboard, BadgeCheck, MapPinned, BedDouble, Utensils, Bus, Store, Gift, QrCode, BarChart3, Users, ScrollText, Plus, Pencil, Trash2, UserRound, Coins, Compass, Clock, Trophy } from 'lucide-react';
import { api, openQr, isDemo, resetAll, printQrSheet } from '../lib/api.js';
import { mode } from '../lib/mode.js';
import Cover from '../components/Cover.jsx';
import { Photo } from '../components/Photo.jsx';
import { DocsPanel, PaperLine } from '../components/Docs.jsx';
import { downloadCsv, PAPER_LABEL } from '../lib/reports.js';
import Brand from '../components/Brand.jsx';
import { useBranding, setBranding } from '../lib/branding.js';
import { Card, Form, useLoad, num, PageHeader, Stat, Badge, Drawer, EntityForm, Bars, Empty, btn, btnGhost, inp } from '../components/ui.jsx';
import FormPdfButton from '../components/FormPdfButton.jsx';

const TABS = [['overview', 'Overview', LayoutDashboard], ['approvals', 'Approvals', BadgeCheck], ['destinations', 'Destinations', MapPinned], ['stays', 'Stays', BedDouble], ['restaurants', 'Eat', Utensils], ['transport', 'Transport', Bus], ['businesses', 'Shops', Store], ['rewards', 'Rewards & points', Gift], ['branding', 'Branding', Palette], ['qr', 'QR codes', QrCode], ['reports', 'Reports', BarChart3], ['users', 'Users', Users], ['audit', 'Audit log', ScrollText]];
const CATS = ['Souvenir shops', 'Groceries', 'Tour operators', 'Other'].map(c => [c, c]);
const STATUS = [['approved', 'Approved (visible)'], ['pending', 'Pending'], ['suspended', 'Suspended (hidden)']];
const text = (k, label, extra = {}) => ({ k, label, ...extra });
const placeFields = (munis) => [text('name', 'Name', { req: 1 }), text('municipalityId', 'Municipality', { type: 'select', opts: munis.map(m => [m.id, m.name]), req: 1 }), text('cover', 'Cover photo (shown on the list and at the top of its page)', { type: 'image' }), text('photos', 'Photo album (shown on its page)', { type: 'gallery' }), text('description', 'Description', { type: 'textarea' }), text('address', 'Address'), text('phone', 'Phone'), text('lat', 'Latitude', { type: 'number' }), text('lng', 'Longitude', { type: 'number' }), text('hoursText', 'Opening hours (e.g. Daily 8:00 to 17:00)')];
const CONFIG = (munis, tiers) => ({
  destinations: { title: 'Destinations', Icon: MapPinned, noun: 'destination', fields: [text('name', 'Name', { req: 1 }), text('municipalityId', 'Municipality', { type: 'select', opts: munis.map(m => [m.id, m.name]), req: 1 }), text('cover', 'Cover photo (shown on Explore and the destination page)', { type: 'image' }), text('photos', 'Photo album (shown on the destination page)', { type: 'gallery' }), text('description', 'Description', { type: 'textarea' }), text('history', 'History', { type: 'textarea' }), text('address', 'Address'), text('lat', 'Latitude', { type: 'number' }), text('lng', 'Longitude', { type: 'number' }), text('entranceFee', 'Entrance fee (₱, 0 = free)', { type: 'number' }), text('travelMinutes', 'Minutes from Virac', { type: 'number' }), text('hoursText', 'Opening hours'), text('pointTierId', 'Difficulty / point tier', { type: 'select', opts: tiers.map(t => [t.id, `${t.name} (${t.points} pts)`]) }), text('facilities', 'Facilities (comma separated)'), text('accessibilityNotes', 'Accessibility notes', { type: 'textarea' }), text('safetyNotes', 'Safety reminders', { type: 'textarea' }), text('isPublished', 'Published (visible to tourists)', { type: 'checkbox' })] },
  stays: { title: 'Stays', Icon: BedDouble, noun: 'stay', docs: true, fields: [...placeFields(munis), text('type', 'Type', { type: 'select', req: 1, opts: ['hotel', 'resort', 'inn', 'staycation', 'homestay', 'private'].map(t => [t, t]) }), text('amenities', 'Amenities (comma separated)'), text('status', 'Visibility', { type: 'select', opts: STATUS })],
    subs: [{ key: 'rooms', title: 'Rooms', fields: [text('name', 'Room name', { req: 1 }), text('capacity', 'Sleeps', { type: 'number', req: 1 }), text('pricePerNight', 'Price per night (₱)', { type: 'number', req: 1 }), text('quantity', 'Units available', { type: 'number' })] }] },
  restaurants: { title: 'Eat', Icon: Utensils, noun: 'restaurant', docs: true, fields: [...placeFields(munis), text('cuisines', 'Cuisines (comma separated)'), text('priceRange', 'Price level', { type: 'select', opts: [[1, '₱ budget'], [2, '₱₱ moderate'], [3, '₱₱₱ upscale'], [4, '₱₱₱₱ fine dining']] }), text('status', 'Visibility', { type: 'select', opts: STATUS }), text('acceptsReservations', 'Accepts table reservations', { type: 'checkbox' })],
    subs: [{ key: 'menu', title: 'Menu', fields: [text('itemName', 'Dish', { req: 1 }), text('price', 'Price (₱)', { type: 'number', req: 1 }), text('description', 'Description')] }] },
  transport: { title: 'Transport', Icon: Bus, noun: 'transport provider', docs: true, fields: [text('name', 'Provider name', { req: 1 }), text('cover', 'Cover photo (shown with this provider)', { type: 'image' }), text('photos', 'Photo album (shown on the provider\'s vehicle pages)', { type: 'gallery' }), text('phone', 'Phone'), text('status', 'Status', { type: 'select', opts: STATUS })],
    subs: [{ key: 'vehicles', title: 'Vehicles', fields: [text('name', 'Vehicle name', { req: 1 }), text('type', 'Type', { type: 'select', req: 1, opts: ['tricycle', 'van', 'multicab', 'motorcycle', 'car', 'other'].map(t => [t, t]) }), text('capacity', 'Seats', { type: 'number', req: 1 }), text('plateNo', 'Plate number'), text('driverName', 'Driver'), text('rentDriver', 'Rent per day WITH driver (₱, empty = not offered)', { type: 'number' }), text('rentSelf', 'Rent per day SELF-DRIVE (₱, empty = not offered)', { type: 'number' }), text('description', 'Description', { type: 'textarea' }), text('cover', 'Vehicle cover photo (shown on the Roam list)', { type: 'image' }), text('photos', 'Vehicle photo album', { type: 'gallery' })], editable: true }, { key: 'routes', title: 'Routes and fares', fields: [text('origin', 'Pickup (e.g. Virac Airport)', { req: 1 }), text('destination', 'Drop-off', { req: 1 }), text('fare', 'Fare (₱)', { type: 'number', req: 1 }), text('estMinutes', 'Minutes', { type: 'number' })] }] },
  businesses: { title: 'Shops', Icon: Store, noun: 'shop', docs: true, fields: [...placeFields(munis), text('category', 'Category', { type: 'select', opts: CATS }), text('status', 'Visibility', { type: 'select', opts: STATUS })] },
  rewards: { title: 'Rewards', Icon: Gift, noun: 'reward', fields: [text('name', 'Reward name', { req: 1 }), text('cover', 'Cover photo', { type: 'image' }), text('photos', 'Photo album', { type: 'gallery' }), text('description', 'Description', { type: 'textarea' }), text('pointsCost', 'Points cost', { type: 'number', req: 1 }), text('stock', 'Stock (empty = unlimited)', { type: 'number' }), text('isActive', 'Available to redeem', { type: 'checkbox' })] },
});

function Manage({ kind, cfg, head }) {
  const [rows, reload, err] = useLoad(() => api(`/admin/manage/${kind}`), [kind]); const [edit, setEdit] = useState(null); const [note, setNote] = useState(''); const [subEdit, setSubEdit] = useState(null);
  const cur = edit && edit !== 'new' ? rows?.find(r => r.id === edit.id) || edit : null;
  const initial = cur ? { ...cur, isActive: cur.isActive ?? true } : { status: 'approved', isActive: true, isPublished: true, capacity: '', type: kind === 'stays' ? 'inn' : '' };
  async function save(v) {
    if (edit === 'new') { const r = await api(`/admin/manage/${kind}`, { method: 'POST', body: v }); await reload(); setEdit(cfg.subs || cfg.docs ? r : null); setNote(`${cfg.noun[0].toUpperCase() + cfg.noun.slice(1)} added.${cfg.subs ? ' You can now add its ' + cfg.subs.map(s => s.title.toLowerCase()).join(' and ') + ' below.' : ''}${cfg.docs ? ' Add its business papers below.' : ''}`); }
    else { await api(`/admin/manage/${kind}/${edit.id}`, { method: 'PUT', body: v }); await reload(); setNote('Changes saved.'); }
  }
  async function remove(r) { if (confirm(`Delete "${r.title}"? Related bookings and QR codes are removed too. This can't be undone.`)) { try { await api(`/admin/manage/${kind}/${r.id}`, { method: 'DELETE' }); await reload(); setNote('Deleted.'); } catch (e) { setNote(e.message); } } }
  const sub = async (s, fn) => { try { await fn(); await reload(); } catch (e) { throw e; } };
  return (<div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-3xl">{cfg.title}</h2><p className="text-sm text-ocean/65">{rows ? `${rows.length} listed` : 'Loading…'}</p></div><button className={`${btn} inline-flex items-center gap-2`} onClick={() => { setNote(''); setEdit('new'); }}><Plus size={16} />Add {cfg.noun}</button></div>
    {head}{note && <p role="status" className="mb-4 rounded-xl bg-teal/10 p-3 text-sm">{note}</p>}{err && <p role="alert" className="mb-4 text-red-700">{err}</p>}
    {rows && rows.length === 0 ? <Empty Icon={cfg.Icon}>Nothing here yet. Add your first {cfg.noun}.</Empty> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(rows || []).map(r => <article key={r.id} className="lift overflow-hidden rounded-3xl border border-line bg-white">
      <Cover name={r.title} photo={r.cover} className="h-32"><span className="absolute right-3 top-3"><Badge s={r.status} /></span></Cover>
      <div className="p-4"><h3 className="font-display text-lg leading-tight">{r.title}</h3><p className="mt-1 text-sm text-ocean/65">{r.sub}</p>{cfg.docs && <PaperLine p={r.papers} />}<div className="mt-3 flex gap-2"><button className={`${btnGhost} inline-flex items-center gap-1`} onClick={() => { setNote(''); setEdit(r); }}><Pencil size={14} />Edit</button><button className={`${btnGhost} inline-flex items-center gap-1 text-red-700`} onClick={() => remove(r)}><Trash2 size={14} />Delete</button></div></div></article>)}</div>}
    <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? `Add ${cfg.noun}` : `Edit ${cfg.noun}`}>
      <EntityForm key={cur?.id || 'new'} fields={cfg.fields} initial={initial} onSubmit={save} label={edit === 'new' ? `Add ${cfg.noun}` : 'Save changes'} />
      {note && <p role="status" className="mt-3 rounded-xl bg-teal/10 p-3 text-sm">{note}</p>}
      {edit === 'new' && cfg.docs && <p className="mt-6 rounded-xl bg-foam p-3 text-sm">After you save, you can add the business papers (BIR registration, business registration, permits) right here.</p>}
      {cur && cfg.docs && <section className="mt-8 border-t border-line pt-5"><h3 className="font-display text-2xl">Business papers</h3><p className="mb-3 text-sm text-ocean/70">Papers you add here are marked verified. A listing from a business owner can only be approved once every required paper is verified. Tourists see the checklist on the business page.</p><DocsPanel base={`/admin/docs/${kind}/${cur.id}`} admin onChange={reload} /></section>}
      {cur && (cfg.subs || []).map(s => <section key={s.key} className="mt-8 border-t border-line pt-5"><h3 className="font-display text-2xl">{s.title}</h3>
        <ul className="my-3 grid gap-2">{(cur[s.key] || []).length === 0 && <li className="text-sm text-ocean/60">None yet.</li>}{(cur[s.key] || []).map(it => subEdit === it.id ? <li key={it.id} className="rounded-xl border-2 border-teal bg-white p-3"><EntityForm fields={s.fields} initial={it} label="Save changes" onSubmit={async v => { await api(`/admin/manage/${kind}/${cur.id}/${s.key}/${it.id}`, { method: 'PUT', body: v }); setSubEdit(null); await reload(); }} /><button type="button" className="mt-2 text-sm underline" onClick={() => setSubEdit(null)}>Cancel</button></li>
          : <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-sm"><span className="flex items-center gap-3">{it.cover && <Photo src={it.cover} alt="" className="h-10 w-10 rounded-lg object-cover" />}<span>{it.text}</span></span><span className="flex shrink-0 items-center gap-3">{s.editable && <button className="underline" onClick={() => setSubEdit(it.id)}>Edit</button>}<button aria-label="Remove" className="text-red-700" onClick={() => sub(s, () => api(`/admin/manage/${kind}/${cur.id}/${s.key}/${it.id}`, { method: 'DELETE' }))}><Trash2 size={16} /></button></span></li>)}</ul>
        <EntityForm key={s.key + cur.id + (cur[s.key] || []).length} compact fields={s.fields} onSubmit={v => sub(s, () => api(`/admin/manage/${kind}/${cur.id}/${s.key}`, { method: 'POST', body: v }))} label={`Add to ${s.title.toLowerCase()}`} /></section>)}
    </Drawer></div>);
}

export default function AdminDash() {
  const [tab, setTab] = useState('overview'); const [msg, setMsg] = useState('');
  const [stats, rs] = useLoad(() => api('/admin/stats')); const [rep] = useLoad(() => api('/admin/reports'), [tab]); const [biz, rb] = useLoad(() => api('/admin/businesses/pending')); const [prov, rp] = useLoad(() => api('/admin/point-tiers').then(() => api('/admin/providers/pending')));
  const [munis] = useLoad(() => api('/municipalities')); const [tiers, rt] = useLoad(() => api('/admin/point-tiers')); const [users, ru] = useLoad(() => api('/admin/users')); const [audit] = useLoad(() => api('/admin/audit'), [tab]);
  const run = async (fn, after) => { try { await fn(); setMsg('Saved.'); after?.(); rs(); } catch (e) { setMsg(e.message); return false; } };
  const pending = (biz?.length || 0) + (prov?.length || 0); const cfg = munis && tiers ? CONFIG(munis, tiers) : null;
  return (<main className="mx-auto max-w-7xl px-4 py-6">
    <PageHeader title="Tourism office" sub="Add, edit and remove everything tourists see, and manage approvals, rewards and reports." />
    <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto rounded-3xl border border-line bg-white p-2 lg:sticky lg:top-24 lg:grid lg:self-start">{TABS.map(([id, label, Icon]) => <button key={id} onClick={() => { setTab(id); setMsg(''); }} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl px-3 py-2 text-left text-sm ${tab === id ? 'bg-ocean text-foam' : 'hover:bg-sand/50'}`}><Icon size={17} />{label}{id === 'approvals' && pending > 0 && <span className="ml-auto rounded-full bg-tang px-2 text-xs text-white">{pending}</span>}</button>)}</nav>
      <div className="min-w-0">{msg && <p role="status" className="mb-4 rounded-xl bg-teal/10 p-3 text-sm">{msg}</p>}
        {tab === 'overview' && <div className="grid gap-5">
          {stats && <div className="grid grid-cols-2 gap-3 xl:grid-cols-3"><Stat Icon={UserRound} label="Tourists" value={stats.tourists} /><Stat Icon={Store} tone="ocean" label="Approved businesses" value={stats.businesses} /><Stat Icon={MapPinned} tone="moss" label="Destinations" value={stats.destinations} /><Stat Icon={Coins} tone="gold" label="Points issued" value={stats.pointsIssued} /><Stat Icon={Gift} label="Rewards redeemed" value={stats.redemptions} /><Stat Icon={Clock} tone="ocean" label="Waiting for approval" value={pending} /></div>}
          <div className="grid gap-5 md:grid-cols-2"><Card title="Check-ins by month"><Bars data={(rep?.checkinsByMonth || []).map(m => ({ label: m.month, value: m.n }))} empty="No check-ins yet. Scan a QR as a tourist to see this fill up." /></Card><Card title="Most visited places"><Bars data={(rep?.topDestinations || []).map(m => ({ label: m.name, value: m.visits }))} empty="No visits yet." /></Card></div>
          <Card title="Quick actions"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['destinations', 'Add a destination', MapPinned], ['stays', 'Add a stay', BedDouble], ['restaurants', 'Add a restaurant', Utensils], ['transport', 'Add transport', Bus]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className="lift flex flex-col items-start gap-3 rounded-2xl border border-line bg-foam p-4 text-left font-medium"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white"><I size={18} /></span>{l}</button>)}</div>{isDemo && <p className="mt-4 text-xs text-ocean/60">{mode.shared ? 'Data is shared by every visitor.' : 'Sample data lives in this browser only.'} <button className="underline" onClick={() => confirm('Reset all data back to the starting sample data?') && resetAll()}>Reset to starting data</button></p>}</Card></div>}
        {tab === 'approvals' && <Card title="Waiting for approval">{pending === 0 && <Empty Icon={BadgeCheck}>Nothing waiting. New business and transport sign-ups appear here.</Empty>}
          {[...(biz || []).map(b => ({ ...b, label: 'Business', email: b.owner_email, path: 'businesses', docs: `/admin/docs/businesses/${b.id}`, done: rb })), ...(prov || []).map(b => ({ ...b, label: 'Transport', path: 'providers', docs: `/admin/docs/transport/${b.id}`, done: rp }))].map(b => <ApprovalRow key={b.id} b={b} run={run} />)}</Card>}
        {cfg && ['destinations', 'stays', 'restaurants', 'transport', 'businesses'].includes(tab) && <Manage key={tab} kind={tab} cfg={cfg[tab]} />}
        {cfg && tab === 'rewards' && <Manage key="rewards" kind="rewards" cfg={cfg.rewards} head={<div className="mb-5 grid gap-5 md:grid-cols-2">
          <Card title="Point values by difficulty"><div className="grid gap-3">{(tiers || []).map(t => <Form key={t.id + '-' + t.points} label="Save" fields={[['points', `${t.name} (now ${t.points} pts)`, 'number']]} onSubmit={v => run(() => api(`/admin/point-tiers/${t.id}`, { method: 'PUT', body: { points: Number(v.points) } }), rt)} />)}</div></Card>
          <Card title="Validate a claim code"><p className="mb-3 text-sm text-ocean/70">When a tourist shows a redemption code, enter it here to mark it as claimed. Each code works once.</p><Form label="Mark claimed" fields={[['code', 'Claim code']]} onSubmit={v => run(() => api('/rewards/claim', { method: 'POST', body: { code: v.code } }))} /></Card></div>} />}
        {tab === 'branding' && <BrandingPanel />}
        {tab === 'qr' && <QrPanel run={run} />}
        {tab === 'reports' && <><RegistryReport /><FormCard /></>}
        {tab === 'reports' && rep && <div className="grid gap-5 md:grid-cols-2"><Card title="Check-ins per month"><Bars data={rep.checkinsByMonth.map(m => ({ label: m.month, value: m.n }))} /></Card><Card title="Bookings per month"><Bars data={rep.bookingsByMonth.map(m => ({ label: m.month, value: m.n }))} /></Card><Card title="Most visited destinations"><Bars data={rep.topDestinations.map(m => ({ label: m.name, value: m.visits }))} /></Card>
          <Card title="Payments (sandbox)">{rep.payments.length === 0 ? <p className="text-sm text-ocean/60">No payments yet.</p> : rep.payments.map(p => <p key={p.status} className="flex justify-between border-b border-line py-2 text-sm"><Badge s={p.status} /> <span>{p.n} payment(s) · ₱{p.total.toLocaleString()}</span></p>)}</Card></div>}
        {tab === 'users' && <UsersPanel users={users} run={run} reload={ru} />}
        {tab === 'audit' && <AuditLog audit={audit} />}
      </div></div></main>);
}

function QrPanel({ run }) {
  const [qrs, rq] = useLoad(() => api('/admin/qr')); const [type, setType] = useState('destination');
  const kindOf = { destination: 'destinations', accommodation: 'stays', restaurant: 'restaurants', business: 'businesses' }[type];
  const [opts] = useLoad(() => api(`/admin/manage/${kindOf}`), [kindOf]);
  return (<div className="grid gap-5"><Card title="Create a check-in QR code"><div className="mb-3 flex flex-wrap gap-2">{[['destination', 'Destination'], ['accommodation', 'Stay'], ['restaurant', 'Restaurant'], ['business', 'Business']].map(([v, l]) => <button key={v} onClick={() => setType(v)} className={`rounded-full border px-4 py-1.5 text-sm ${type === v ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white'}`}>{l}</button>)}</div>
    <Form key={type} label="Create QR" fields={[['listingId', 'Place', null, (opts || []).map(o => [o.id, o.title])], ['pointsOverride', 'Points override (optional)', 'number'], ['cooldownHours', 'Cooldown hours', 'number']]}
      onSubmit={v => run(() => api('/admin/qr', { method: 'POST', body: { listingType: type, listingId: v.listingId, pointsOverride: num(v.pointsOverride), cooldownHours: Number(v.cooldownHours || 24) } }), rq)} /></Card>
    <Card title="All QR codes" action={<button className={btn} onClick={() => printQrSheet((qrs || []).filter(q => q.is_active), 'Check-in QR codes')}>Print QR sheet</button>}>{(qrs || []).map(q => <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm"><span><b>{q.name || 'Unnamed'}</b> · {q.listing_type} <Badge s={q.is_active ? 'approved' : 'cancelled'}>{q.is_active ? 'active' : 'deactivated'}</Badge></span><span className="flex gap-3"><button className="underline" onClick={() => openQr(q.id)}>View / print</button>{q.is_active && <button className="underline text-red-700" onClick={() => run(() => api(`/admin/qr/${q.id}/deactivate`, { method: 'PATCH' }), rq)}>Deactivate</button>}</span></div>)}</Card></div>);
}

function BrandingPanel() {
  const b = useBranding(), [note, setNote] = useState('');
  const fields = [text('siteName', 'Site name (also the browser tab title)', { req: 1 }), text('tagline', 'Tagline (shown in the footer)'),
    text('logo', 'Main logo (header, footer and browser tab icon)', { type: 'image', keepAlpha: true, square: true, empty: 'Using the built-in logo.', upload: 'Upload new logo', replace: 'Replace logo', removeLabel: 'Use the built-in logo' }),
    text('showPartner', 'Show the developer badge next to the logo', { type: 'checkbox' }),
    text('partnerLogo', 'Developer badge logo', { type: 'image', keepAlpha: true, empty: 'Using the built-in developer logo.', upload: 'Upload badge logo', replace: 'Replace badge logo', removeLabel: 'Use the built-in badge logo' }),
    text('partnerBackdrop', 'Badge background', { type: 'select', opts: [['navy', 'Navy (best for light or white logos)'], ['white', 'White'], ['none', 'None (transparent)']] })];
  return (<div className="grid gap-5"><Card title="How the header looks now"><div className="rounded-2xl border border-line bg-foam p-4"><Brand /></div><p className="mt-3 text-sm text-ocean/70">A PNG with a transparent background and a roughly square shape works best. Images are resized automatically and the browser tab icon follows the main logo.</p></Card>
    <Card title="Branding"><EntityForm key={JSON.stringify(b)} fields={fields} initial={b} label="Save branding" onSubmit={async v => { const r = await api('/branding', { method: 'PUT', body: v }); setBranding(r); setNote('Saved. Every visitor sees the new branding within a few seconds.'); }} />{note && <p role="status" className="mt-3 rounded-xl bg-teal/10 p-3 text-sm">{note}</p>}</Card></div>);
}

function ApprovalRow({ b, run }) {
  const [open, setOpen] = useState(false), ok = b.papers?.status === 'complete';
  const set = (status) => run(() => api(`/admin/${b.path}/${b.id}/status`, { method: 'PATCH', body: { status } }), b.done);
  return (<div className="border-b border-line py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><Badge s="pending">{b.label}</Badge> <b className="ml-1">{b.name}</b><p className="text-sm text-ocean/60">{b.email}</p><PaperLine p={b.papers} /></div>
    <div className="flex flex-wrap gap-2"><button className={btnGhost} onClick={() => setOpen(!open)}>{open ? 'Hide papers' : 'Review papers'}</button><button className={`${btn} disabled:opacity-40`} disabled={!ok} title={ok ? '' : 'Verify every required paper first'} onClick={() => set('approved')}>Approve</button><button className={btnGhost} onClick={() => set('rejected')}>Reject</button></div></div>
    {!ok && <p className="mt-1 text-xs text-ocean/60">Approve unlocks when every required paper is verified.</p>}
    {open && <div className="mt-3 rounded-2xl bg-foam p-4"><DocsPanel base={b.docs} admin onChange={b.done} /></div>}</div>);
}
function RegistryReport() {
  const [f, setF] = useState({ type: 'all', status: 'all', papers: 'all' }), [busy, setBusy] = useState(''), brand = useBranding(), qs = new URLSearchParams(f).toString();
  const [data] = useLoad(() => api(`/admin/business-report?${qs}`), [qs]); const rows = data?.rows || [], day = new Date().toISOString().slice(0, 10), base = `${brand.siteName.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'Report'}-Business-Report-${day}`;
  const sel = 'rounded-xl border border-line bg-white px-3 py-2 text-sm', Opt = (o) => o.map(([v, l]) => <option key={v} value={v}>{l}</option>);
  async function pdf() { setBusy('pdf'); try { const { downloadPdf } = await import('../lib/reports.js'); await downloadPdf(rows, { title: `${brand.siteName} registered businesses`, filters: f, generated: data.generated, fileName: `${base}.pdf` }); } finally { setBusy(''); } }
  return (<Card title="Registered businesses report"><p className="mb-3 text-sm text-ocean/70">Every stay, restaurant, shop and transport provider on the platform, with their status and whether their required papers are complete. Download it for your records or to print.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium text-ocean/70">Type<select className={sel} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Opt([['all', 'All types'], ['stays', 'Stays'], ['restaurants', 'Eat'], ['shops', 'Shops'], ['transport', 'Transport']])}</select></label>
      <label className="grid gap-1 text-xs font-medium text-ocean/70">Status<select className={sel} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Opt([['all', 'Any status'], ['approved', 'Approved'], ['pending', 'Pending'], ['rejected', 'Rejected'], ['suspended', 'Suspended']])}</select></label>
      <label className="grid gap-1 text-xs font-medium text-ocean/70">Papers<select className={sel} value={f.papers} onChange={e => setF({ ...f, papers: e.target.value })}>{Opt([['all', 'Any'], ['complete', 'Complete'], ['review', 'Under review'], ['incomplete', 'Incomplete']])}</select></label>
      <button disabled={!rows.length} className={`${btn} disabled:opacity-40`} onClick={() => downloadCsv(rows, `${base}.csv`)}>Download CSV (Excel)</button><button disabled={!rows.length || busy} className={`${btn} disabled:opacity-40`} onClick={pdf}>{busy ? 'Making PDF…' : 'Download PDF'}</button></div>
    <p className="mt-3 text-sm font-medium">{data ? `${rows.length} business${rows.length === 1 ? '' : 'es'} match` : 'Loading…'}</p>
    {rows.length > 0 && <div className="mt-2 max-h-[18rem] overflow-auto rounded-2xl border border-line"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="sticky top-0 z-10 bg-foam text-xs uppercase text-ocean/60"><tr><th className="p-2">Business</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">Papers</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-line"><td className="p-2">{r.name}</td><td className="p-2">{r.type}</td><td className="p-2"><Badge s={r.status} /></td><td className="p-2">{PAPER_LABEL[r.papers]}</td></tr>)}</tbody></table></div>}</Card>);
}
function FormCard() {
  const F = '/forms/TRISIKSTI-Business-Application-Form';
  return (<Card title="Business application form"><p className="mb-3 text-sm text-ocean/70">Give this form to businesses that want to be listed. It is also on the public <a className="underline" href="/join">Join page</a>, which explains the steps and required papers.</p><div className="flex flex-wrap gap-3"><FormPdfButton className={btn}>Download PDF (fillable)</FormPdfButton><a className={btnGhost} href={`${F}.docx`} download>Download Word (.docx)</a></div></Card>);
}

// Audit log grouped by day: newest days first, the two latest days open, older days collapsed. Filter by date or text.
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA');
const dayLabel = (key) => {
  const t = dayKey(Date.now()), y = dayKey(Date.now() - 864e5), nice = new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return key === t ? 'Today · ' + nice : key === y ? 'Yesterday · ' + nice : nice;
};
function AuditLog({ audit }) {
  const [day, setDay] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState({});
  const term = q.trim().toLowerCase(), filtering = !!day || !!term;
  const rows = [...(audit || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter(a => (!day || dayKey(a.created_at) === day) && (!term || `${a.actor} ${a.action} ${a.entity_id || ''}`.toLowerCase().includes(term)));
  const groups = []; rows.forEach(a => { const k = dayKey(a.created_at), g = groups[groups.length - 1]; if (g && g.key === k) g.items.push(a); else groups.push({ key: k, items: [a] }); });
  const isOpen = (g, i) => open[g.key] ?? (filtering || i < 2);
  const setAll = (v) => setOpen(Object.fromEntries(groups.map(g => [g.key, v])));
  return (
    <Card title="Audit log" action={groups.length > 1 && <span className="flex gap-2"><button className={btnGhost} onClick={() => setAll(true)}>Expand all</button><button className={btnGhost} onClick={() => setAll(false)}>Collapse all</button></span>}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ocean/60">Date<input type="date" max={dayKey(Date.now())} value={day} onChange={e => setDay(e.target.value)} className={inp + ' mt-1 block'} /></label>
        <label className="min-w-[12rem] flex-1 text-xs text-ocean/60">Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Action or admin, e.g. stays.create" className={inp + ' mt-1 block w-full'} /></label>
        {filtering && <button className={btnGhost} onClick={() => { setDay(''); setQ(''); }}>Clear filters</button>}
      </div>
      {(audit || []).length === 0 && <p className="text-sm text-ocean/60">No admin actions yet.</p>}
      {(audit || []).length > 0 && groups.length === 0 && <p className="text-sm text-ocean/60">No actions match these filters.</p>}
      {groups.map((g, i) => (
        <section key={g.key} className="mb-2 overflow-hidden rounded-2xl border border-line">
          <button type="button" aria-expanded={isOpen(g, i)} onClick={() => setOpen(o => ({ ...o, [g.key]: !isOpen(g, i) }))} className="flex w-full items-center justify-between gap-3 bg-foam px-4 py-2.5 text-left">
            <span className="flex items-center gap-2 font-semibold text-ocean">{isOpen(g, i) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{dayLabel(g.key)}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-ocean/70">{g.items.length} action{g.items.length === 1 ? '' : 's'}</span>
          </button>
          {isOpen(g, i) && <div className="px-4 pb-1">{g.items.map((a, j) => <p key={j} className="border-b border-line py-1.5 text-sm last:border-0"><span className="inline-block w-24 text-ocean/55">{new Date(a.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span> · {a.actor} · <b>{a.action}</b></p>)}</div>}
        </section>
      ))}
    </Card>
  );
}

// Users split by account type so the admin does not scroll one long mixed list.
const ROLE_GROUPS = [['tourist', 'Tourists'], ['business_owner', 'Business owners'], ['transport_provider', 'Transport providers'], ['admin', 'Admins']];
function UsersPanel({ users, run, reload }) {
  const [open, setOpen] = useState({}), [note, setNote] = useState('');
  const list = users || [], known = ROLE_GROUPS.map(g => g[0]);
  const groups = ROLE_GROUPS.map(([role, label]) => ({ role, label, items: list.filter(u => u.role === role) })).filter(g => g.items.length);
  const other = list.filter(u => !known.includes(u.role)); if (other.length) groups.push({ role: 'other', label: 'Other', items: other });
  return (<Card title="Users" action={<span className="text-sm text-ocean/60">{list.length} accounts</span>}>
    <div className="mb-4 rounded-2xl bg-foam p-4"><h3 className="font-display text-lg">Add an admin account</h3><p className="mb-3 text-sm text-ocean/70">Admin accounts can only be created here, by a signed-in admin. They cannot be created from the public sign-up page.</p>
      <Form label="Create admin" fields={[['fullName', 'Full name'], ['email', 'Email', 'email'], ['password', 'Password (8+ characters)', 'password']]} onSubmit={async v => { const ok = await run(() => api('/admin/users', { method: 'POST', body: v }), reload); setNote(ok === false ? '' : 'Admin account created. They can sign in now.'); return ok; }} />{note && <p role="status" className="mt-3 rounded-xl bg-teal/10 p-3 text-sm">{note}</p>}</div>
    {!users && <p className="text-sm text-ocean/60">Loading…</p>}
    {groups.map(g => { const isOpen = open[g.role] ?? true; return (<section key={g.role} className="mb-3 overflow-hidden rounded-2xl border border-line">
      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(o => ({ ...o, [g.role]: !isOpen }))} className="flex w-full items-center justify-between gap-3 bg-foam px-4 py-2.5 text-left">
        <span className="flex items-center gap-2 font-semibold text-ocean">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{g.label}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-ocean/70">{g.items.length}</span></button>
      {isOpen && <div className="max-h-[24rem] overflow-y-auto px-4">{g.items.map(u => <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-b-0"><span><b>{u.full_name}</b> · {u.email}</span><span className="flex items-center gap-3">{!u.is_active && <Badge s="suspended">inactive</Badge>}<button className="underline" onClick={() => run(() => api(`/admin/users/${u.id}/active`, { method: 'PATCH', body: { active: !u.is_active } }), reload)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</button></span></div>)}</div>}
    </section>); })}
  </Card>);
}
