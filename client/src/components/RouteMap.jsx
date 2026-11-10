import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { pinIcon, startIcon } from '../lib/leaflet.js';
// Start points are approximate coordinates; verify before publishing.
const STARTS = [{ id: 'airport', label: 'Virac Airport', pos: [13.5764, 124.2064] }, { id: 'virac', label: 'Virac town center', pos: [13.5818, 124.23] }, { id: 'me', label: 'My location' }];
function Fit({ pts }) { const map = useMap(); useEffect(() => { if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30] }); else map.setView(pts[0], 13); }, [JSON.stringify(pts)]); return null; }
export default function RouteMap({ lat, lng, name }) {
  const [start, setStart] = useState('airport'), [me, setMe] = useState(null), [route, setRoute] = useState(null), [state, setState] = useState('idle');
  const has = lat != null && lng != null; const dest = has ? [Number(lat), Number(lng)] : null;
  const from = start === 'me' ? me : STARTS.find(s => s.id === start).pos;
  useEffect(() => {
    if (!has || !from) return setRoute(null); const ac = new AbortController(); setState('loading');
    fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`, { signal: ac.signal })
      .then(r => r.json()).then(j => { const r = j.routes?.[0]; if (!r) throw 0; setRoute({ pts: r.geometry.coordinates.map(([x, y]) => [y, x]), km: r.distance / 1000, min: Math.round(r.duration / 60) }); setState('ok'); })
      .catch(e => { if (e?.name !== 'AbortError') { setRoute(null); setState('error'); } });
    return () => ac.abort();
  }, [start, me, lat, lng]);
  function pick(v) { setStart(v); if (v === 'me') navigator.geolocation?.getCurrentPosition(p => setMe([p.coords.latitude, p.coords.longitude]), () => setState('denied')); }
  if (!has) return <div className="rounded-2xl border border-line bg-white p-4 text-sm">Map unavailable: this listing has no coordinates yet.</div>;
  const pts = route ? route.pts : from ? [from, dest] : [dest];
  return (<div className="rounded-2xl border border-line bg-white overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 p-3 text-sm"><span className="font-medium">Directions from</span>
      <select value={start} onChange={e => pick(e.target.value)} className="rounded-xl border border-line px-2 py-1">{STARTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      {state === 'loading' && <span>Finding route…</span>}
      {route && state === 'ok' && <span className="rounded-full bg-teal/10 text-teal px-3 py-1 font-medium">{route.km.toFixed(1)} km · about {route.min} min by car</span>}
      {state === 'error' && <span className="text-ocean/70">Route unavailable right now (needs internet). Showing straight line.</span>}
      {state === 'denied' && <span className="text-ocean/70">Location permission was denied.</span>}</div>
    <MapContainer center={dest} zoom={12} scrollWheelZoom={false} className="h-80 w-full z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" /><Fit pts={pts} />
      {from && <Marker icon={startIcon} position={from}><Popup>Start</Popup></Marker>}<Marker icon={pinIcon} position={dest}><Popup>{name}</Popup></Marker>
      {route ? <Polyline positions={route.pts} pathOptions={{ color: '#F2452D', weight: 6 }} /> : from && <Polyline positions={[from, dest]} pathOptions={{ color: '#F2452D', dashArray: '6 8' }} />}
    </MapContainer>
    <p className="px-3 py-2 text-xs text-ocean/60">Driving estimate from OpenStreetMap data. Real travel time varies with road conditions, and tricycle or van trips can differ.</p></div>);
}
