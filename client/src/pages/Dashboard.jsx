import { Link } from 'react-router-dom';
import AdminDash from './AdminDash.jsx';
import OwnerDash from './OwnerDash.jsx';
import ProviderDash from './ProviderDash.jsx';
import TouristDash from './TouristDash.jsx';
export default function Dashboard() {
  const u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u) return <p className="p-6">Please <Link className="underline" to="/login">sign in</Link> to open your dashboard.</p>;
  if (u.role === 'admin') return <AdminDash />;
  if (u.role === 'business_owner') return <OwnerDash />;
  if (u.role === 'transport_provider') return <ProviderDash />;
  return <TouristDash />;
}
