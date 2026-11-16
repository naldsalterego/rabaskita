import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Store } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Form, useLoad, PageHeader, Badge, btn, btnGhost } from '../components/ui.jsx';
import OwnerBusiness from './OwnerBusiness.jsx';
const CATEGORIES = ['Hotels and resorts', 'Staycation houses', 'Restaurants', 'Cafes', 'Souvenir shops', 'Groceries', 'Tour operators', 'Other'];
// The owner's home: pick one of your businesses and manage everything about it in one place.
export default function OwnerDash() {
  const [params, setParams] = useSearchParams(), [list, reloadList] = useLoad(() => api('/owner/businesses')), [munis] = useLoad(() => api('/municipalities'));
  const [adding, setAdding] = useState(false), [msg, setMsg] = useState('');
  const patch = (o) => setParams(prev => { const n = new URLSearchParams(prev); for (const [k, v] of Object.entries(o)) v == null ? n.delete(k) : n.set(k, v); return n; }, { replace: true });
  const sel = list?.find(x => x.id === params.get('b'))?.id || list?.[0]?.id, showForm = adding || (list && list.length === 0);
  async function register(v) {
    try { const r = await api('/businesses', { method: 'POST', body: { name: v.name, municipalityId: Number(v.municipalityId), category: v.category, address: v.address, phone: v.phone, description: v.description } }); await reloadList(); setAdding(false); setMsg(''); patch({ b: r.id, tab: 'papers' }); }
    catch (e) { setMsg(e.message); return false; }
  }
  return (<main className="mx-auto max-w-5xl px-4 py-6"><PageHeader title="Business dashboard" sub="Everything about your business in one place: your page, what you offer, and your reservations." />
    {list && list.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Your businesses">
      {list.length > 1 && list.map(b => <button key={b.id} role="tab" aria-selected={b.id === sel && !adding} onClick={() => { setAdding(false); patch({ b: b.id, tab: null }); }} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${b.id === sel && !adding ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`}><Store size={15} />{b.name}{b.pending > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-bold text-white" aria-label={`${b.pending} waiting`}>{b.pending}</span>}{b.status !== 'approved' && <Badge s={b.status}>{b.status === 'pending' ? 'pending' : b.status}</Badge>}</button>)}
      <button onClick={() => setAdding(!adding)} className={`${btnGhost} inline-flex items-center gap-1.5`}><Plus size={15} />{adding ? 'Close' : 'Register another business'}</button></div>}
    {showForm && <div className="mt-5"><Card title={list?.length ? 'Register another business' : 'Register your business'}><p className="mb-3 rounded-xl bg-foam p-3 text-sm">Tell us the basics. The tourism office approves your business after you give your required papers to the office. You can set up your page while you wait. <Link className="underline" to="/join">Get the application form</Link>.</p>
      {msg && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{msg}</p>}
      {munis && <Form label="Submit for approval" fields={[['name', 'Business name'], ['municipalityId', 'Municipality', null, munis.map(m => [m.id, m.name])], ['category', 'Category', null, CATEGORIES.map(c => [c, c])], ['address', 'Address (optional)'], ['phone', 'Phone (optional)'], ['description', 'Description (optional)']]} onSubmit={register} />}</Card></div>}
    {!showForm && sel && <OwnerBusiness key={sel} id={sel} tab={params.get('tab') || 'overview'} setTab={(t) => patch({ b: sel, tab: t })} onListChanged={reloadList} />}
    {!list && <p className="mt-6">Loading…</p>}
  </main>);
}
