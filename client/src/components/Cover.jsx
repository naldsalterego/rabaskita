import { slug } from '../lib/leaflet.js';
import { Photo } from './Photo.jsx';
const PAL = [['#F2452D', '#F7861B'], ['#18A7E0', '#25308F'], ['#4CB944', '#0D8C84'], ['#FFC21A', '#F7861B'], ['#E8457A', '#F2452D'], ['#0D8C84', '#18A7E0']];
const ACC = ['#FFC21A', '#fff', '#F2452D', '#18C2B2', '#E8457A', '#4CB944'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// Shows /img/<slug>.jpg if you add one (client/public/img/), otherwise colorful generated artwork.
export default function Cover({ name, className = 'h-40', photo, children }) {
  const h = hash(name), [a, b] = PAL[h % PAL.length], sun = ACC[(h >> 3) % ACC.length], hill = ACC[(h >> 5) % ACC.length];
  return (<div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      <circle cx={70 + (h % 250)} cy="62" r="34" fill={sun} opacity=".9" />
      <path d={`M0 200 L${50 + h % 60} ${100 - h % 25} L${140 + h % 40} 200Z`} fill={hill} opacity=".35" /><path d={`M${150 + h % 50} 200 L${250 + h % 40} ${90 - h % 20} L400 200Z`} fill="#25308F" opacity=".22" />
      <path d="M0 150 C60 125 120 175 200 150 S340 125 400 150 V200 H0Z" fill="#fff" opacity=".2" /><path d="M0 172 C70 150 130 195 210 172 S340 152 400 175 V200 H0Z" fill="#fff" opacity=".3" />
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${18 + i * 22} 16 l8 8 -8 8 -8 -8z`} fill="#fff" opacity=".55" />)}
    </svg>
    <img src={`/img/${slug(name)}.jpg`} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />
    {photo && <Photo src={photo} alt={name} className="absolute inset-0 h-full w-full object-cover" />}
    {children}
  </div>);
}
