import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ExternalLink } from 'lucide-react';
import '../lib/leaflet.js';
const COLORS = ['#F2452D', '#18A7E0', '#4CB944', '#F7861B', '#E8457A', '#0D8C84', '#B8860B', '#25308F'];
const START = { airport: ['Virac Airport', [13.5764, 124.2064]], virac: ['Virac town center', [13.5818, 124.23]] }; // approximate coordinates
const cache = new Map();
const numIcon = (n, c) => L.divIcon({ className: '', html: `<div class="num-pin" style="background:${c}">${n}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
const arrowIcon = (deg, c) => L.divIcon({ className: '', html: `<div class="arrow-pin" style="color:${c};transform:rotate(${deg}deg)">▲</div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
const bearing = (a, b) => { const r = x => x * Math.PI / 180, y = Math.sin(r(b[1] - a[1])) * Math.cos(r(b[0])), x = Math.cos(r(a[0])) * Math.sin(r(b[0])) - Math.sin(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const fmt = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
function Fit({ pts }) { const map = useMap(); useEffect(() => { if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); else if (pts.length === 1) map.setView(pts[0], 12); }, [JSON.stringify(pts)]); return null; }

export default function PlanMap({ items }) {
  const [start, setStart] = useState('airport'), [view, setView] = useState('all'), [routes, setRoutes] = useState({});
  const days = useMemo(() => { const m = {}; items.forEach(i => { if (i.lat == null || i.lng == null) return; (m[i.day_no] ||= []).push({ ...i, pos: [Number(i.lat), Number(i.lng)] }); }); return Object.entries(m).map(([d, stops]) => ({ day: Number(d), stops })).sort((a, b) => a.day - b.day); }, [items]);
  const missing = items.filter(i => i.lat == null || i.lng == null).length, sig = JSON.stringify(days.map(d => [d.day, d.stops.map(s => s.pos)]));
  const wpsOf = (d) => [...(d.day === days[0]?.day && start ? [{ name: START[start][0], pos: START[start][1], isStart: true }] : []), ...d.stops];
  useEffect(() => { // road routes, one request per day (debounced and cached)
    const ac = new AbortController();
    const t = setTimeout(() => days.forEach(async (d) => {
      const wps = wpsOf(d).map(w => w.pos); if (wps.length < 2) return setRoutes(r => ({ ...r, [d.day]: null }));
      const key = wps.map(p => p.join(',')).join(';'); let res = cache.get(key);
      if (!res) { try { const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${wps.map(p => `${p[1]},${p[0]}`).join(';')}?overview=full&geometries=geojson`, { signal: ac.signal })).json(); const r = j.routes?.[0]; if (!r) throw 0;
        res = { ok: true, pts: r.geometry.coordinates.map(([x, y]) => [y, x]), legs: r.legs.map(l => ({ km: l.distance / 1000, min: Math.round(l.duration / 60) })), km: r.distance / 1000, min: Math.round(r.duration / 60) }; cache.set(key, res); } catch (e) { if (e?.name === 'AbortError') return; res = { ok: false }; } }
      setRoutes(r => ({ ...r, [d.day]: { ...res, n: wps.length } }));
    }), 500);
    return () => { clearTimeout(t); ac.abort(); };
  }, [sig, start]);
  if (!days.length) return <section className="mb-5 rounded-3xl border border-line bg-white p-5 text-sm">Add stops with a location to see your route on the map.</section>;
  const shown = days.filter(d => view === 'all' || d.day === view), color = (day) => COLORS[(day - 1) % COLORS.length];
  const fitPts = shown.flatMap(d => wpsOf(d).map(w => w.pos));
  return (<section className="mb-5 overflow-hidden rounded-3xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-2 p-4"><h2 className="mr-auto font-display text-2xl">Your route</h2>
      <label className="no-print flex items-center gap-2 text-sm">Start day 1 from<select className="rounded-xl border border-line bg-white px-2 py-1" value={start} onChange={e => setStart(e.target.value)}><option value="airport">Virac Airport</option><option value="virac">Virac town center</option><option value="">First stop</option></select></label></div>
    <div className="no-print flex gap-2 overflow-x-auto px-4 pb-3"><button className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${view === 'all' ? 'border-ocean bg-ocean text-foam' : 'border-line'}`} onClick={() => setView('all')}>All days</button>{days.map(d => <button key={d.day} onClick={() => setView(d.day)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm ${view === d.day ? 'border-ocean bg-ocean text-foam' : 'border-line'}`}><i className="h-3 w-3 rounded-full" style={{ background: color(d.day) }} />Day {d.day}</button>)}</div>
    <MapContainer center={[13.72, 124.3]} zoom={10} scrollWheelZoom={false} className="z-0 h-80 w-full md:h-[28rem]"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" /><Fit pts={fitPts} />
      {shown.map(d => { const wps = wpsOf(d), r = routes[d.day], c = color(d.day), line = r?.ok && r.n === wps.length ? r.pts : wps.map(w => w.pos); return (<div key={d.day}>
        <Polyline positions={line} pathOptions={r?.ok && r.n === wps.length ? { color: c, weight: 5, opacity: .85 } : { color: c, weight: 3, dashArray: '6 8' }} />
        {wps.slice(0, -1).map((w, i) => <Marker key={'a' + i} interactive={false} icon={arrowIcon(bearing(w.pos, wps[i + 1].pos), c)} position={mid(w.pos, wps[i + 1].pos)} />)}
        {wps.map((w, i) => w.isStart ? <Marker key="s" icon={numIcon('S', '#25308F')} position={w.pos}><Popup>Start: {w.name}</Popup></Marker> : <Marker key={w.id} icon={numIcon(i + (wps[0].isStart ? 0 : 1), c)} position={w.pos}><Popup><b>Day {d.day} · stop {i + (wps[0].isStart ? 0 : 1)}</b><br />{w.name}</Popup></Marker>)}</div>); })}
    </MapContainer>
    <div className="grid gap-4 p-4">{shown.map(d => { const wps = wpsOf(d), r = routes[d.day], ok = r?.ok && r.n === wps.length; return (<div key={d.day}>
      <p className="flex flex-wrap items-center gap-2 font-display text-lg"><i className="h-3 w-3 rounded-full" style={{ background: color(d.day) }} />Day {d.day}{ok && <span className="text-sm font-normal text-ocean/70">· {r.km.toFixed(1)} km · about {fmt(r.min)} driving</span>}{wps.length > 1 && !r && <span className="text-sm font-normal text-ocean/60">· finding route…</span>}</p>
      <ol className="mt-2 grid gap-1 text-sm">{wps.slice(1).map((w, i) => { const a = wps[i], leg = ok ? r.legs[i] : null, rough = !ok && !w.isStart ? w.travel_minutes : null; return (<li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foam px-3 py-2"><span>{a.isStart ? 'Start' : a.name} → <b>{w.name}</b></span><span className="flex items-center gap-3 text-ocean/70">{leg ? `${leg.km.toFixed(1)} km · ${fmt(leg.min)}` : rough != null ? `≈ ${rough} min (rough estimate)` : 'no estimate'}<a className="inline-flex items-center gap-1 underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${a.pos.join(',')}%3B${w.pos.join(',')}`}>Directions<ExternalLink size={12} /></a></span></li>); })}
        {wps.length < 2 && <li className="text-ocean/60">Only one stop, so there is no route to show.</li>}</ol></div>); })}
      {missing > 0 && <p className="text-sm text-ocean/70">{missing} stop{missing > 1 ? 's' : ''} without a map location {missing > 1 ? 'are' : 'is'} not shown.</p>}
      <p className="text-xs text-ocean/60">Numbers show the order of stops and arrows show the direction of travel. Driving times come from OpenStreetMap routing and need internet; they are estimates for a car, and real trips vary with roads and weather.</p></div></section>);
}
