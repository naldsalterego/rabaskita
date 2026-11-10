import { useState } from 'react';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, XCircle, FileText, Trash2, UploadCloud, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { photoUrl, saveDocument } from '../lib/photos.js';
import { useLoad, btn, inp } from './ui.jsx';
const STATE = { verified: ['Verified', CheckCircle2, 'text-teal'], review: ['Waiting for review', Clock, 'text-amber-600'], expired: ['Expired', AlertTriangle, 'text-red-700'], missing: ['Missing', XCircle, 'text-ocean/35'] };
const OVERALL = { complete: ['All required papers are verified by the tourism office.', 'border-teal/30 bg-teal/10 text-teal', ShieldCheck], review: ['Papers were submitted and are waiting for the tourism office to verify them.', 'border-amber-200 bg-amber-50 text-amber-900', Clock], incomplete: ['Some required papers are missing or expired.', 'border-line bg-slate-100 text-ocean/80', AlertTriangle] };

export const PaperChip = () => <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal"><ShieldCheck size={12} />Papers complete</span>;
export function PaperLine({ p }) { if (!p) return null; const tone = { complete: 'text-teal', review: 'text-amber-700', incomplete: 'text-ocean/60' }[p.status]; return <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${tone}`}><ShieldCheck size={13} />Papers: {p.have} of {p.need} verified{p.status === 'complete' ? ' · complete' : ''}</p>; }
export function ViewDoc({ file }) {
  const open = async () => { const w = window.open('', '_blank'); const u = await photoUrl(file).catch(() => null); if (u && w) w.location.href = u; else w?.close(); };
  return <button type="button" onClick={open} className="inline-flex items-center gap-1 underline"><FileText size={14} />View</button>;
}
const when = (d) => (d ? new Date(d).toLocaleDateString() : '');

// What tourists see on a business page.
export function PapersPublic({ papers }) {
  if (!papers) return null; const [msg, cls, Icon] = OVERALL[papers.status];
  return (<div className="grid gap-3"><p className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-medium ${cls}`}><Icon size={18} className="mt-0.5 shrink-0" />{msg}</p>
    <ul className="grid gap-2">{papers.required.map(r => { const [lab, I, tone] = STATE[r.state]; const d = r.docs.find(x => x.state === r.state) || r.docs[0]; return (<li key={r.type} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm">
      <span className="flex items-center gap-2"><I size={18} className={tone} /><span><b>{r.label}</b>{d?.number && <span className="text-ocean/60"> · No. {d.number}</span>}{d?.expires && <span className="text-ocean/60"> · valid until {when(d.expires)}</span>}</span></span>
      <span className="flex items-center gap-3"><span className={`text-xs font-semibold ${tone}`}>{lab}</span>{d?.file && <ViewDoc file={d.file} />}</span></li>); })}</ul>
    {papers.other.length > 0 && <ul className="grid gap-1 text-sm text-ocean/75">{papers.other.map(d => <li key={d.id} className="flex flex-wrap items-center gap-2"><FileText size={14} />{d.label}{d.expires && ` · valid until ${when(d.expires)}`} {d.file && <ViewDoc file={d.file} />}</li>)}</ul>}
    <p className="text-xs text-ocean/55">Papers are checked by the tourism office. This is not a guarantee, so please do your own checks too.</p></div>);
}

