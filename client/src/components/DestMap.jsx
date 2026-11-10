import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { pinIcon } from '../lib/leaflet.js';
export default function DestMap({ items, className = 'h-96', to = (d) => `/explore/${d.id}` }) {
  return (<MapContainer center={[13.72, 124.3]} zoom={10} scrollWheelZoom={false} className={`${className} w-full rounded-2xl z-0`}>
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {items.filter(d => d.lat != null && d.lng != null).map(d => <Marker key={d.id} icon={pinIcon} position={[Number(d.lat), Number(d.lng)]}><Popup><b>{d.name}</b><br />{d.municipality}<br /><Link to={to(d)} className="underline">View details</Link></Popup></Marker>)}
  </MapContainer>);
}
