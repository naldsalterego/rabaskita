import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

/** The chosen municipality lives in the page address (?municipality=Virac), so it survives going back from a listing and can be shared. */
export function useMunicipality() {
  const [sp, setSp] = useSearchParams(), muni = sp.get('municipality') || '';
  const set = (m) => { const n = new URLSearchParams(sp); if (m) n.set('municipality', m); else n.delete('municipality'); setSp(n, { replace: true }); };
  return [muni, set, sp, setSp];
}
export const inMunicipality = (rows, muni) => (muni ? rows.filter(r => r.municipality === muni) : rows);

const chip = (on, empty) => `shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${on ? 'border-ocean bg-ocean text-foam' : `border-line bg-white hover:border-teal ${empty ? 'text-ocean/50' : ''}`}`;

/** "All" plus one chip per municipality, each showing how many places it has in the list being browsed. */
export default function MunicipalityChips({ rows, value, onChange }) {
  const [munis, setMunis] = useState([]);
  useEffect(() => { api('/municipalities').then(m => setMunis(m.map(x => x.name))).catch(() => setMunis([])); }, []);
  const names = munis.length ? munis : [...new Set(rows.map(r => r.municipality).filter(Boolean))];
  const n = (name) => rows.filter(r => r.municipality === name).length;
  return (<div role="group" aria-label="Filter by municipality" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
    <button type="button" aria-pressed={!value} className={chip(!value)} onClick={() => onChange('')}>All <span className="opacity-60">{rows.length}</span></button>
    {names.map(m => <button key={m} type="button" aria-pressed={value === m} className={chip(value === m, n(m) === 0)} onClick={() => onChange(m)}>{m} <span className="opacity-60">{n(m)}</span></button>)}
  </div>);
}