// Upload, review and manage papers. `base` is the API path; `admin` adds verify / visibility / delete-any.
export function DocsPanel({ base, admin = false, onChange }) {
  const [d, reload, err] = useLoad(() => api(base), [base]);
  const blank = { type: '', number: '', expires: '', pub: true, file: '', fileName: '' };
  const [f, setF] = useState(blank), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const done = async () => { await reload(); onChange?.(); };
  async function pick(e) { const file = e.target.files[0]; e.target.value = ''; if (!file) return; setBusy(true); setMsg(''); try { const ref = await saveDocument(file); setF(x => ({ ...x, file: ref, fileName: file.name })); } catch (x) { setMsg(x.message); } setBusy(false); }
  async function add(e) { e.preventDefault(); setMsg(''); try { await api(base, { method: 'POST', body: { type: f.type, number: f.number, expires: f.expires, public: f.pub, file: f.file, fileName: f.fileName } }); setF(blank); await done(); setMsg(admin ? 'Document added and marked verified.' : 'Document uploaded. The tourism office will review it.'); } catch (x) { setMsg(x.message); } }
  const patch = async (id, body) => { try { await api(`${base}/${id}`, { method: 'PATCH', body }); await done(); } catch (x) { setMsg(x.message); } };
  const remove = async (x) => { if (confirm(`Remove "${x.fileName || x.label}"?`)) { try { await api(`${base}/${x.id}`, { method: 'DELETE' }); await done(); } catch (e) { setMsg(e.message); } } };
  if (err) return <p role="alert" className="text-sm text-red-700">{err}</p>; if (!d) return <p className="text-sm">Loading…</p>;
  const [text, cls, Icon] = OVERALL[d.status];
  const Item = ({ x }) => (<li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foam px-3 py-2 text-xs">
    <span>{x.fileName || 'document'}{x.number && ` · No. ${x.number}`}{x.expires && ` · valid until ${when(x.expires)}`} · {x.verified ? `verified ${when(x.verifiedAt)}` : 'not verified'}{x.state === 'expired' && ' · EXPIRED'}<span className="text-ocean/50"> · added {when(x.uploadedAt)} by {x.by}</span></span>
    <span className="flex items-center gap-3">{x.hasFile && <ViewDoc file={x.file} />}{admin && <><button type="button" className="underline" onClick={() => patch(x.id, { verified: !x.verified })}>{x.verified ? 'Unverify' : 'Verify'}</button><button type="button" title={x.public ? 'Tourists can open this file' : 'Hidden from tourists'} className="inline-flex items-center gap-1 underline" onClick={() => patch(x.id, { public: !x.public })}>{x.public ? <Eye size={13} /> : <EyeOff size={13} />}{x.public ? 'Public' : 'Hidden'}</button></>}
      {(admin || !x.verified) && <button type="button" aria-label="Remove document" className="text-red-700" onClick={() => remove(x)}><Trash2 size={14} /></button>}</span></li>);
  return (<div className="grid gap-4"><p className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-medium ${cls}`}><Icon size={18} className="mt-0.5 shrink-0" />{text}</p>
    <ul className="grid gap-2">{d.required.map(r => { const [lab, I, tone] = STATE[r.state]; return (<li key={r.type} className="rounded-2xl border border-line bg-white p-3"><div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><I size={18} className={tone} /><b>{r.label}</b></span><span className={`text-xs font-semibold ${tone}`}>{lab}</span></div>{r.docs.length > 0 && <ul className="mt-2 grid gap-1">{r.docs.map(x => <Item key={x.id} x={x} />)}</ul>}</li>); })}</ul>
    {d.other.length > 0 && <div><p className="mb-1 text-sm font-medium">Other documents</p><ul className="grid gap-1">{d.other.map(x => <Item key={x.id} x={x} />)}</ul></div>}
    <form onSubmit={add} className="grid gap-3 rounded-2xl border border-dashed border-teal p-4 sm:grid-cols-2"><p className="font-display text-lg sm:col-span-2">Add a document</p>
      <label className="grid gap-1 text-xs font-medium text-ocean/70 sm:col-span-2">Document type *<select required className={`${inp} w-full`} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="">Choose…</option>{d.types.map(t => <option key={t.id} value={t.id}>{t.label}{t.required ? ' (required)' : ''}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-ocean/70">Document / permit number<input className={`${inp} w-full`} value={f.number} onChange={e => setF({ ...f, number: e.target.value })} /></label>
      <label className="grid gap-1 text-xs font-medium text-ocean/70">Valid until<input type="date" className={`${inp} w-full`} value={f.expires} onChange={e => setF({ ...f, expires: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={f.pub} onChange={e => setF({ ...f, pub: e.target.checked })} />Let tourists open this file (the checklist is always shown). Hide the file if it contains private details.</label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-teal bg-white px-4 py-2 text-sm font-medium text-teal"><UploadCloud size={16} />{f.file ? 'Replace file' : 'Choose file (PDF or photo)'}<input type="file" accept="application/pdf,image/*" className="sr-only" onChange={pick} /></label>{busy && <span className="text-sm">Uploading…</span>}{f.fileName && !busy && <span className="text-sm text-ocean/70">{f.fileName}</span>}</div>
      <div className="sm:col-span-2"><button disabled={!f.file || !f.type || busy} className={`${btn} disabled:opacity-40`}>Add document</button></div></form>
    {msg && <p role="status" className="rounded-xl bg-teal/10 p-3 text-sm">{msg}</p>}</div>);
}
