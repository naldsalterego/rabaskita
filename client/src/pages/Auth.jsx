import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Gift, BedDouble } from 'lucide-react';
import { api, isDemo } from '../lib/api.js';
import { mode } from '../lib/mode.js';
const DEMOS = [['Tourist', 'tourist'], ['Business owner', 'owner'], ['Transport provider', 'provider'], ['Admin', 'admin']];
export default function Auth({ mode }) {
  const [f, setF] = useState({ email: '', password: '', fullName: '', role: 'tourist' }), [err, setErr] = useState(''), nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); const inp = 'w-full rounded-xl border border-line bg-white px-4 py-3';
  const enter = (d) => { localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); location.href = '/dashboard'; };
  async function submit(e) { e.preventDefault(); setErr(''); try { enter(await api(`/auth/${mode}`, { method: 'POST', body: f })); } catch (x) { setErr(x.message); } }
  return (<main className="mx-auto grid max-w-5xl gap-0 overflow-hidden px-4 py-8 md:grid-cols-2"><section className="relative hidden flex-col justify-between overflow-hidden rounded-l-3xl bg-gradient-to-br from-ocean via-[#3340B5] to-sky p-8 text-foam md:flex"><div aria-hidden className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-sand/20 blur-2xl" />
    <div className="relative"><h2 className="font-display text-4xl font-bold leading-tight">Your island trip, organised.</h2><p className="mt-3 text-foam/80">One account for stays, rides, rewards and your itinerary.</p></div>
    <ul className="relative grid gap-3 text-sm">{[[Compass, 'Discover places and get directions'], [BedDouble, 'Book stays and rides'], [Gift, 'Earn points at every place you visit']].map(([I, t]) => <li key={t} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><I size={17} /></span>{t}</li>)}</ul></section>
    <section className="rounded-3xl border border-line bg-white p-8 md:rounded-l-none"><h1 className="font-display text-3xl">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        {mode === 'register' && <><input className={inp} placeholder="Full name" value={f.fullName} onChange={set('fullName')} required /><select className={inp} value={f.role} onChange={set('role')}><option value="tourist">I'm a tourist</option><option value="business_owner">I own a business</option><option value="transport_provider">I provide transport</option></select></>}
        <input className={inp} type="email" placeholder="Email" value={f.email} onChange={set('email')} required /><input className={inp} type="password" placeholder="Password (8+ characters)" value={f.password} onChange={set('password')} required minLength={8} />
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}<button className="rounded-full bg-ocean py-3 font-medium text-foam hover:bg-teal">{mode === 'login' ? 'Sign in' : 'Create account'}</button></form>
      <p className="mt-4 text-sm text-ocean/70">{mode === 'login' ? <>New here? <Link className="underline" to="/register">Create an account</Link></> : <>Already registered? <Link className="underline" to="/login">Sign in</Link></>}</p>
      {isDemo && <div className="mt-6 rounded-2xl bg-foam p-4"><p className="mb-2 text-sm font-medium">Demo mode: jump straight in as</p><div className="grid grid-cols-2 gap-2">{DEMOS.filter(([, e]) => !(mode.adminLocked && e === 'admin')).map(([l, e]) => <button key={e} type="button" className="rounded-xl border border-line bg-white px-3 py-2 text-sm hover:border-teal" onClick={async () => enter(await api('/auth/login', { method: 'POST', body: { email: e + '@demo.test', password: 'demo1234' } }))}>{l}</button>)}</div></div>}</section></main>);
}
