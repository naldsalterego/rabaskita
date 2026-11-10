import { Link } from 'react-router-dom';
import { Photo } from './Photo.jsx';
import { useBranding, DEFAULT_LOGO, DEFAULT_PARTNER } from '../lib/branding.js';
const CHIP = { navy: 'bg-ocean px-2 py-1', white: 'border border-line bg-white px-2 py-1', none: '' };
// Logo + site name, with the developer badge beside it. Used by the header and the admin preview.
export default function Brand() {
  const b = useBranding();
  return (<div className="flex shrink-0 items-center gap-3">
    <Link to="/" aria-label={`${b.siteName} home`} className="flex items-center gap-2 font-display text-2xl font-bold"><Photo src={b.logo || DEFAULT_LOGO} alt="" className="h-12 w-12 object-contain" /><span className="hidden whitespace-nowrap text-ocean sm:inline lg:hidden xl:inline">{b.siteName}</span></Link>
    {b.showPartner && <><span aria-hidden className="h-9 w-px bg-line" /><Link to="/credits" title="Developed by" aria-label="The developers" className={`flex items-center rounded-xl ${CHIP[b.partnerBackdrop] ?? CHIP.navy}`}><Photo src={b.partnerLogo || DEFAULT_PARTNER} alt="Developer logo" className="h-9 w-auto" /></Link></>}
  </div>);
}
