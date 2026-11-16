import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { EntityForm, Empty, btnGhost } from '../ui.jsx';
// A list the owner can add to, edit and delete (rooms, menu items, products). The server sends back the refreshed business after every change.
export default function ItemsPanel({ noun, items, fields, initialOf, row, addPath, itemPath, onChange, empty, hint, transform = (v) => v }) {
  const [editing, setEditing] = useState(null), [msg, setMsg] = useState('');
  const save = async (it, v) => { await api(itemPath(it.id), { method: 'PUT', body: transform(v) }); setEditing(null); onChange(); };
  const del = async (it) => {
    if (!confirm(`Delete this ${noun}?`)) return; setMsg('');
    try { await api(itemPath(it.id), { method: 'DELETE' }); onChange(); } catch (e) { setMsg(e.message); }
  };
  return (<div>
    {hint && <p className="mb-3 text-sm text-ocean/70">{hint}</p>}
    {msg && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{msg}</p>}
    {items.length === 0 ? <Empty>{empty}</Empty> : <ul className="divide-y divide-line rounded-2xl border border-line">{items.map(it => <li key={it.id} className="p-3">
      {editing === it.id ? <div className="grid gap-3"><EntityForm fields={fields} initial={initialOf(it)} label="Save changes" onSubmit={v => save(it, v)} /><button type="button" className="justify-self-start text-sm underline" onClick={() => setEditing(null)}>Cancel</button></div>
        : <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center gap-3 text-sm">{row(it)}</div>
          <div className="flex gap-2"><button type="button" onClick={() => { setMsg(''); setEditing(it.id); }} className={`${btnGhost} inline-flex items-center gap-1`}><Pencil size={14} />Edit</button><button type="button" onClick={() => del(it)} aria-label={`Delete ${noun}`} className={`${btnGhost} inline-flex items-center gap-1 text-red-700`}><Trash2 size={14} />Delete</button></div></div>}</li>)}</ul>}
    <div className="mt-5 rounded-2xl bg-foam p-4"><p className="mb-3 font-display text-lg">Add a {noun}</p>
      <EntityForm compact fields={fields} label={`Add ${noun}`} onSubmit={async v => { await api(addPath, { method: 'POST', body: transform(v) }); onChange(); }} /></div>
  </div>);
}
