import SignInPrompt from '../components/SignInPrompt.jsx';
import AdminDash from './AdminDash.jsx';
import OwnerDash from './OwnerDash.jsx';
import ProviderDash from './ProviderDash.jsx';
import TouristDash from './TouristDash.jsx';
export default function Dashboard() {
  const u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u) return <SignInPrompt what="your dashboard" />;
  if (u.role === 'admin') return <AdminDash />;
  if (u.role === 'business_owner') return <OwnerDash />;
  if (u.role === 'transport_provider') return <ProviderDash />;
  return <TouristDash />;
}
