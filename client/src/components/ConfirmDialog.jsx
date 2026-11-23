import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { btnGhost } from './ui.jsx';

/** An in-page confirmation window (instead of the browser's own pop-up). The safe choice is focused first, Esc and a click outside
 *  close it, Tab stays inside it, and the page behind does not scroll. */
export default function ConfirmDialog({ title, confirmLabel = 'Confirm', cancelLabel = 'Go back', onConfirm, onClose, busy = false, disabled = false, children }) {
  const box = useRef(null), safe = useRef(null);
  useEffect(() => {
    const before = document.activeElement, overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; safe.current?.focus();
    const key = (e) => {
      if (e.key === 'Escape' && !busy) return onClose();
      if (e.key !== 'Tab') return;
      const f = [...box.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')]; if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [busy]); // eslint-disable-line
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-ocean/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
    <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"><AlertTriangle size={20} /></span><h2 id="cd-title" className="font-display text-xl">{title}</h2></div>
      <div id="cd-body" className="mt-3 grid gap-3 text-sm">{children}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={safe} type="button" onClick={onClose} disabled={busy} className={btnGhost}>{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy || disabled} className="rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50">{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </div>
  </div>);
}
