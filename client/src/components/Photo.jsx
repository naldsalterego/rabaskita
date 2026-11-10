import { useEffect, useState } from 'react';
import { photoUrl } from '../lib/photos.js';
export function usePhotoUrl(ref) {
  const [url, setUrl] = useState(ref && !ref.startsWith('idb:') ? ref : null);
  useEffect(() => { let off = false; if (!ref) { setUrl(null); return; } photoUrl(ref).then(u => { if (!off) setUrl(u); }).catch(() => {}); return () => { off = true; }; }, [ref]);
  return url;
}
export function Photo({ src, alt = '', className = '' }) { const url = usePhotoUrl(src); return url ? <img src={url} alt={alt} className={className} loading="lazy" draggable={false} /> : null; }
