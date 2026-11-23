import { ChevronLeft, ChevronRight } from 'lucide-react';
// Month grid shared by tourists (free rooms per date) and owners (who is in the room, which dates are closed).
export const shiftMonth = (m, n) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
export const gridStart = (m) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCDate(1 - d.getUTCDay()); return d.toISOString().slice(0, 10); }; // the Sunday on or before the 1st
const addDay = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const monthName = (m) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const LOOK = { free: 'border-line bg-white hover:border-teal', few: 'border-tang/50 bg-sand/50 hover:border-teal', full: 'border-line bg-slate-100 text-ocean/40 line-through', blocked: 'border-slate-300 bg-slate-200 text-ocean/50 line-through' };
export const LEGEND = [['free', 'Available'], ['few', 'Some left'], ['full', 'Fully booked'], ['blocked', 'Closed by the owner']];

/** cell(date) -> { state: free | few | full | blocked, label?, title? } or null when there is no data for that date.
 *  canPick(date) says which dates can be clicked. picked = [checkIn, checkOut] highlights a chosen stay. */
export default function AvailabilityCalendar({ month, onMonth, today, cell, canPick, onPick, picked = [], minMonth, legend = ['free', 'few', 'full'] }) {
  const start = gridStart(month), dates = Array.from({ length: 42 }, (_, i) => addDay(start, i)), [ci, co] = picked;
  return (<div>
    <div className="mb-2 flex items-center justify-between">
      <button type="button" aria-label="Previous month" disabled={!!minMonth && month <= minMonth} onClick={() => onMonth(shiftMonth(month, -1))} className="rounded-full border border-line bg-white p-2 disabled:opacity-30"><ChevronLeft size={16} /></button>
      <p className="font-display text-lg" aria-live="polite">{monthName(month)}</p>
      <button type="button" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))} className="rounded-full border border-line bg-white p-2"><ChevronRight size={16} /></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-ocean/60" role="grid" aria-label={monthName(month)}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => <div key={w} role="columnheader" className="py-1">{w}</div>)}
      {dates.map(date => {
        const inMonth = date.slice(0, 7) === month, c = cell(date), past = today && date < today, ok = !!onPick && (canPick ? canPick(date) : !past), inStay = ci && date >= ci && date < (co || addDay(ci, 1)), isOut = co && date === co;
        const look = !c ? 'border-line bg-white' : LOOK[c.state];
        return <button key={date} type="button" role="gridcell" disabled={!ok} onClick={() => onPick(date)} aria-label={`${date}${c?.title ? ': ' + c.title : ''}`} aria-selected={!!inStay}
          className={`relative min-h-12 rounded-lg border p-1 text-xs transition sm:min-h-14 ${look} ${inMonth ? '' : 'opacity-40'} ${past ? 'opacity-40' : ''} ${inStay ? 'ring-2 ring-teal' : ''} ${isOut ? 'ring-2 ring-dashed ring-teal' : ''} ${ok ? '' : 'cursor-default'}`}>
          <span className="block text-sm font-medium">{+date.slice(8)}</span>
          {c?.label && !past && <span className="hidden whitespace-pre-line text-[10px] leading-tight text-ocean/70 sm:block">{c.label}</span>}</button>;
      })}
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ocean/70">{LEGEND.filter(([k]) => legend.includes(k)).map(([k, l]) => <li key={k} className="flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded border ${LOOK[k].split(' ').filter(x => x.startsWith('border') || x.startsWith('bg')).join(' ')}`} />{l}</li>)}</ul>
  </div>);
}
