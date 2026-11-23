import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSyncVersion } from '../lib/sync.js';
import { localDate } from '../lib/policy.js';
import AvailabilityCalendar, { gridStart } from './AvailabilityCalendar.jsx';

/** What tourists see on a stay page: pick a room, see which dates are open, tap a check-in and a check-out date. */
export default function StayCalendar({ id, rooms, d, setD }) {
  const [month, setMonth] = useState((d.ci || localDate()).slice(0, 7)), [roomId, setRoomId] = useState(''), [cal, setCal] = useState(null), ver = useSyncVersion();
  useEffect(() => { api(`/accommodations/${id}/calendar?from=${gridStart(month)}&days=42`).then(setCal).catch(() => setCal(null)); }, [id, month, ver]);
  const room = cal?.rooms.find(r => r.id === (roomId || rooms[0]?.id)), today = cal?.today || localDate();
  const left = (date) => room?.days[date];
  const cell = (date) => { const f = left(date); if (f === undefined) return null; return f === 0 ? { state: 'full', title: 'fully booked' } : f < room.quantity ? { state: 'few', label: `${f} left`, title: `${f} left` } : { state: 'free', title: 'available' }; };
  const pickingOut = d.ci && !d.co;
  const canPick = (date) => date >= today && (left(date) !== 0 || (pickingOut && date > d.ci)); // a fully booked day can still be the morning you leave
  const onPick = (date) => setD(pickingOut && date > d.ci ? { ...d, co: date } : { ...d, ci: date, co: '' });
  const full = d.ci && d.co && room ? Object.entries(room.days).filter(([k, f]) => k >= d.ci && k < d.co && f === 0).length : 0;
  if (!rooms.length) return <p>No rooms listed yet.</p>;
  return (<div>
    {rooms.length > 1 && <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Choose a room">{rooms.map(r => { const on = r.id === (room?.id || rooms[0].id); return <button key={r.id} role="tab" aria-selected={on} onClick={() => setRoomId(r.id)} className={`rounded-full border px-4 py-1.5 text-sm ${on ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white hover:border-teal'}`}>{r.name}</button>; })}</div>}
    <AvailabilityCalendar month={month} onMonth={setMonth} today={today} minMonth={today.slice(0, 7)} cell={cell} canPick={canPick} onPick={onPick} picked={[d.ci, d.co]} />
    <p className="mt-3 text-sm text-ocean/70" aria-live="polite">{!d.ci ? 'Tap your check-in date.' : !d.co ? 'Now tap your check-out date.' : full > 0 ? `${full} night${full === 1 ? '' : 's'} in your dates ${full === 1 ? 'is' : 'are'} fully booked for ${room.name}. Try another room or other dates.` : `Your dates: ${d.ci} to ${d.co}.`}</p>
  </div>);
}
