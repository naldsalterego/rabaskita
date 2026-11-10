import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link, useParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, Trash2, Coffee, Compass, Zap, Minus, Plus, SlidersHorizontal, Sparkles, GripVertical, Share2, Info, MapPin, Utensils, BedDouble, Route as RouteIcon } from 'lucide-react';
import { api } from '../lib/api.js';
import { PageHeader, Empty } from '../components/ui.jsx';
import PlanMap from '../components/PlanMap.jsx';
const inp = 'rounded-lg border border-line bg-white px-2 py-1';
const money = (n) => `₱${Number(n).toLocaleString()}`;

const PACES = [['relaxed', 'Relaxed', Coffee, 2, 'Slow mornings and time to linger.'], ['balanced', 'Balanced', Compass, 3, 'A good mix of sights and rest.'], ['adventurous', 'Adventurous', Zap, 4, 'Early starts and a full day.']];
const MUNIS = ['Virac', 'San Andres', 'Baras', 'Bato', 'Caramoran', 'Gigmoto', 'Pandan', 'Panganiban', 'San Miguel', 'Viga', 'Bagamanoc'];
const STEPS = [[SlidersHorizontal, 'bg-coral', 'Tell us your trip', 'Choose how many days, your pace, where to focus and any must-see places.'], [Sparkles, 'bg-tang', 'We build a plan', 'Nearby places are grouped into days, with a meal each day and a suggested stay.'], [GripVertical, 'bg-leaf', 'Make it yours', 'Drag stops, change times, costs and notes, add or remove anything.'], [Share2, 'bg-sky', 'Save and share', 'Changes save automatically. Share a link, duplicate it or export a PDF.']];
const pill = (on) => `shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`;

