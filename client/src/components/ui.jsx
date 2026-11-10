import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { X, ImagePlus, Trash2, ArrowLeft } from 'lucide-react';
import { Photo } from './Photo.jsx';
import { savePhoto } from '../lib/photos.js';
import TileStrip from './TileStrip.jsx';
export const inp = 'rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-teal';
export const btn = 'rounded-full bg-ocean text-foam px-5 py-2 text-sm font-medium';
export const btnGhost = 'rounded-full border border-line bg-white px-4 py-1.5 text-sm hover:border-teal';
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const reload = () => fn().then(setData).catch(e => setErr(e.message));
  const ver = useSyncVersion();
  useEffect(() => { reload(); }, [...deps, ver]); // eslint-disable-line
  return [data, reload, err];
}
export const num = (x) => (x === '' || x == null ? null : Number(x));
export const Card = ({ title, action, children }) => <section className="mb-5 rounded-3xl border border-line bg-white p-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-2xl">{title}</h2>{action}</div>{children}</section>;
export const PageHeader = ({ title, sub, children }) => (
  <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ocean via-[#3340B5] to-sky p-6 pb-12 text-foam md:p-8 md:pb-14">
    <div aria-hidden className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-sand/20 blur-2xl" />
    <div aria-hidden className="floaty absolute right-16 top-6 hidden h-10 w-10 rotate-45 bg-sun md:block" style={{ '--r': '45deg' }} /><div aria-hidden className="floaty absolute right-40 top-20 hidden h-6 w-6 rounded-full bg-coral md:block" /><div aria-hidden className="floaty absolute right-8 bottom-16 hidden h-8 w-8 rounded-full bg-aqua md:block" />
    <TileStrip className="absolute inset-x-0 bottom-0 h-6" />
    <div className="relative z-10 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-bold md:text-5xl">{title}</h1>{sub && <p className="mt-2 max-w-xl text-foam/80">{sub}</p>}</div>{children}</div></section>);
const TONES = { teal: 'bg-teal', ocean: 'bg-ocean', moss: 'bg-moss', gold: 'bg-tang' };
export const Stat = ({ Icon, label, value, tone = 'teal' }) => <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white ${TONES[tone]}`}><Icon size={22} /></span><div><p className="font-display text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs text-ocean/60">{label}</p></div></div>;
const BT = { pending: 'bg-amber-100 text-amber-900', confirmed: 'bg-teal/15 text-teal', approved: 'bg-teal/15 text-teal', published: 'bg-teal/15 text-teal', paid: 'bg-teal/15 text-teal', completed: 'bg-moss/20 text-moss', cancelled: 'bg-red-100 text-red-800', rejected: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800', draft: 'bg-slate-100 text-slate-700', hidden: 'bg-slate-100 text-slate-700' };
export const Badge = ({ s, children }) => <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BT[s] || 'bg-slate-100 text-slate-700'}`}>{children || s}</span>;
export const Empty = ({ Icon, children }) => <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ocean/60">{Icon && <Icon size={28} className="text-teal/60" />}{children}</div>;
export function Drawer({ open, onClose, title, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); if (open) addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex justify-end"><div className="absolute inset-0 bg-ocean/40 backdrop-blur-sm" onClick={onClose} /><aside role="dialog" aria-label={title} className="relative h-full w-full max-w-xl overflow-y-auto bg-foam p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-3xl">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-sand/50"><X /></button></div>{children}</aside></div>;
}
export function Bars({ data, empty = 'No data yet' }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return data.length ? <div className="grid gap-2">{data.map(d => <div key={d.label} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm"><span className="truncate">{d.label}</span><div className="h-3 rounded-full bg-foam"><div className="h-3 rounded-full bg-gradient-to-r from-teal to-ocean" style={{ width: `${(d.value / max) * 100}%` }} /></div><b>{d.value}</b></div>)}</div> : <p className="text-sm text-ocean/60">{empty}</p>;
}
const fld = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-teal';
function Uploader({ multiple, setUp, onDone, label, opts }) {
  const [err, setErr] = useState('');
  async function pick(e) {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; setErr(''); setUp(n => n + 1);
    try { const refs = []; for (const f of files) refs.push(await savePhoto(f, opts)); onDone(refs); } catch (x) { setErr(x.message); }
    setUp(n => n - 1);
  }
  return <><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-teal bg-white px-4 py-2 text-sm font-medium text-teal hover:bg-teal/5"><ImagePlus size={16} />{label}<input type="file" accept="image/*" multiple={multiple} className="sr-only" onChange={pick} /></label>{err && <p role="alert" className="text-sm text-red-700">{err}</p>}</>;
}
export function ImageField({ f, value, onChange, setUp }) {
  return <div className="grid gap-2 sm:col-span-2"><p className="text-xs font-medium text-ocean/70">{f.label}</p>
    {value ? <div className={`relative overflow-hidden rounded-2xl border border-line bg-foam ${f.square ? 'w-44' : ''}`}><Photo src={value} alt="Photo preview" className={`${f.square ? 'aspect-square w-44' : 'h-48 w-full'} object-cover`} /><button type="button" aria-label={f.removeLabel || 'Remove photo'} onClick={() => onChange('')} className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-700"><Trash2 size={16} /></button></div> : <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-ocean/60">{f.empty || 'No cover photo yet. Without one, a colorful placeholder is shown.'}</p>}
    <div><Uploader setUp={setUp} opts={f.keepAlpha ? { keepAlpha: true, max: 640 } : undefined} label={value ? (f.replace || 'Replace cover photo') : (f.upload || 'Upload cover photo')} onDone={r => onChange(r[0])} /></div></div>;
}
function GalleryField({ f, value, onChange, setUp }) {
  const list = value || [], move = (i) => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onChange(l); };
  return <div className="grid gap-2 sm:col-span-2"><p className="text-xs font-medium text-ocean/70">{f.label} <span className="font-normal">({list.length} photo{list.length === 1 ? '' : 's'})</span></p>
    {list.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{list.map((p, i) => <div key={p} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-foam"><Photo src={p} alt={`Album photo ${i + 1}`} className="h-full w-full object-cover" />
      <button type="button" aria-label="Remove photo" onClick={() => onChange(list.filter(x => x !== p))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-red-700"><Trash2 size={14} /></button>
      {i > 0 && <button type="button" aria-label="Move earlier" onClick={() => move(i)} className="absolute bottom-1 left-1 rounded-full bg-white/90 p-1.5"><ArrowLeft size={14} /></button>}</div>)}</div>}
    <div><Uploader multiple setUp={setUp} label="Add photos to the album" onDone={r => onChange([...list, ...r])} /></div><p className="text-xs text-ocean/55">You can select several photos at once. Images are resized automatically.</p></div>;
}
// fields: [{ k, label, type: text|number|textarea|select|checkbox|image|gallery, opts: [[value,label]], req }]
export function EntityForm({ fields, initial = {}, onSubmit, label = 'Save', compact }) {
  const blank = (f) => (f.type === 'checkbox' ? false : f.type === 'gallery' ? [] : '');
  const [v, setV] = useState(() => Object.fromEntries(fields.map(f => [f.k, initial[f.k] ?? blank(f)]))); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState(0);
  async function go(e) { e.preventDefault(); setErr(''); setBusy(true); try { await onSubmit(v); if (compact) setV(Object.fromEntries(fields.map(f => [f.k, blank(f)]))); } catch (x) { setErr(x.message); } setBusy(false); }
  const set = (k) => (val) => setV(x => ({ ...x, [k]: val }));
  return <form onSubmit={go} className="grid gap-3 sm:grid-cols-2">{fields.map(f => f.type === 'image' ? <ImageField key={f.k} f={f} value={v[f.k]} onChange={set(f.k)} setUp={setUp} />
    : f.type === 'gallery' ? <GalleryField key={f.k} f={f} value={v[f.k]} onChange={set(f.k)} setUp={setUp} />
    : f.type === 'checkbox' ? <label key={f.k} className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" className="h-5 w-5" checked={!!v[f.k]} onChange={e => set(f.k)(e.target.checked)} />{f.label}</label>
    : <label key={f.k} className={`grid gap-1 text-xs font-medium text-ocean/70 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>{f.label}{f.req && ' *'}
      {f.type === 'textarea' ? <textarea rows={3} className={fld} value={v[f.k]} onChange={e => set(f.k)(e.target.value)} required={!!f.req} />
        : f.type === 'select' ? <select className={fld} value={v[f.k]} onChange={e => set(f.k)(e.target.value)} required={!!f.req}><option value="">Choose…</option>{f.opts.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
        : <input type={f.type || 'text'} step="any" className={fld} value={v[f.k]} onChange={e => set(f.k)(e.target.value)} required={!!f.req} />}</label>)}
    {err && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{err}</p>}
    <div className="sm:col-span-2"><button disabled={busy || up > 0} className={`${btn} ${compact ? '' : 'px-8'} disabled:opacity-50`}>{up > 0 ? 'Uploading photos…' : busy ? 'Saving…' : label}</button></div></form>;
}
// Quick inline form: fields are [key, label, type, options]
export function Form({ fields, onSubmit, label }) {
  const [v, setV] = useState({});
  return <form className="flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); if (await onSubmit(v) !== false) setV({}); }}>
    {fields.map(([k, ph, type, opts]) => type === 'checkbox' ? <label key={k} className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={!!v[k]} onChange={e => setV({ ...v, [k]: e.target.checked })} />{ph}</label>
      : <label key={k} className="grid min-w-[9rem] flex-1 gap-1 text-xs font-medium text-ocean/70">{ph.replace(' (optional)', '')}{opts
        ? <select required className={fld} value={v[k] ?? ''} onChange={e => setV({ ...v, [k]: e.target.value })}><option value="">Choose…</option>{opts.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
        : <input className={fld} type={type || 'text'} step="any" value={v[k] ?? ''} onChange={e => setV({ ...v, [k]: e.target.value })} required={!ph.includes('optional')} />}</label>)}
    <button className={btn}>{label}</button></form>;
}
