import { useState } from 'react';
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api, isDemo } from '../lib/api.js';
import { mode } from '../lib/mode.js';
import { Photo } from '../components/Photo.jsx';
import TileStrip from '../components/TileStrip.jsx';
import { ImageField, PageHeader, useLoad, btn, btnGhost } from '../components/ui.jsx';
const initials = (n) => n.replace(/^Engr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const TONES = ['from-coral to-tang', 'from-sky to-ocean', 'from-leaf to-teal', 'from-rose to-coral'];
const fld = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-teal';

export function Avatar({ m, i }) {
  return m.photo ? <Photo src={m.photo} alt={m.name} className="aspect-square w-full rounded-3xl object-cover" />
    : <div aria-hidden className={`grid aspect-square w-full place-items-center rounded-3xl bg-gradient-to-br font-display text-5xl font-bold text-white ${TONES[i % 4]}`}>{initials(m.name)}</div>;
}

export default function Credits() {
  const [c, reload, err] = useLoad(() => api('/credits')); const u = JSON.parse(localStorage.getItem('user') || 'null'), isAdmin = u?.role === 'admin';
  const [draft, setDraft] = useState(null), [up, setUp] = useState(0), [msg, setMsg] = useState('');
  const setM = (i, patch) => setDraft(d => ({ ...d, members: d.members.map((m, k) => (k === i ? { ...m, ...patch } : m)) }));
  const swap = (i, j) => setDraft(d => { const l = [...d.members]; [l[i], l[j]] = [l[j], l[i]]; return { ...d, members: l }; });
  async function save(e) { e.preventDefault(); setMsg(''); try { await api('/credits', { method: 'PUT', body: draft }); setDraft(null); await reload(); } catch (x) { setMsg(x.message); } }
  if (err) return <p className="p-8">{err}</p>; if (!c) return <p className="p-8">Loading…</p>;
  return (<main className="mx-auto max-w-6xl px-4 py-6"><PageHeader title="Credits" sub="The people behind this platform.">{isAdmin && !draft && <button className="rounded-full bg-sun px-5 py-2 font-display font-semibold text-ocean hover:bg-white" onClick={() => setDraft(structuredClone(c))}><Pencil size={15} className="mr-2 inline" />Edit credits</button>}</PageHeader>
    {draft ? <form onSubmit={save} className="mt-6 grid gap-5">
      {isDemo && !mode.shared && <p role="alert" className="rounded-2xl bg-amber-100 p-4 text-sm text-amber-900"><b>Heads up:</b> this site is not connected to shared storage ({mode.checked === 'no-function' ? 'the Netlify function was not found' : 'it could not be reached'}), so photos and edits are saved only in this browser. Other devices will show initials. See the shared deployment guide.</p>}
      <label className="grid gap-1 text-sm font-medium">Company name<input className={`${fld} text-lg`} value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })} required /></label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{draft.members.map((m, i) => <div key={m.id || i} className="grid content-start gap-3 rounded-3xl border border-line bg-white p-4">
        <ImageField f={{ label: 'Photo', square: true, empty: 'No photo yet. Initials are shown instead.', upload: 'Upload photo', replace: 'Replace photo' }} value={m.photo} onChange={v => setM(i, { photo: v })} setUp={setUp} />
        <input className={fld} placeholder="Full name" aria-label="Full name" value={m.name} onChange={e => setM(i, { name: e.target.value })} required /><input className={fld} placeholder="Role (optional)" aria-label="Role" value={m.role} onChange={e => setM(i, { role: e.target.value })} />
        <div className="flex gap-2"><button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => swap(i, i - 1)} className="rounded-xl border border-line p-2 disabled:opacity-30"><ArrowUp size={16} /></button><button type="button" aria-label="Move later" disabled={i === draft.members.length - 1} onClick={() => swap(i, i + 1)} className="rounded-xl border border-line p-2 disabled:opacity-30"><ArrowDown size={16} /></button><button type="button" aria-label="Remove member" onClick={() => setDraft({ ...draft, members: draft.members.filter((_, k) => k !== i) })} className="ml-auto rounded-xl border border-line p-2 text-red-700"><Trash2 size={16} /></button></div></div>)}
        <button type="button" onClick={() => setDraft({ ...draft, members: [...draft.members, { name: '', role: '', photo: '' }] })} className="grid min-h-[12rem] place-items-center rounded-3xl border-2 border-dashed border-teal text-teal"><span className="grid place-items-center gap-1"><Plus />Add member</span></button></div>
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
      <div className="flex gap-3"><button disabled={up > 0} className={`${btn} px-8 disabled:opacity-50`}>{up > 0 ? 'Uploading photos…' : 'Save credits'}</button><button type="button" className={btnGhost} onClick={() => setDraft(null)}>Cancel</button></div></form>
    : <>
      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-white text-center"><div className="px-6 py-10"><p className="eyebrow">Developed by</p><h2 className="mt-2 font-display text-5xl font-bold text-ocean md:text-6xl">{c.company}</h2></div><TileStrip className="h-8" /></section>
      <h2 className="mb-4 mt-10 text-center font-display text-3xl">The team</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{c.members.map((m, i) => <article key={m.id} className="lift rounded-3xl border border-line bg-white p-4 text-center"><Avatar m={m} i={i} /><h3 className="mt-4 font-display text-xl leading-tight">{m.name}</h3>{m.role && <p className="mt-1 text-sm text-ocean/70">{m.role}</p>}</article>)}</div>
      {c.members.length === 0 && <p className="text-center text-ocean/60">No team members listed yet.</p>}</>}
  </main>);
}
