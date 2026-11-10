import { Routes, Route } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import Credits from './pages/Credits.jsx';
import Join from './pages/Join.jsx';
import Scan from './pages/Scan.jsx';
import Nav from './components/Nav.jsx';
import Home from './pages/Home.jsx';
import Auth from './pages/Auth.jsx';
import Explore from './pages/Explore.jsx';
import Checkin from './pages/Checkin.jsx';
import Rewards from './pages/Rewards.jsx';
import Stays, { StayDetail } from './pages/Stays.jsx';
import Transport, { VehicleDetail } from './pages/Transport.jsx';
import Bookings from './pages/Bookings.jsx';
import Planner from './pages/Planner.jsx';
import Trip from './pages/Trip.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Listings, { RestaurantDetail, DestinationDetail, BusinessDetail } from './pages/Listings.jsx';
export default function App() {
  return (<div className="flex min-h-screen min-h-[100dvh] flex-col"><Nav /><div className="flex-1"><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Auth mode="login" />} />
    <Route path="/register" element={<Auth mode="register" />} />
    <Route path="/explore" element={<Explore />} />
    <Route path="/checkin/:token" element={<Checkin />} />
    <Route path="/rewards" element={<Rewards />} />
    <Route path="/accommodations" element={<Stays />} />
    <Route path="/accommodations/:id" element={<StayDetail />} />
    <Route path="/transportation" element={<Transport />} />
    <Route path="/transportation/:id" element={<VehicleDetail />} />
    <Route path="/bookings" element={<Bookings />} />
    <Route path="/itinerary" element={<Planner />} />
    <Route path="/trip/:token" element={<Trip />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/restaurants" element={<Listings kind="restaurants" />} />
    <Route path="/restaurants/:id" element={<RestaurantDetail />} />
    <Route path="/businesses" element={<Listings kind="businesses" />} />
    <Route path="/businesses/:id" element={<BusinessDetail />} />
    <Route path="/explore/:id" element={<DestinationDetail />} />
    <Route path="/credits" element={<Credits />} />
    <Route path="/join" element={<Join />} />
    <Route path="/scan" element={<Scan />} />
    <Route path="*" element={<p className="p-10">This section is coming in a later phase.</p>} />
  </Routes></div><Footer /></div>);
}
