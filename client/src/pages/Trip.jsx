import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
export default function Trip() {
  const { token } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState('');
  const ver = useSyncVersion();
  useEffect(() => { api(`/itineraries/shared/${token}`).then(setD).catch(e => setErr(e.message)); }, [token, ver]);
  if (err) return <p className="p-6">{err}</p>; if (!d) return <p className="p-6">Loading…</p>;
  const days = [...new Set(d.items.map(i => i.day_no))];
  return (<main className="mx-auto max-w-2xl p-4"><h1 className="font-display text-3xl mb-3">{d.title}</h1>
    {days.map(day => <section key={day} className="mb-4"><h2 className="font-display text-xl">Day {day}</h2><ul>{d.items.filter(i => i.day_no === day).map(i => <li key={i.id} className="py-1">{i.start_time?.slice(0, 5)} {i.name}{i.travel_minutes != null && <span className="text-sm text-teal"> · ≈{i.travel_minutes} min from previous stop</span>}</li>)}</ul></section>)}
    <button onClick={() => window.print()} className="no-print underline">Save as PDF</button></main>);
}
