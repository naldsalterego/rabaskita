import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const pin = (cls) => L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26] });
export const pinIcon = pin(''), startIcon = pin('pin-start');
export const slug = (name) => name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
