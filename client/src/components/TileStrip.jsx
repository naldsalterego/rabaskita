const C = ['#F2452D', '#F7861B', '#FFC21A', '#4CB944', '#0D8C84', '#18A7E0', '#E8457A', '#25308F'];
function Tile({ i }) {
  const bg = C[i % 8], fg = C[(i + 3) % 8], m = i % 6;
  return (<svg viewBox="0 0 40 40" className="h-full shrink-0" style={{ aspectRatio: '1' }} aria-hidden><rect width="40" height="40" fill={bg} />
    {m === 0 && <circle cx="20" cy="20" r="9" fill={fg} />}{m === 1 && <path d="M20 6 L34 34 H6Z" fill={fg} />}{m === 2 && <path d="M20 5 L35 20 L20 35 L5 20Z" fill={fg} />}
    {m === 3 && <path d="M8 32 C8 14 20 8 32 8 C32 26 20 32 8 32Z" fill={fg} />}{m === 4 && <path d="M0 26 C7 18 13 34 20 26 S33 18 40 26 V40 H0Z" fill={fg} />}
    {m === 5 && <><circle cx="20" cy="20" r="12" fill={fg} /><circle cx="20" cy="20" r="5" fill={bg} /></>}</svg>);
}
// A ribbon of colorful tiles, inspired by the reference artwork's borders.
export default function TileStrip({ className = 'h-8', offset = 0 }) {
  return <div aria-hidden className={`flex overflow-hidden ${className}`}>{Array.from({ length: 60 }, (_, i) => <Tile key={i} i={i + offset} />)}</div>;
}
