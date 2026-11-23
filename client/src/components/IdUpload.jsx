import { useEffect, useRef, useState } from 'react';
import { Contact, Camera, X, Lock, Eye } from 'lucide-react';
import { saveIdPhoto, idPhotoUrl, deletePhoto } from '../lib/photos.js';
import { ROAM } from '../lib/policy.js';
import { btnGhost } from './ui.jsx';

/** Asks for a photo of a valid ID. Required on every stay, rental and ride request. The booking cannot be sent without it. */
export function IdUpload({ value, onChange, consent, onConsent, who = 'the business' }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [preview, setPreview] = useState(''), input = useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function pick(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setErr(''); setBusy(true);
    try { const ref = await saveIdPhoto(f); if (value?.startsWith('idb:')) deletePhoto(value); setPreview(URL.createObjectURL(f)); onChange(ref); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  function remove() { if (value?.startsWith('idb:')) deletePhoto(value); setPreview(''); onChange(''); onConsent(false); }
  return (<fieldset className="grid gap-2">
    <legend className="mb-1 flex items-center gap-2 text-sm font-medium"><Contact size={16} className="text-teal" />Photo of a valid ID <span className="text-xs font-normal text-red-700">(required)</span></legend>
    <p className="text-xs text-ocean/70">Take or choose a clear photo of a government-issued ID that shows your name and photo, such as a passport, driver's license, UMID, PhilSys ID or PRC ID. All four corners should be visible and the text readable.</p>
    {value ? <div className="flex items-center gap-3 rounded-2xl border border-line bg-foam p-2">
      {preview ? <img src={preview} alt="Your ID photo" className="h-16 w-24 rounded-xl object-cover" /> : <span className="grid h-16 w-24 place-items-center rounded-xl bg-white text-ocean/40"><Contact size={24} /></span>}
      <p className="flex-1 text-sm">ID photo attached.</p>
      <button type="button" onClick={remove} className={`${btnGhost} inline-flex items-center gap-1`}><X size={14} />Remove</button></div>
      : <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white p-4 text-sm hover:border-teal disabled:opacity-60"><Camera size={18} className="text-teal" />{busy ? 'Uploading…' : 'Take or choose a photo of your ID'}</button>}
    <input ref={input} type="file" accept="image/*" className="sr-only" onChange={pick} aria-label="Photo of your valid ID" />
    {err && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">{err}</p>}
    <p className="flex items-start gap-1.5 text-xs text-ocean/60"><Lock size={12} className="mt-0.5 shrink-0" /><span>Private. Only {who} and the tourism office can open it. It is never shown publicly, and it is deleted {ROAM.idRetentionDays} days after your booking ends.</span></p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!consent} onChange={e => onConsent(e.target.checked)} /><span>I agree to share this ID photo with {who} so they can verify who is booking.</span></label>
  </fieldset>);
}

/** For a business or transport provider: opens the guest's ID photo in a new tab. The server checks who is asking and keeps a log. */
export function IdPhotoButton({ photo }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  if (!photo) return <span className="text-xs text-ocean/55">No ID photo on file</span>;
  async function open() {
    const w = window.open('', '_blank'); if (!w) return setErr('Please allow pop-ups to view the ID.');
    setErr(''); setBusy(true);
    try {
      const url = await idPhotoUrl(photo); if (!url) throw new Error('This ID photo is no longer available.');
      w.document.write(`<title>Guest ID photo</title><body style="margin:0;background:#111;display:grid;place-items:center;min-height:100vh"><img src="${url}" alt="Guest ID photo" style="max-width:100vw;max-height:100vh"></body>`); w.document.close();
    } catch (e) { w.close(); setErr(e.message); }
    setBusy(false);
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={open} className="inline-flex items-center gap-1 text-teal underline disabled:opacity-50"><Eye size={13} />{busy ? 'Opening…' : 'View ID photo'}</button>{err && <span role="alert" className="text-xs text-red-800">{err}</span>}</span>;
}
