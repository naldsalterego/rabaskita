import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link } from 'react-router-dom';
import { BedDouble, Bus, Utensils, ArrowRight, Car } from 'lucide-react';
import { api } from '../lib/api.js';
import { PageHeader, Badge, Empty } from '../components/ui.jsx';
import { CardFields, emptyCard } from '../components/BookingPolicy.jsx';
import Messages from '../components/Messages.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { tokenize } from '../lib/card.js';
import { peso, localText } from '../lib/policy.js';
const BY = { guest: 'You cancelled this booking.', hotel: 'The hotel cancelled this booking.', system: 'This booking was released automatically.' };
// What cancelling means for the guest's money. The server worked out the exact consequence (s.terms); this only words it.
//   lost:    already paid and not refundable   fee: a charge to the card on file   ok: free, or fully refunded
function cancelInfo(s) {
  const t = s.terms, card = s.card ? `${s.card.brand} ••${s.card.last4}` : 'your card';
  if (!s.tier) return s.payment_status === 'paid' ? { kind: 'lost', amount: s.total } : { kind: 'ok', text: 'Nothing has been paid, so nothing will be charged.' };
  if (t?.note === 'withdrawn') return { kind: 'ok', withdraw: true, text: t.refund > 0 ? `The hotel has not accepted your request yet. Your ${peso(t.refund)} will be refunded to you in full.` : 'The hotel has not accepted your request yet, and nothing was charged.' };
  if (t?.note === 'free') return { kind: 'ok', text: 'This is a free cancellation. Nothing will be charged.' };
  if (t?.note === 'late') return { kind: 'fee', amount: t.fee, text: `Free cancellation has ended. Cancelling now charges ${peso(t.fee)} to ${card}.` };
  return { kind: 'lost', amount: t?.forfeited || s.charged };
}
function CancelDialog({ item, working, onConfirm, onClose }) {
  const [agree, setAgree] = useState(false), isRental = item.kind === 'rental', r = item.r, s = item.s;
  const info = isRental ? (r.payment_status === 'paid' ? { kind: 'lost', amount: r.total } : { kind: 'ok', text: 'Nothing has been paid, so nothing will be charged.' }) : cancelInfo(s);
  const what = isRental ? r.vehicle : s.name, when = isRental ? `${r.start_date} to ${r.end_date}` : `${s.check_in.slice(0, 10)} to ${s.check_out.slice(0, 10)}`;
  return (<ConfirmDialog title={info.withdraw ? 'Withdraw your request?' : isRental ? 'Cancel this rental?' : 'Cancel your booking?'} confirmLabel={info.withdraw ? 'Yes, withdraw request' : isRental ? 'Yes, cancel rental' : 'Yes, cancel booking'} cancelLabel={isRental ? 'Keep my rental' : 'Keep my booking'}
    busy={working} disabled={info.kind === 'lost' && !agree} onConfirm={onConfirm} onClose={onClose}>
    <p className="rounded-xl bg-foam p-3"><b>{what}</b><br />{when}</p>
    {info.kind === 'lost' && <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-red-900">
      <p className="font-display text-lg">Your payment will not be refunded</p>
      <p className="mt-1">You already paid <b>{peso(info.amount)}</b>. If you cancel, you will <b>not</b> get that money back.</p>
      <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>I understand I will not get my {peso(info.amount)} back.</span></label></div>}
    {info.kind === 'fee' && <p role="alert" className="rounded-xl border border-tang/60 bg-sand/60 p-3">{info.text}</p>}
    {info.kind === 'ok' && <p className="rounded-xl bg-teal/10 p-3">{info.text}</p>}
  </ConfirmDialog>);
}
function StayCard({ s, card, onPay, onCancel, onChanged, setErr }) {
  const [fix, setFix] = useState(false), [cf, setCf] = useState(emptyCard), [busy, setBusy] = useState(false), active = ['pending', 'confirmed'].includes(s.status);
  const money = !s.tier ? [s.payment_status === 'paid' ? 'paid' : 'pending', `payment ${s.payment_status}`]
    : s.payment_status === 'refunded' ? ['paid', `${peso(s.charged)} refunded`]
    : s.tier === 'guarantee' ? (s.guarantee === 'pending' ? ['pending', 'card needs attention'] : s.guarantee === 'released' ? ['cancelled', 'released'] : ['paid', 'card on file'])
    : ['paid', s.tier === 'deposit' ? `${peso(s.charged)} deposit paid` : `${peso(s.charged)} paid in full`];
  async function saveCard(e) {
    e.preventDefault(); const t = tokenize(cf); if (t.error) return setErr(t.error);
    setBusy(true); setErr('');
    try { await api(`/bookings/stay/${s.id}/guarantee`, { method: 'POST', body: { card: t.card } }); setFix(false); setCf(emptyCard); onChanged(); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<div className={card}><div>
    <p className="font-display text-xl">{s.name}</p>
    <p className="text-sm text-ocean/70">{s.check_in.slice(0, 10)} <ArrowRight size={12} className="inline" /> {s.check_out.slice(0, 10)} · ₱{s.total.toLocaleString()} <span className="text-ocean/50">(taxes and fees included)</span></p>
    <p className="mt-1 flex flex-wrap gap-2"><Badge s={s.status}>{s.status === 'pending' ? 'waiting for the hotel' : s.status}</Badge><Badge s={money[0]}>{money[1]}</Badge></p>
    {s.tier === 'guarantee' && s.card && <p className="mt-1 text-sm text-ocean/70">{s.card.brand} ••{s.card.last4} on file{active && s.terms && (s.terms.free ? ` · free cancellation until ${localText(s.free_cancel_until)} (Philippine time)` : ` · free cancellation has ended; cancelling now charges ${peso(s.terms.fee)}`)}</p>}
    {s.tier && s.tier !== 'guarantee' && active && <p className="mt-1 text-sm text-ocean/70">Non-refundable once the hotel accepts.{s.tier === 'deposit' ? ' The balance is paid at the property.' : ''}</p>}
    {s.fee_charged > 0 && <p className="mt-1 text-sm text-red-800">{peso(s.fee_charged)} was charged to your card.</p>}
    {s.status === 'no_show' && s.tier !== 'guarantee' && <p className="mt-1 text-sm text-ocean/70">Marked as a no-show. The {peso(s.charged)} you paid is kept by the hotel.</p>}
    {!active && s.cancelled_by && <p className="mt-1 text-sm text-ocean/70">{BY[s.cancelled_by]}</p>}
  </div>
    <div className="flex flex-wrap gap-2">
      {!s.tier && s.payment_status === 'pending' && s.status !== 'cancelled' && <button onClick={() => onPay(s.payment_id)} className="rounded-full bg-ocean px-5 py-2 text-sm font-medium text-foam hover:bg-teal">Pay now (sandbox)</button>}
      {s.guarantee === 'pending' && active && <button onClick={() => setFix(!fix)} className="rounded-full bg-ocean px-5 py-2 text-sm font-medium text-foam hover:bg-teal">Update card</button>}
      {active && <button onClick={() => onCancel(s)} className="rounded-full border border-line px-4 py-2 text-sm">{s.status === 'pending' && s.tier ? 'Withdraw request' : 'Cancel'}</button>}
    </div>
    {fix && <form onSubmit={saveCard} className="w-full basis-full rounded-2xl bg-foam p-4"><p className="mb-2 text-sm">We could not verify your card. Add a valid card before {localText(s.free_cancel_until)} (Philippine time) or the booking is released automatically.</p><CardFields value={cf} onChange={setCf} /><button disabled={busy} className="mt-3 rounded-full bg-ocean px-5 py-2 text-sm font-medium text-foam disabled:opacity-50">{busy ? 'Saving…' : 'Save card'}</button></form>}
    <Messages kind="stay" id={s.id} unread={s.unread_messages} to={s.name} onRead={onChanged} />
  </div>);
}
export default function Bookings() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [note, setNote] = useState(''), [tab, setTab] = useState('stays'), [ask, setAsk] = useState(null), [working, setWorking] = useState(false);
  const load = () => Promise.all([api('/bookings/mine'), api('/rentals/mine')]).then(([a, b]) => setD({ ...a, rentals: b })).catch(e => setErr(e.message));
  const cancelRent = (r) => { setErr(''); setNote(''); setAsk({ kind: 'rental', r }); }; const ver = useSyncVersion(); useEffect(() => { load(); }, [ver]);
  const pay = async (id) => { await api(`/payments/${id}/sandbox-confirm`, { method: 'POST' }).catch(e => setErr(e.message)); load(); };
  const cancel = (s) => { setErr(''); setNote(''); setAsk({ kind: 'stay', s }); };
  const confirmCancel = async () => {
    setWorking(true);
    try {
      if (ask.kind === 'rental') { await api(`/rentals/${ask.r.id}/cancel`, { method: 'POST' }); setNote(ask.r.payment_status === 'paid' ? `Rental cancelled. Your ${peso(ask.r.total)} is not refunded.` : 'Rental cancelled. Nothing was charged.'); }
      else { const r = await api(`/bookings/stay/${ask.s.id}/cancel`, { method: 'POST' }); setNote(r.refunded > 0 ? `Cancelled. ${peso(r.refunded)} has been refunded to you.` : r.charged > 0 ? `Cancelled. ${peso(r.charged)} was charged to your card.` : r.forfeited > 0 ? `Cancelled. Your ${peso(r.forfeited)} is not refunded.` : 'Cancelled. Nothing was charged.'); }
    } catch (e) { setErr(e.message); }
    setWorking(false); setAsk(null); load();
  };
  if (err && !d) return <main className="mx-auto max-w-3xl px-4 py-10"><Empty>{err.includes('Sign in') ? <>Please <Link className="underline" to="/login">sign in</Link> to see your bookings.</> : err}</Empty></main>;
  if (!d) return <p className="p-8">Loading…</p>;
  const tabs = [['stays', 'Stays', BedDouble, d.stays.length], ['rentals', 'Rentals', Car, d.rentals.length], ['rides', 'Rides', Bus, d.rides.length], ['tables', 'Tables', Utensils, d.tables.length]];
  const card = 'flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-white p-5';
  return (<main className="mx-auto max-w-4xl px-4 py-6"><PageHeader title="My bookings" sub="Stays, rides and table reservations in one place." />
    <div className="mt-5 flex gap-2">{tabs.map(([id, l, I, n]) => <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${tab === id ? 'border-ocean bg-ocean text-foam' : 'border-line bg-white'}`}><I size={16} />{l} <span className="opacity-70">{n}</span></button>)}</div>
    {ask && <CancelDialog item={ask} working={working} onConfirm={confirmCancel} onClose={() => setAsk(null)} />}
    {note && <p role="status" className="mt-3 rounded-xl bg-teal/10 p-3 text-sm">{note}</p>}
    {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
    <div className="mt-4 grid gap-3">
      {tab === 'stays' && (d.stays.length === 0 ? <Empty Icon={BedDouble}>No stays yet. <Link className="underline" to="/accommodations">Find a place to stay</Link></Empty> : d.stays.map(s => <StayCard key={s.id} s={s} card={card} onPay={pay} onCancel={cancel} onChanged={load} setErr={setErr} />))}
      {tab === 'rentals' && (d.rentals.length === 0 ? <Empty Icon={Car}>No rentals yet. <Link className="underline" to="/transportation">Rent a vehicle</Link></Empty> : d.rentals.map(r => <div key={r.id} className={card}><div><p className="font-display text-xl">{r.vehicle}</p><p className="text-sm text-ocean/70">{r.start_date} <ArrowRight size={12} className="inline" /> {r.end_date} · {r.mode === 'driver' ? `with driver${r.driver_name ? ' (' + r.driver_name + ')' : ''}` : 'self-drive'} · ₱{r.total.toLocaleString()}</p><p className="text-sm text-ocean/70">To: {r.destinations.join(', ')} · pickup {r.pickup}</p><p className="mt-1 flex gap-2"><Badge s={r.status} /><Badge s={r.payment_status === 'paid' ? 'paid' : 'pending'}>payment {r.payment_status}</Badge></p></div>
        <div className="flex gap-2">{r.payment_status === 'pending' && !['cancelled', 'rejected'].includes(r.status) && <button onClick={() => pay(r.payment_id)} className="rounded-full bg-ocean px-5 py-2 text-sm font-medium text-foam hover:bg-teal">Pay now (sandbox)</button>}{['pending', 'confirmed'].includes(r.status) && <button onClick={() => cancelRent(r)} className="rounded-full border border-line px-4 py-2 text-sm">Cancel</button>}</div><Messages kind="rental" id={r.id} unread={r.unread_messages} to="the rental provider" onRead={load} /></div>))}
      {tab === 'rides' && (d.rides.length === 0 ? <Empty Icon={Bus}>No rides yet. <Link className="underline" to="/transportation">Request a ride</Link></Empty> : d.rides.map(t => <div key={t.id} className={card}><div><p className="font-display text-xl">{t.pickup} <ArrowRight size={14} className="inline" /> {t.dropoff}</p><p className="text-sm text-ocean/70">{new Date(t.pickup_at).toLocaleString()} · {t.passengers} passenger(s){t.driver_name && ` · driver ${t.driver_name}`}</p></div><Badge s={t.status} /><Messages kind="ride" id={t.id} unread={t.unread_messages} to="the transport provider" onRead={load} /></div>))}
      {tab === 'tables' && (d.tables.length === 0 ? <Empty Icon={Utensils}>No reservations yet. <Link className="underline" to="/restaurants">Find a restaurant</Link></Empty> : d.tables.map(t => <div key={t.id} className={card}><div><p className="font-display text-xl">{t.name}</p><p className="text-sm text-ocean/70">{new Date(t.reserved_at).toLocaleString()} · party of {t.party_size}</p></div><Badge s={t.status} /><Messages kind="table" id={t.id} unread={t.unread_messages} to={t.name} onRead={load} /></div>))}
    </div><p className="mt-4 text-xs text-ocean/55">Payments in this prototype are simulated. No real money moves.</p></main>);
}
