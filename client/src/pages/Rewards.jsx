import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Gift, Trophy, Copy, Check, Camera } from 'lucide-react';
import Album, { albumOf } from '../components/Album.jsx';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Cover from '../components/Cover.jsx';
import { PageHeader, Empty, Drawer } from '../components/ui.jsx';
export default function Rewards() {
  const [rewards, setRewards] = useState([]), [me, setMe] = useState(null), [board, setBoard] = useState([]), [msg, setMsg] = useState(null), [copied, setCopied] = useState(false), [view, setView] = useState(null);
  const load = () => { api('/rewards').then(setRewards); api('/rewards/leaderboard').then(setBoard); api('/checkin/me').then(setMe).catch(() => setMe(null)); };
  const ver = useSyncVersion();
  useEffect(load, [ver]);
  async function redeem(id) { try { const d = await api(`/rewards/${id}/redeem`, { method: 'POST' }); setMsg({ code: d.claimCode }); load(); } catch (e) { setMsg({ err: e.message.includes('Sign in') ? 'Sign in to redeem rewards.' : e.message }); } }
  const bal = me?.balance ?? 0, medal = ['bg-[#FFC21A]', 'bg-slate-300', 'bg-[#cd8b5a]'];
  return (<main className="mx-auto max-w-6xl px-4 py-6"><PageHeader title="Rewards" sub="Every place you check in earns points. Harder-to-reach places earn more."><Link to="/scan" className="rounded-full bg-sun px-5 py-2 font-display font-semibold text-ocean hover:bg-white">Scan a QR</Link>{me && <div className="rounded-2xl bg-white/15 px-6 py-3 text-center backdrop-blur"><p className="font-display text-4xl font-bold">{bal}</p><p className="text-sm text-foam/80">your points</p></div>}</PageHeader>
    {msg?.code && <section className="mt-5 rounded-3xl border-2 border-dashed border-teal bg-white p-6 text-center"><p className="text-sm text-ocean/70">Show this code at the tourism office to claim your reward</p><p className="my-2 break-all font-mono text-2xl font-bold tracking-widest text-ocean sm:text-4xl">{msg.code}</p><button className="inline-flex items-center gap-2 text-sm underline" onClick={() => { navigator.clipboard?.writeText(msg.code); setCopied(true); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy code'}</button></section>}
    {msg?.err && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{msg.err}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-3"><section className="lg:col-span-2"><h2 className="mb-3 font-display text-2xl">Rewards catalog</h2>
      {rewards.length === 0 ? <Empty Icon={Gift}>No rewards yet. The tourism office will add them.</Empty> : <div className="grid gap-4 sm:grid-cols-2">{rewards.map(r => { const pct = Math.min(100, (bal / r.points_cost) * 100), ok = bal >= r.points_cost; return (<article key={r.id} className="lift overflow-hidden rounded-3xl border border-line bg-white"><Cover name={r.name} photo={r.cover_photo || r.photos?.[0]} className="h-36"><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold">{r.points_cost} pts</span>{!albumOf(r).length && <Gift className="absolute bottom-3 left-3 text-white/80" />}</Cover>
        <div className="p-4"><h3 className="font-display text-xl">{r.name}</h3><p className="text-sm text-ocean/70">{r.description}</p>{albumOf(r).length > 0 && <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm underline" onClick={() => setView(r)}><Camera size={14} />View photos ({albumOf(r).length})</button>}{r.stock != null && <p className="mt-1 text-xs text-ocean/55">{r.stock} left</p>}{me && <div className="mt-3 h-2 rounded-full bg-foam"><div className="h-2 rounded-full bg-gradient-to-r from-teal to-ocean" style={{ width: `${pct}%` }} /></div>}
          <button onClick={() => redeem(r.id)} className={`mt-3 w-full rounded-full px-4 py-2 text-sm font-medium ${ok || !me ? 'bg-ocean text-foam hover:bg-teal' : 'bg-foam text-ocean/60'}`}>{ok || !me ? 'Redeem' : `${r.points_cost - bal} more points needed`}</button></div></article>); })}</div>}</section>
      <aside><h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Trophy className="text-tang" />Top explorers</h2><ol className="grid gap-2">{board.length === 0 && <Empty>No check-ins yet.</Empty>}{board.map((b, i) => <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3"><span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${i < 3 ? medal[i] + ' text-white' : 'bg-foam'}`}>{i + 1}</span><span className="flex-1 font-medium">{b.full_name}</span><b>{b.points}</b></li>)}</ol></aside></div>
    <Drawer open={!!view} onClose={() => setView(null)} title={view?.name || ''}>{view && <><p className="mb-2 text-ocean/75">{view.description}</p><p className="mb-4 font-semibold">{view.points_cost} points</p><Album photos={albumOf(view)} name={view.name} /></>}</Drawer></main>);
}
