import { useEffect, useState } from 'react';
import { useSyncVersion } from '../lib/sync.js';
import { Link, useLocation } from 'react-router-dom';
import TileStrip from './TileStrip.jsx';
import { api } from '../lib/api.js';
import { Photo } from './Photo.jsx';
import { useBranding, DEFAULT_LOGO } from '../lib/branding.js';
export default function Footer() {
  const brand = useBranding(), [c, setC] = useState(null), { pathname } = useLocation();
  const ver = useSyncVersion();
  useEffect(() => { api('/credits').then(setC).catch(() => {}); }, [pathname, ver]);
  return (<footer className="no-print mt-16"><TileStrip className="h-10" />
    <div className="bg-ocean py-8 text-center text-foam"><Photo src={brand.logo || DEFAULT_LOGO} alt="" className="mx-auto mb-2 h-20 w-20 rounded-full bg-white object-contain p-1" /><p className="font-display text-2xl">{brand.siteName}</p><p className="mt-1 text-sm text-foam/70">{brand.tagline}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3"><Link to="/join" className="inline-block rounded-full bg-sun px-5 py-2 text-sm font-semibold text-ocean hover:bg-white">List your business</Link><Link to="/credits" className="inline-block rounded-full border border-white/30 px-5 py-2 text-sm hover:bg-white/10">Developed by <b>{c?.company || 'IslaTek'}</b></Link></div></div></footer>);
}
