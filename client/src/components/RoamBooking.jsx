import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { tokenize } from '../lib/card.js';
import { peso, localText, ROAM } from '../lib/policy.js';
import { btn, btnGhost } from './ui.jsx';
import { CardFields, TermsBox, emptyCard } from './BookingPolicy.jsx';
import { IdUpload } from './IdUpload.jsx';

const pct = (x) => Math.round(x * 100);

/** The Roam policy in plain words, shown before anyone books a rental, a commute or a ride. */
export function RoamPolicySummary({ show = ['rental', 'ride'] }) {
  const R = ROAM.rental, D = ROAM.ride;
  return (<div className="rounded-2xl border border-line bg-white p-4 text-sm">
    <p className="flex items-center gap-2 font-display text-lg"><ShieldCheck size={18} className="text-teal" />Booking policy</p>
    <p className="mt-1 text-xs text-ocean/65">Every request needs a photo of a valid ID, so the driver or provider knows who is booking. A request is only a request until the driver or provider accepts it. If they decline or cancel, anything you paid is refunded in full.</p>
    {show.includes('ride') && <div className="mt-3"><p className="font-medium">Commutes and airport or port rides</p>
      <ul className="mt-1 grid gap-2">
        <li><b>Free cancellation until {D.freeCancelHours} hours before pick-up.</b> A request the driver has not accepted yet can always be withdrawn for free.</li>
        <li>No payment now. A valid credit card stays on file, and you pay the fare to the driver at the end of the trip.</li>
        <li>Cancelling later, or not showing up, charges {pct(D.lateFeeRate)}% of the fare to your card.</li>
        <li>Commute fares follow the distance, and the fare you see is the fare you pay: it is locked when you send the request.</li></ul></div>}
    {show.includes('rental') && <div className="mt-3"><p className="font-medium">Vehicle rentals</p>
      <ul className="mt-1 grid gap-2">
        <li><b>Booked {R.guaranteeHours} hours or more before pick-up.</b> No payment at booking, but a valid credit card must be on file. Free cancellation until {R.guaranteeHours} hours before pick-up. After that, cancelling or not showing up charges {pct(R.lateFeeRate)}% of the rental to the card.</li>
        <li><b>Booked {R.depositHours} to {R.guaranteeHours} hours before pick-up.</b> {pct(R.depositRate)}% is charged at booking and is non-refundable.</li>
        <li><b>Booked less than {R.depositHours} hours before pick-up, same day included.</b> 100% is charged at booking and is non-refundable.</li></ul>
      <p className="mt-2 text-xs text-ocean/65">Pick-up time counts from {R.defaultCheckIn} on the first day. All deadlines use Philippine time.</p></div>}
  </div>);
}

/** What a ride costs and what happens if plans change, from the server's quote. */
export function RideTermsBox({ q }) {
  return (<div className="rounded-2xl border border-teal/40 bg-teal/10 p-4 text-sm" aria-live="polite">
    <p className="font-display text-lg">No payment today</p>
    <ul className="mt-1 grid gap-1">
      <li>Fare <b>{peso(q.fare)}</b>{q.km != null && <> for about {q.km} km</>}, paid to the driver at the end of the trip. The fare is locked once you send the request.</li>
      <li>A valid credit card must be on file.</li>
      <li><b>Free cancellation until {localText(q.cancelUntil)}</b> (Philippine time). A request the driver has not accepted yet can always be withdrawn for free.</li>
      <li>After that, cancelling or not showing up charges {peso(q.lateFee)} ({pct(ROAM.ride.lateFeeRate)}% of the fare) to your card.</li>
      <li className="text-xs text-ocean/65">If the driver declines your request, nothing is charged.</li>
    </ul></div>);
}

/**
 * Confirm a rental or a ride: shows today's terms, takes the card and a photo of a valid ID, and sends the request.
 *   kind 'rental' (quote has tier + dueNow) or 'ride' (quote has fare).  `payload` is what the server needs besides the terms, the card and the ID.
 */
export function RoamDialog({ kind, title, sub, summary, quotePath, postPath, payload, who, onClose, onDone }) {
  const [q, setQ] = useState(null), [card, setCard] = useState(emptyCard), [agree, setAgree] = useState(false), [idPhoto, setIdPhoto] = useState(''), [idOk, setIdOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(''), first = useRef(null);
  const [requestId] = useState(() => (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random())); // one id per dialog, so a repeated send can never book twice
  const loadQuote = () => api(quotePath).then(setQ).catch(e => setErr(e.message));
  useEffect(() => { loadQuote(); first.current?.focus(); const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, []); // eslint-disable-line
  async function submit(e) {
    e.preventDefault(); setErr(''); if (!q) return;
    const t = tokenize(card); if (t.error) return setErr(t.error);
    if (!idPhoto) return setErr('Please attach a photo of a valid ID.'); if (!idOk) return setErr('Please agree to share your ID photo for this booking.');
    if (!agree) return setErr('Please accept the booking policy to continue.');
    setBusy(true);
    try { onDone(await api(postPath, { method: 'POST', body: { ...payload, acceptPolicy: true, requestId, idPhoto, idConsent: true, card: t.card, expect: kind === 'ride' ? { fare: q.fare } : { tier: q.tier, dueNow: q.dueNow } } })); }
    catch (x) { setErr(x.message.includes('Sign in') ? 'Please sign in to book.' : x.message); if (/terms changed|fare changed/.test(x.message)) { setAgree(false); loadQuote(); } setBusy(false); }
  }
  const label = !q ? 'Loading terms…' : busy ? 'Sending…' : kind === 'rental' && q.dueNow > 0 ? `Pay ${peso(q.dueNow)} and send request` : 'Send request (no charge today)';
  return (<div className="fixed inset-0 z-50 grid place-items-end bg-ocean/50 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="roam-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3"><div><h2 id="roam-title" className="font-display text-2xl">{title}</h2>{sub && <p className="text-sm text-ocean/70">{sub}</p>}</div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-foam"><X size={20} /></button></div>
      {summary && <p className="mt-2 text-sm">{summary}</p>}
      <div className="mt-3">{q ? (kind === 'ride' ? <RideTermsBox q={q} /> : <TermsBox q={q} kind="rental" />) : <p className="text-sm text-ocean/60">{err || 'Loading the terms for your request…'}</p>}</div>
      <div className="mt-4" ref={first} tabIndex={-1}><CardFields value={card} onChange={setCard} /></div>
      <div className="mt-4"><IdUpload value={idPhoto} onChange={setIdPhoto} consent={idOk} onConsent={setIdOk} who={who} /></div>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>I have read the terms above and accept the booking policy. I understand my request goes to {who} for approval.</span></label>
      {err && q && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Not now</button><button disabled={!q || busy} className={`${btn} disabled:opacity-50`}>{label}</button></div>
    </form></div>);
}
