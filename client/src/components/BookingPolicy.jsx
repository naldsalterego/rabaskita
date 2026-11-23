import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, CreditCard, X, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { tokenize, groupCard, SANDBOX_CARDS } from '../lib/card.js';
import { peso, localText, POLICY } from '../lib/policy.js';
import { inp, btn, btnGhost } from './ui.jsx';

const late = (total) => peso(Math.round(total * POLICY.lateFeeRate * 100) / 100);

/** The policy in plain words, shown on every stay page before anyone books. */
export function PolicySummary() {
  return (<div className="rounded-2xl border border-line bg-white p-4 text-sm">
    <p className="flex items-center gap-2 font-display text-lg"><ShieldCheck size={18} className="text-teal" />Booking policy</p>
    <ul className="mt-2 grid gap-3">
      <li><b>Booked 72 hours or more before check-in.</b> No payment at booking, but a valid credit card must be on file. Free cancellation until 72 hours before check-in. If the booking is not guaranteed by that deadline, the reservation is released automatically. We send a reminder 96 hours before check-in. After the deadline, cancelling or not showing up charges {Math.round(POLICY.lateFeeRate * 100)}% of the stay to the card.</li>
      <li><b>Booked 48 to 72 hours before check-in.</b> {Math.round(POLICY.depositRate * 100)}% of the total stay is charged at booking and is non-refundable. If you do not show up, the deposit is forfeited and nothing more is charged.</li>
      <li><b>Booked less than 48 hours before check-in, same day included.</b> 100% of the total stay is charged at booking and is non-refundable. If you do not show up, the full amount is forfeited.</li>
    </ul>
    <p className="mt-3 text-xs text-ocean/65">All deadlines use hotel local time (Philippine time). All amounts include taxes and mandatory fees. Your booking is a request until the hotel accepts it. If the hotel declines or cancels, anything you paid is refunded in full.</p>
  </div>);
}

/** What this booking costs and what happens if plans change, from the server's current quote. */
export function TermsBox({ q }) {
  const tone = q.tier === 'guarantee' ? 'border-teal/40 bg-teal/10' : 'border-tang/50 bg-sand/40';
  const head = q.tier === 'guarantee' ? 'No payment today' : `${peso(q.dueNow)} charged today${q.tier === 'deposit' ? ' (50% deposit)' : ' (100% of the stay)'}`;
  return (<div className={`rounded-2xl border p-4 text-sm ${tone}`} aria-live="polite">
    <p className="font-display text-lg">{head}</p>
    <ul className="mt-1 grid gap-1">
      {q.tier === 'guarantee' && <>
        <li>A valid credit card must be on file to guarantee the booking.</li>
        <li><b>Free cancellation until {localText(q.cancelUntil)}</b> (hotel local time).</li>
        <li>After that, cancelling or not showing up charges {late(q.total)} to your card. If the booking is not guaranteed by the deadline, it is released automatically.</li>
        {q.reminderAt && <li>We will remind you 96 hours before check-in.</li>}
        <li>Total {peso(q.total)}, paid at the property.</li></>}
      {q.tier === 'deposit' && <>
        <li>Non-refundable once booked.</li>
        <li>No-show: the deposit is forfeited. No additional charge.</li>
        <li>The balance of {peso(q.balance)} is paid at the property.</li></>}
      {q.tier === 'full' && <>
        <li>Non-refundable once booked.</li>
        <li>No-show: the full amount is forfeited.</li></>}
      <li className="text-xs text-ocean/65">All amounts include taxes and mandatory fees. If the hotel declines your request, you are refunded in full.</li>
    </ul>
  </div>);
}

/** Card inputs. The number and security code stay in this browser: only a token and the last 4 digits are ever sent. */
export function CardFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: k === 'number' ? groupCard(e.target.value) : e.target.value });
  return (<fieldset className="grid gap-2">
    <legend className="mb-1 flex items-center gap-2 text-sm font-medium"><CreditCard size={16} className="text-teal" />Credit card</legend>
    <input className={inp} inputMode="numeric" autoComplete="cc-number" placeholder="Card number" aria-label="Card number" value={value.number} onChange={set('number')} />
    <div className="grid grid-cols-2 gap-2">
      <input className={inp} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" aria-label="Expiry date (MM/YY)" maxLength={7} value={value.exp} onChange={set('exp')} />
      <input className={inp} inputMode="numeric" autoComplete="cc-csc" placeholder="Security code" aria-label="Security code" maxLength={4} type="password" value={value.cvc} onChange={set('cvc')} />
    </div>
    <p className="flex items-start gap-1.5 text-xs text-ocean/60"><Lock size={12} className="mt-0.5 shrink-0" /><span>Sandbox: no real money moves, and your card number is never sent or saved. Try {SANDBOX_CARDS.map(([n, w], i) => <span key={n}>{i ? '; ' : ''}<code>{n}</code> {w}</span>)}.</span></p>
  </fieldset>);
}
export const emptyCard = { number: '', exp: '', cvc: '' };

/** Confirm a stay request: shows today's terms for these dates, takes the card, and sends the request to the hotel. */
export function RequestDialog({ room, hotel, checkIn, checkOut, guests, onClose, onDone }) {
  const [q, setQ] = useState(null), [card, setCard] = useState(emptyCard), [agree, setAgree] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(''), first = useRef(null), [requestId] = useState(() => (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random())); // one id per dialog, so a repeated send can never book twice
  const loadQuote = () => api(`/bookings/quote?roomId=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`).then(setQ).catch(e => setErr(e.message));
  useEffect(() => { loadQuote(); first.current?.focus(); const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, []); // eslint-disable-line
  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!q) return;
    const t = tokenize(card); if (t.error) return setErr(t.error);
    if (!agree) return setErr('Please accept the booking policy to continue.');
    setBusy(true);
    try { onDone(await api('/bookings/stay', { method: 'POST', body: { roomId: room.id, checkIn, checkOut, guests: Number(guests), acceptPolicy: true, requestId, card: t.card, expect: { tier: q.tier, dueNow: q.dueNow } } })); }
    catch (x) { setErr(x.message.includes('Sign in') ? 'Please sign in to book.' : x.message); if (/terms changed/.test(x.message)) { setAgree(false); loadQuote(); } setBusy(false); }
  }
  const label = !q ? 'Loading terms…' : busy ? 'Sending…' : q.dueNow > 0 ? `Pay ${peso(q.dueNow)} and send request` : 'Send request (no charge today)';
  return (<div className="fixed inset-0 z-50 grid place-items-end bg-ocean/50 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="req-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3"><div><h2 id="req-title" className="font-display text-2xl">Request to book</h2><p className="text-sm text-ocean/70">{hotel} · {room.name}</p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-foam"><X size={20} /></button></div>
      <p className="mt-2 text-sm">{checkIn} to {checkOut} · {q ? `${q.nights} night${q.nights === 1 ? '' : 's'}` : ''} · {guests} guest{Number(guests) === 1 ? '' : 's'}{q && <> · <b>Total {peso(q.total)}</b> <span className="text-ocean/60">(taxes and fees included)</span></>}</p>
      <div className="mt-3">{q ? <TermsBox q={q} /> : <p className="text-sm text-ocean/60">{err || 'Loading the terms for your dates…'}</p>}</div>
      <div className="mt-4" ref={first} tabIndex={-1}><CardFields value={card} onChange={setCard} /></div>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>I have read the terms above and accept the booking policy. I understand my request goes to the hotel for approval.</span></label>
      {err && q && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Not now</button><button disabled={!q || busy} className={`${btn} disabled:opacity-50`}>{label}</button></div>
    </form></div>);
}