export default function Planner() {
  const [list, setList] = useState(null), [cur, setCur] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [g, setG] = useState({ title: 'My Catanduanes trip', days: 3, pace: 'balanced', budget: '', municipality: '', cuisine: '', sel: [] }), [dests, setDests] = useState([]), [cuisines, setCuisines] = useState([]);
  async function removeTrip(t) { if (confirm(`Delete "${t.title}"? This can't be undone.`)) { await api(`/itineraries/${t.id}`, { method: 'DELETE' }).catch(e => setErr(e.message)); loadList(); } }
  const loadList = () => api('/itineraries').then(setList).catch(e => { setErr(e.message); setList([]); });
  const ver = useSyncVersion();
  useEffect(() => { loadList(); api('/destinations').then(setDests).catch(() => {}); api('/restaurants').then(r => setCuisines([...new Set(r.flatMap(x => x.cuisines || []))])).catch(() => {}); }, [ver]);
  async function generate(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setCur(await api('/itineraries/generate', { method: 'POST', body: { title: g.title, days: g.days, pace: g.pace, budget: g.budget === '' ? null : Number(g.budget), municipality: g.municipality || null, cuisine: g.cuisine || null, destinationIds: g.sel } })); loadList(); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  if (cur) return <Editor data={cur} onBack={() => { setCur(null); loadList(); }} />;
  const per = PACES.find(p => p[0] === g.pace)[3], pool = dests.filter(d => !g.municipality || d.municipality === g.municipality), stops = Math.min(g.days * per, pool.length);
  const toggle = (id) => setG(x => ({ ...x, sel: x.sel.includes(id) ? x.sel.filter(y => y !== id) : [...x.sel, id] }));
  const card = 'min-w-0 rounded-3xl border border-line bg-white p-5', h = 'mb-3 flex items-center gap-3 font-display text-xl', num = 'grid h-8 w-8 place-items-center rounded-full bg-ocean text-sm text-foam';
  return (<main className="mx-auto max-w-6xl px-4 py-6">
    <PageHeader title="Trip planner" sub="Answer a few questions and get a day-by-day plan you can fully edit, save and share." />
    <section aria-label="How it works" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{STEPS.map(([I, bg, t, d], i) => <div key={t} className="rounded-3xl border border-line bg-white p-4"><span className={`grid h-11 w-11 place-items-center rounded-2xl text-white ${bg}`}><I size={20} /></span><p className="mt-3 font-display text-lg"><span className="text-ocean/40">{i + 1}.</span> {t}</p><p className="mt-1 text-sm text-ocean/70">{d}</p></div>)}</section>
    {err && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err.includes('Sign in') ? <>Please <Link className="underline" to="/login">sign in</Link> to build and save trips.</> : err}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <form onSubmit={generate} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:col-span-2">
        <section className={card}><h2 className={h}><span className={num}>1</span>How long is your trip?</h2>
          <div className="flex flex-wrap items-center gap-4"><div className="flex items-center gap-3"><button type="button" aria-label="Fewer days" disabled={g.days <= 1} onClick={() => setG({ ...g, days: g.days - 1 })} className="grid h-11 w-11 place-items-center rounded-full border border-line disabled:opacity-30"><Minus size={18} /></button><div className="min-w-[5.5rem] text-center"><p className="font-display text-4xl font-bold leading-none">{g.days}</p><p className="text-xs text-ocean/60">{g.days === 1 ? 'day' : 'days'}{g.days > 1 && ` · ${g.days - 1} night${g.days > 2 ? 's' : ''}`}</p></div><button type="button" aria-label="More days" disabled={g.days >= 10} onClick={() => setG({ ...g, days: g.days + 1 })} className="grid h-11 w-11 place-items-center rounded-full border border-line disabled:opacity-30"><Plus size={18} /></button></div>
            <label className="grid min-w-[12rem] flex-1 gap-1 text-xs font-medium text-ocean/60">Trip name<input className={`${inp} text-base`} value={g.title} onChange={e => setG({ ...g, title: e.target.value })} required /></label></div></section>
        <section className={card}><h2 className={h}><span className={num}>2</span>What's your pace?</h2>
          <div className="grid gap-3 sm:grid-cols-3">{PACES.map(([v, l, I, n, d]) => <button key={v} type="button" aria-pressed={g.pace === v} onClick={() => setG({ ...g, pace: v })} className={`rounded-2xl border p-4 text-left ${g.pace === v ? 'border-ocean bg-ocean text-foam' : 'border-line hover:border-teal'}`}><I size={22} /><p className="mt-2 font-display text-lg">{l}</p><p className="text-sm font-semibold">{n} stops a day</p><p className={`text-xs ${g.pace === v ? 'text-foam/75' : 'text-ocean/60'}`}>{d}</p></button>)}</div></section>
        <section className={card}><h2 className={h}><span className={num}>3</span>Where and what?</h2>
          <p className="mb-2 text-sm font-medium">Area</p><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"><button type="button" className={pill(!g.municipality)} onClick={() => setG({ ...g, municipality: '' })}>Anywhere on the island</button>{MUNIS.map(m => <button key={m} type="button" className={pill(g.municipality === m)} onClick={() => setG({ ...g, municipality: m })}>{m}</button>)}</div>
          {pool.length < g.days * per && <p className="mt-1 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Info size={16} className="mt-0.5 shrink-0" />Only {pool.length} listed place{pool.length === 1 ? '' : 's'} {g.municipality ? `in ${g.municipality}` : ''} so far, so your plan may have fewer than {per} stops a day.</p>}
          <p className="mb-2 mt-4 text-sm font-medium">Must-see places <span className="font-normal text-ocean/60">(optional, these go first)</span></p>
          <div className="grid gap-2 sm:grid-cols-2">{pool.length === 0 ? <p className="text-sm text-ocean/60">No places listed here yet.</p> : pool.map(d => { const on = g.sel.includes(d.id); return <button key={d.id} type="button" aria-pressed={on} onClick={() => toggle(d.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line hover:border-teal'}`}><MapPin size={16} className={on ? 'text-sun' : 'text-teal'} /><span><b>{d.name}</b><br /><span className="opacity-70">{d.municipality}</span></span></button>; })}</div>
          {cuisines.length > 0 && <><p className="mb-2 mt-4 text-sm font-medium">Food you'd like</p><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"><button type="button" className={pill(!g.cuisine)} onClick={() => setG({ ...g, cuisine: '' })}>Anything</button>{cuisines.map(c => <button key={c} type="button" className={pill(g.cuisine === c)} onClick={() => setG({ ...g, cuisine: c })}>{c}</button>)}</div></>}</section>
        <section className={card}><h2 className={h}><span className={num}>4</span>Budget <span className="text-sm font-normal text-ocean/60">(optional)</span></h2>
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2"><span className="font-semibold">₱</span><input type="number" min="0" inputMode="numeric" placeholder="e.g. 10000" className="w-32 bg-transparent outline-none" value={g.budget} onChange={e => setG({ ...g, budget: e.target.value })} /></label>{[5000, 10000, 20000].map(b => <button key={b} type="button" className={pill(Number(g.budget) === b)} onClick={() => setG({ ...g, budget: b })}>₱{b.toLocaleString()}</button>)}</div>
          <p className="mt-2 text-sm text-ocean/65">We add up prices from listed fees, menus and room rates and warn you if the plan goes over.</p></section>
        <button disabled={busy} className="rounded-full bg-coral px-8 py-4 font-display text-xl font-semibold text-white hover:bg-ocean disabled:opacity-50">{busy ? 'Building your plan…' : 'Build my itinerary'}</button>
      </form>
      <aside className="min-w-0"><div className="grid gap-4 lg:sticky lg:top-24"><section className="rounded-3xl bg-gradient-to-br from-ocean via-[#3340B5] to-sky p-5 text-foam"><p className="eyebrow !text-sun">Your plan at a glance</p>
        <ul className="mt-3 grid gap-2 text-sm"><li className="flex items-center gap-2"><RouteIcon size={16} />{g.days} day{g.days > 1 ? 's' : ''}, {PACES.find(p => p[0] === g.pace)[1].toLowerCase()} pace</li><li className="flex items-center gap-2"><MapPin size={16} />Up to {stops} place{stops === 1 ? '' : 's'}{g.sel.length > 0 && `, ${g.sel.length} must-see first`}</li><li className="flex items-center gap-2"><Utensils size={16} />A meal stop each day{g.cuisine && ` (${g.cuisine})`}</li>{g.days > 1 && <li className="flex items-center gap-2"><BedDouble size={16} />A suggested stay for {g.days - 1} night{g.days > 2 ? 's' : ''}</li>}<li className="flex items-center gap-2"><Sparkles size={16} />{g.budget ? `Budget ₱${Number(g.budget).toLocaleString()}` : 'No budget set'}</li></ul></section>
        <section className={card}><h2 className="mb-2 flex items-center gap-2 font-display text-lg"><Info size={18} className="text-teal" />Good to know</h2><ul className="grid gap-2 text-sm text-ocean/75"><li>Plans only use places, restaurants and stays already listed on this platform.</li><li>Travel times are rough estimates from distance, not live road routing. Stops without a location show none.</li><li>Costs come only from listed prices. Anything without a price is counted as "unpriced", never guessed.</li><li>Nothing is booked automatically. Book stays and rides separately.</li></ul></section></div></aside></div>
    <section className="mt-10"><h2 className="mb-3 font-display text-2xl">Saved trips</h2>{list === null ? <p>Loading…</p> : list.length === 0 ? <Empty Icon={RouteIcon}>No saved trips yet. Build your first one above.</Empty> :
      <div className="grid gap-3 sm:grid-cols-2">{list.map(t => <div key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-white p-2"><button className="flex-1 rounded-xl p-2 text-left font-medium hover:bg-foam" onClick={async () => setCur(await api(`/itineraries/${t.id}`))}>{t.title}{t.budget && <span className="text-sm text-ocean/60"> · budget {money(t.budget)}</span>}</button><button aria-label={`Delete ${t.title}`} className="rounded-xl p-2 text-red-700 hover:bg-red-50" onClick={() => removeTrip(t)}><Trash2 size={18} /></button></div>)}</div>}</section>
  </main>);
}

function Editor({ data, onBack }) {
  const [d, setD] = useState(data); const [drag, setDrag] = useState(null); const [msg, setMsg] = useState(''); const [pick, setPick] = useState({ type: 'destination', opts: [] });
  const days = Math.max(1, ...d.items.map(i => i.day_no), data.preferences?.days || 1);
  useEffect(() => { // options for the "add" menu
    const url = { destination: '/destinations', restaurant: '/restaurants', accommodation: '/accommodations' }[pick.type];
    api(url).then(o => setPick(p => ({ ...p, opts: o }))).catch(() => {});
  }, [pick.type]);
  const toBody = (items, extra = {}) => ({ title: d.title, budget: d.budget == null || d.budget === '' ? null : Number(d.budget), ...extra,
    items: items.map(i => ({ day_no: i.day_no, listing_type: i.listing_type, listing_id: i.listing_id, title: i.listing_id ? null : i.name, start_time: i.start_time?.slice(0, 5) || null, duration_min: i.duration_min == null || i.duration_min === '' ? null : Number(i.duration_min), est_cost: i.est_cost == null || i.est_cost === '' ? null : Number(i.est_cost), notes: i.notes || null })) });
  async function save(items = d.items, extra) { try { setD(await api(`/itineraries/${d.id}`, { method: 'PUT', body: toBody(items, extra) })); setMsg(''); } catch (e) { setMsg(e.message); } }
  const edit = (id, k, v) => setD({ ...d, items: d.items.map(i => i.id === id ? { ...i, [k]: v } : i) });
  const remove = (id) => save(d.items.filter(i => i.id !== id));
  async function delTrip() { if (!confirm(`Delete "${d.title}"? This can't be undone.`)) return; await api(`/itineraries/${d.id}`, { method: 'DELETE' }); onBack(); }
  function move(id, dir) { const list = [...d.items], i = list.findIndex(x => x.id === id); let j = i + dir; while (j >= 0 && j < list.length && list[j].day_no !== list[i].day_no) j += dir; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; save(list); }
  function setDay(id, day) { const it = d.items.find(x => x.id === id); save([...d.items.filter(x => x.id !== id), { ...it, day_no: Number(day) }]); }
  function drop(day, beforeId) { // move dragged item to `day`, before `beforeId` (or end of day)
    if (!drag) return; const moving = { ...d.items.find(i => i.id === drag), day_no: day };
    const rest = d.items.filter(i => i.id !== drag); const idx = beforeId ? rest.findIndex(i => i.id === beforeId) : -1;
    const at = idx >= 0 ? idx : rest.map(i => i.day_no).lastIndexOf(day) + 1 || rest.length;
    rest.splice(at, 0, moving); setDrag(null); save(rest);
  }
  function add(day) {
    const o = pick.opts.find(x => (x.accommodation_id || x.restaurant_id || x.id) === pick.sel); if (!o) return;
    save([...d.items, { day_no: day, listing_type: pick.type, listing_id: pick.sel, name: o.name, duration_min: 60, est_cost: o.entrance_fee ?? o.from_price ?? null }]);
  }
  const addNote = (day) => { const t = prompt('Add a note or custom stop'); if (t) save([...d.items, { day_no: day, name: t, duration_min: null }]); };
  async function share() { const { token } = await api(`/itineraries/${d.id}/share`, { method: 'POST' }); setMsg(`Share link: ${location.origin}/trip/${token}`); }
  async function dup() { const { id } = await api(`/itineraries/${d.id}/duplicate`, { method: 'POST' }); setD(await api(`/itineraries/${id}`)); setMsg('Duplicated. You are now editing the copy.'); }
  return (<main className="mx-auto max-w-5xl p-4">
    <div className="no-print flex flex-wrap items-center gap-2 mb-3">
      <button onClick={onBack} className="underline">← All trips</button>
      <input className={`${inp} flex-1 font-display text-xl`} value={d.title} onChange={e => setD({ ...d, title: e.target.value })} onBlur={() => save()} aria-label="Trip name" />
      <label className="text-sm">Budget ₱ <input className={`${inp} w-28`} type="number" min="0" value={d.budget ?? ''} onChange={e => setD({ ...d, budget: e.target.value })} onBlur={() => save()} /></label>
      <button onClick={dup} className="underline text-sm">Duplicate</button><button onClick={share} className="underline text-sm">Share</button><button onClick={() => window.print()} className="underline text-sm">Export PDF</button><button onClick={delTrip} className="inline-flex items-center gap-1 text-sm text-red-700 underline"><Trash2 size={14} />Delete trip</button>
    </div>
    <h1 className="hidden print:block font-display text-3xl">{d.title}</h1>
    {msg && <p role="status" className="mb-3 rounded-lg bg-sand/60 p-3 break-all">{msg}</p>}
    <details className="no-print mb-3 rounded-2xl border border-line bg-white p-3 text-sm"><summary className="cursor-pointer font-medium">How to edit this plan</summary><ul className="mt-2 grid gap-1 text-ocean/75"><li><b>Reorder or move:</b> drag a stop, or use the arrows and the "Move to day" menu on a phone.</li><li><b>Change details:</b> edit the start time, minutes, cost and notes on any stop.</li><li><b>Add or remove:</b> use the menus under the days to add a place, restaurant or stay, or "Add note" for your own stop.</li><li><b>Map:</b> every stop with a location is numbered in visiting order and joined by a road route, with driving distance and time for each leg and a Directions link for navigation.</li><li><b>Totals:</b> travel time and cost update after every change, and you'll be warned if you go over budget.</li><li><b>Keep it:</b> changes save automatically. Use Share for a link, Duplicate for a copy or Export PDF to print.</li></ul></details>
    <p className="mb-3 text-sm">Estimated cost: <b>{money(d.totals.cost)}</b>{d.totals.unpriced > 0 && ` (${d.totals.unpriced} stop(s) have no price data)`}{d.totals.overBudget && <b className="text-red-700"> · over your budget</b>}</p>
    <PlanMap items={d.items} />
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: days }, (_, k) => k + 1).map(day => (
        <section key={day} onDragOver={e => e.preventDefault()} onDrop={() => drop(day)} className="rounded-2xl border border-line bg-white/70 p-3 min-h-24">
          <h2 className="font-display text-lg mb-2">Day {day}</h2>
          {d.items.filter(i => i.day_no === day).map(i => (<div key={i.id} draggable onDragStart={() => setDrag(i.id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.stopPropagation(); drop(day, i.id); }} className="rounded-xl bg-white border border-line p-2 mb-2 cursor-grab">
            {i.travel_minutes != null && <p className="text-xs text-teal mb-1">≈ {i.travel_minutes} min travel (rough estimate)</p>}
            <div className="flex justify-between gap-2"><b className="text-sm">{i.name || 'Stop'}</b><button className="no-print text-xs underline" onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`}>Remove</button></div>
            <div className="no-print mt-1 flex items-center gap-1"><button aria-label="Move up" onClick={() => move(i.id, -1)} className="rounded-lg bg-foam p-1.5"><ArrowUp size={14} /></button><button aria-label="Move down" onClick={() => move(i.id, 1)} className="rounded-lg bg-foam p-1.5"><ArrowDown size={14} /></button>
              <select aria-label="Move to day" value={i.day_no} onChange={e => setDay(i.id, e.target.value)} className={`${inp} ml-1 text-xs`}>{Array.from({ length: days }, (_, k) => k + 1).map(n => <option key={n} value={n}>Day {n}</option>)}</select></div>
            <div className="flex gap-1 mt-1 text-xs"><input type="time" className={`${inp} w-24`} value={i.start_time?.slice(0, 5) || ''} onChange={e => edit(i.id, 'start_time', e.target.value)} onBlur={() => save()} aria-label="Start time" />
              <input type="number" min="0" className={`${inp} w-16`} value={i.duration_min ?? ''} onChange={e => edit(i.id, 'duration_min', e.target.value)} onBlur={() => save()} aria-label="Minutes" />
              <input type="number" min="0" className={`${inp} w-20`} placeholder="₱" value={i.est_cost ?? ''} onChange={e => edit(i.id, 'est_cost', e.target.value)} onBlur={() => save()} aria-label="Cost" /></div>
            <input className={`${inp} w-full mt-1 text-xs`} placeholder="Notes" value={i.notes ?? ''} onChange={e => edit(i.id, 'notes', e.target.value)} onBlur={() => save()} />
          </div>))}
          <div className="no-print flex gap-1 text-xs"><button className="underline" onClick={() => add(day)} disabled={!pick.sel}>Add selected</button><button className="underline" onClick={() => addNote(day)}>Add note</button></div>
        </section>))}
    </div>
    <div className="no-print mt-4 flex gap-2 text-sm"><select className={inp} value={pick.type} onChange={e => setPick({ type: e.target.value, opts: [] })}><option value="destination">Destination</option><option value="restaurant">Restaurant</option><option value="accommodation">Stay</option></select>
      <select className={`${inp} flex-1`} value={pick.sel || ''} onChange={e => setPick({ ...pick, sel: e.target.value })}><option value="">Choose to add…</option>{pick.opts.map(o => <option key={o.accommodation_id || o.restaurant_id || o.id} value={o.accommodation_id || o.restaurant_id || o.id}>{o.name}</option>)}</select></div>
    <p className="no-print text-xs mt-2">Drag stops (or use the arrows and day menu on a phone) to reorder or move between days. Changes save automatically and travel time and cost are recalculated.</p>
  </main>);
}
