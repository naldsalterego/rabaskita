import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScanLine, ImageUp, Keyboard, PartyPopper, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { tokenFromScan, decodeFrame } from '../lib/qr.js';
import QrScanner from '../components/QrScanner.jsx';
import { PageHeader, btn, inp } from '../components/ui.jsx';
async function decodePhoto(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, c.width, c.height); return decodeFrame(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
}
export default function Scan() {
  const [sp] = useSearchParams(), expect = sp.get('name'), signedIn = !!localStorage.getItem('token');
  const [round, setRound] = useState(0), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [code, setCode] = useState(''), [problem, setProblem] = useState(''), file = useRef(null);
  async function submit(text) {
    const token = tokenFromScan(text); setBusy(true);
    if (!token) { setRes({ error: "That QR code isn't a Rabas Kita! place code." }); setBusy(false); return; }
    try { setRes({ ok: await api('/checkin', { method: 'POST', body: { token } }) }); } catch (e) { setRes({ error: e.message.includes('Sign in') ? 'Please sign in to collect points.' : e.message }); }
    setBusy(false);
  }
  async function photo(e) { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setBusy(true); try { const t = await decodePhoto(f); if (!t) { setRes({ error: 'No QR code was found in that photo. Try a clearer, closer picture.' }); setBusy(false); } else await submit(t); } catch { setRes({ error: 'That image could not be read.' }); setBusy(false); } }
  const again = () => { setRes(null); setRound(r => r + 1); };
  if (!signedIn) return <main className="mx-auto max-w-xl px-4 py-8"><PageHeader title="Scan a QR code" sub="Sign in first so your points are saved to your account." /><div className="mt-6 rounded-3xl border border-line bg-white p-6 text-center"><Link to="/login" className={`${btn} inline-block px-8 py-3`}>Sign in to scan</Link></div></main>;
  return (<main className="mx-auto max-w-xl px-4 py-6"><PageHeader title="Scan a place's QR" sub={expect ? `Scan the QR code at ${expect} to collect your points.` : 'Scan the QR code at a place you visited to collect points.'} />
    <div className="mt-5">{res?.ok ? <div className="rounded-3xl border border-teal/30 bg-white p-8 text-center"><PartyPopper size={44} className="mx-auto text-tang" /><h2 className="mt-3 font-display text-3xl">+{res.ok.points} points!</h2><p className="mt-1 text-lg">You checked in at <b>{res.ok.place}</b>.</p>
        {expect && res.ok.place && !res.ok.place.toLowerCase().includes(expect.toLowerCase()) && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Note: this QR code belongs to {res.ok.place}, not {expect}.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={again} className={btn}>Scan another</button><Link to="/rewards" className="rounded-full border border-line px-5 py-2 text-sm font-medium">See my points</Link></div></div>
      : res?.error ? <div className="rounded-3xl border border-red-200 bg-white p-8 text-center"><AlertTriangle size={40} className="mx-auto text-red-600" /><p role="alert" className="mt-3 text-lg">{res.error}</p><div className="mt-5"><button onClick={again} className={btn}>Try again</button></div></div>
      : <>{busy ? <div className="grid aspect-square place-items-center rounded-3xl bg-foam sm:aspect-[4/3]">Checking the code…</div> : <QrScanner key={round} onCode={submit} onProblem={setProblem} />}
        <div className="mt-4 grid gap-3 rounded-3xl border border-line bg-white p-4"><p className="flex items-center gap-2 text-sm font-medium"><ScanLine size={16} className="text-teal" />Camera not working?</p>
          <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-teal"><ImageUp size={16} />Upload a photo of the QR</button><input ref={file} type="file" accept="image/*" className="sr-only" onChange={photo} /></div>
          <form onSubmit={e => { e.preventDefault(); submit(code); }} className="flex flex-wrap items-center gap-2"><Keyboard size={16} className="text-teal" /><input className={`${inp} min-w-0 flex-1`} placeholder="Or type the code or link under the QR" value={code} onChange={e => setCode(e.target.value)} /><button disabled={!code.trim()} className={`${btn} disabled:opacity-40`}>Use code</button></form></div></>}</div></main>);
}
