import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSyncVersion } from '../lib/sync.js';
import { btn } from './ui.jsx';
import { refreshUnread } from '../lib/unread.js';
const when = (iso) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

/** A short conversation about one booking. Works for the guest and for the business side, and either can write first.
 *  kind is stay, table, ride or rental; `to` is who the person is writing to; onRead refreshes the parent's unread count. */
export default function Messages({ kind, id, unread = 0, to = 'the business', onRead }) {
  const [open, setOpen] = useState(false), [d, setD] = useState(null), [text, setText] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), ver = useSyncVersion(), box = useRef(null);
  const load = async () => {
    try { const r = await api(`/messages/${kind}/${id}`); setD(r); if (unread > 0) { await api(`/messages/${kind}/${id}/read`, { method: 'POST' }); onRead?.(); refreshUnread(); } } catch (e) { setErr(e.message); }
  };
  useEffect(() => { if (open) load(); }, [open, ver, unread]); // eslint-disable-line
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [d, open]);
  async function send(e) {
    e.preventDefault(); if (!text.trim() || busy) return; setBusy(true); setErr('');
    try { await api(`/messages/${kind}/${id}`, { method: 'POST', body: { body: text } }); setText(''); const r = await api(`/messages/${kind}/${id}`); setD(r); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<div className="mt-3 w-full basis-full">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-sm hover:border-teal">
      <MessageSquare size={15} className="text-teal" />{open ? 'Hide messages' : `Message ${to}`}
      {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-bold text-white" aria-label={`${unread} unread`}>{unread}</span>}</button>
    {open && <div className="mt-3 rounded-2xl border border-line bg-foam/60 p-3">
      <div ref={box} className="grid max-h-64 gap-2 overflow-y-auto" aria-live="polite">
        {!d ? <p className="text-sm text-ocean/60">{err || 'Loading…'}</p> : d.messages.length === 0 ? <p className="text-sm text-ocean/60">No messages yet. Write the first one below.</p>
          : d.messages.map(m => <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'justify-self-end bg-ocean text-foam' : 'justify-self-start bg-white'}`}><p className="whitespace-pre-wrap break-words">{m.body}</p><p className={`mt-1 text-[11px] ${m.mine ? 'text-foam/70' : 'text-ocean/50'}`}>{m.mine ? 'You' : d.with} · {when(m.created_at)}</p></div>)}
      </div>
      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs text-ocean/60">Message to {d?.with || to}<textarea rows={2} maxLength={1000} value={text} onChange={e => setText(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ocean focus:border-teal" placeholder="Write your message" /></label>
        <button disabled={busy || !text.trim()} className={`${btn} inline-flex items-center gap-2 disabled:opacity-50`}><Send size={15} />Send</button></form>
      {err && d && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-2 text-sm text-red-800">{err}</p>}
      <p className="mt-2 text-[11px] text-ocean/50">Messages are kept with this booking. Please do not share card numbers or passwords.</p>
    </div>}
  </div>);
}
