import { useState } from 'react';
import { api } from '../../lib/api.js';
import { ImageField, GalleryField, btn, inp } from '../ui.jsx';
import TagsEditor from './TagsEditor.jsx';
const split = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const AMENITIES = ['Wi-Fi', 'Air-conditioning', 'Free parking', 'Breakfast included', 'Swimming pool', 'Beachfront', 'Hot shower', 'Kitchen access', 'TV', 'Airport pickup', 'Restaurant on site', 'Family friendly'];
const CUISINES = ['Filipino', 'Bicolano', 'Seafood', 'Grill', 'Cafe', 'Bakery', 'Local delicacies', 'Vegetarian options'];
const STAY_TYPES = ['hotel', 'resort', 'inn', 'staycation', 'homestay', 'private'];
const group = 'grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2';
const lab = 'grid gap-1 text-xs font-medium text-ocean/70';
// Everything that controls how the business looks to tourists. The approved name, municipality and category are fixed (the tourism office checked them against your papers).
export default function PageEditor({ b, onSaved, path = `/owner/business/${b.id}`, noun = 'business' }) {
  const [v, setV] = useState(() => ({ cover: b.cover, photos: b.photos, description: b.description, address: b.address, phone: b.phone, hoursText: b.hoursText, lat: b.lat, lng: b.lng, type: b.type || 'hotel', amenities: split(b.amenities), cuisines: split(b.cuisines), priceRange: b.priceRange ?? '', acceptsReservations: !!b.acceptsReservations }));
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [up, setUp] = useState(0);
  const set = (k) => (val) => setV(x => ({ ...x, [k]: val })), text = (k) => ({ value: v[k], onChange: e => set(k)(e.target.value) });
  async function save(e) {
    e.preventDefault(); setBusy(true); setMsg(''); setErr('');
    try { await api(path, { method: 'PUT', body: v }); setMsg(b.status === 'approved' ? 'Saved. Tourists see these changes now.' : `Saved. Your page will be visible once the tourism office approves your ${noun}.`); onSaved(); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<form onSubmit={save} className="grid gap-5">
    <section><h3 className="mb-2 font-display text-xl">Photos</h3><div className={group}>
      <ImageField f={{ label: 'Cover photo (the main picture on the list and at the top of your page)', replace: 'Change cover photo' }} value={v.cover} onChange={set('cover')} setUp={setUp} />
      <GalleryField f={{ label: 'Photo album (tourists can open and swipe through these)' }} value={v.photos} onChange={set('photos')} setUp={setUp} /></div></section>
    <section><h3 className="mb-2 font-display text-xl">About your {noun}</h3><div className={group}>
      <label className={`${lab} sm:col-span-2`}>Description (what makes your place special)<textarea rows={4} maxLength={2000} className={inp} {...text('description')} /></label>
      <label className={lab}>Opening hours (e.g. Daily 8:00 to 20:00)<input className={inp} maxLength={200} {...text('hoursText')} /></label>
      <label className={lab}>Phone<input className={inp} maxLength={60} {...text('phone')} /></label>
      <label className={`${lab} sm:col-span-2`}>Address<input className={inp} maxLength={200} {...text('address')} /></label>
      {b.kind !== 'transport' && <><label className={lab}>Map latitude (optional)<input type="number" step="any" className={inp} {...text('lat')} /></label>
      <label className={lab}>Map longitude (optional)<input type="number" step="any" className={inp} {...text('lng')} /></label></>}</div></section>
    {b.kind === 'stays' && <section><h3 className="mb-2 font-display text-xl">Stay details</h3><div className={group}>
      <label className={lab}>Type of stay<select className={inp} value={v.type} onChange={e => set('type')(e.target.value)}>{STAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label><span />
      <TagsEditor label="Amenities guests will see" value={v.amenities} onChange={set('amenities')} suggestions={AMENITIES} placeholder="Add an amenity, e.g. Hot shower" /></div></section>}
    {b.kind === 'restaurants' && <section><h3 className="mb-2 font-display text-xl">Restaurant details</h3><div className={group}>
      <label className={lab}>Price level<select className={inp} value={v.priceRange} onChange={e => set('priceRange')(e.target.value)}><option value="">Not set</option>{[[1, '₱ budget'], [2, '₱₱ moderate'], [3, '₱₱₱ upscale'], [4, '₱₱₱₱ fine dining']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="flex items-center gap-3 self-end pb-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.acceptsReservations} onChange={e => set('acceptsReservations')(e.target.checked)} />Take table reservations online</label>
      <TagsEditor label="Cuisines" value={v.cuisines} onChange={set('cuisines')} suggestions={CUISINES} placeholder="Add a cuisine, e.g. Seafood" /></div></section>}
    {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}{msg && <p role="status" className="rounded-xl bg-teal/10 p-3 text-sm text-teal">{msg}</p>}
    <div><button disabled={busy || up > 0} className={`${btn} px-8 disabled:opacity-50`}>{up > 0 ? 'Uploading photos…' : busy ? 'Saving…' : 'Save my page'}</button></div>
  </form>);
}
