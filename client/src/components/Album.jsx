import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { Photo } from './Photo.jsx';
export default function Album({ photos, name }) {
  const [at, setAt] = useState(null), tx = useRef(0), n = photos.length;
  const go = (d) => setAt(i => (i + d + n) % n);
  useEffect(() => { if (at === null) return; const k = (e) => { if (e.key === 'Escape') setAt(null); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }; addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [at]);
  if (!n) return null;
  return (<>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.slice(0, 9).map((p, i) => <button key={p} type="button" onClick={() => setAt(i)} aria-label={`Open photo ${i + 1} of ${n}`} className={`group relative overflow-hidden rounded-2xl bg-foam ${i === 0 && n > 2 ? 'col-span-2 row-span-2' : 'aspect-square'}`}>
      <Photo src={p} alt={`${name} photo ${i + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      {i === 8 && n > 9 && <span className="absolute inset-0 grid place-items-center bg-ocean/60 font-display text-2xl text-white">+{n - 9}</span>}</button>)}</div>
    {at !== null && <div role="dialog" aria-label={`${name} photos`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setAt(null)} onTouchStart={e => { tx.current = e.touches[0].clientX; }} onTouchEnd={e => { const dx = e.changedTouches[0].clientX - tx.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <button aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-3 text-white" onClick={() => setAt(null)}><X /></button>
      {n > 1 && <><button aria-label="Previous photo" className="absolute left-3 rounded-full bg-white/15 p-3 text-white" onClick={e => { e.stopPropagation(); go(-1); }}><ChevronLeft /></button><button aria-label="Next photo" className="absolute right-3 rounded-full bg-white/15 p-3 text-white" onClick={e => { e.stopPropagation(); go(1); }}><ChevronRight /></button></>}
      <Photo src={photos[at]} alt={`${name} photo ${at + 1}`} className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain" />
      <p className="absolute bottom-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-sm text-white" onClick={e => e.stopPropagation()}><Camera size={14} />{name} · {at + 1} / {n}</p></div>}
  </>);
}

export const albumOf = (o) => [...new Set([o?.cover_photo, ...(o?.photos || [])].filter(Boolean))];
export const CountBadge = ({ n }) => (n > 0 ? <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white"><Camera size={12} />{n}</span> : null);
