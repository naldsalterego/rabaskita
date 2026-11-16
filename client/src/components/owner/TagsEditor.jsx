import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { inp } from '../ui.jsx';
// Editable list of short labels (amenities, cuisines) with one-tap suggestions.
export default function TagsEditor({ label, hint, value, onChange, suggestions = [], placeholder = 'Type and press Enter' }) {
  const [draft, setDraft] = useState(''), list = value || [];
  const addMany = (txt) => {
    const next = [...list];
    for (const raw of String(txt).split(',')) { const x = raw.trim().slice(0, 40); if (x && !next.some(y => y.toLowerCase() === x.toLowerCase())) next.push(x); }
    onChange(next.slice(0, 30)); setDraft('');
  };
  const left = suggestions.filter(s => !list.some(y => y.toLowerCase() === s.toLowerCase()));
  return (<div className="grid gap-2 sm:col-span-2"><p className="text-xs font-medium text-ocean/70">{label}</p>
    {list.length > 0 ? <div className="flex flex-wrap gap-2">{list.map(t => <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-foam py-1 pl-3 pr-1.5 text-sm">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(list.filter(x => x !== t))} className="rounded-full p-1 text-ocean/60 hover:bg-white hover:text-red-700"><X size={12} /></button></span>)}</div> : <p className="text-sm text-ocean/60">Nothing added yet.</p>}
    <div className="flex gap-2"><input className={`${inp} min-w-0 flex-1`} value={draft} placeholder={placeholder} aria-label={label} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMany(draft); } }} />
      <button type="button" onClick={() => addMany(draft)} disabled={!draft.trim()} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-4 text-sm hover:border-teal disabled:opacity-40"><Plus size={14} />Add</button></div>
    {left.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-ocean/55">Quick add:</span>{left.map(s => <button key={s} type="button" onClick={() => addMany(s)} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-ocean/75 hover:border-teal hover:text-teal">+ {s}</button>)}</div>}
    {hint && <p className="text-xs text-ocean/55">{hint}</p>}</div>);
}
