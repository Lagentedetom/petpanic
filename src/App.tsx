import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import NotificationToast from './components/NotificationToast';
import NotificationPrompt from './components/NotificationPrompt';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import RegisterPetPage from './pages/RegisterPetPage';
import AlertDetailsPage from './pages/AlertDetailsPage';
import WalkingZonesPage from './pages/WalkingZonesPage';
import ZoneDetailsPage from './pages/ZoneDetailsPage';
import FriendsPage from './pages/FriendsPage';
import ProfilePage from './pages/ProfilePage';

function AppRoutes() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <NotificationToast />
      <Header />
      <main className="max-w-2xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pets" element={<DashboardPage />} />
            <Route path="/pets/register" element={<RegisterPetPage />} />
            <Route path="/pets/edit/:petId" element={<RegisterPetPage />} />
            <Route path="/alerts/:alertId" element={<AlertDetailsPage />} />
            <Route path="/zones" element={<WalkingZonesPage />} />
            <Route path="/zones/:zoneId" element={<ZoneDetailsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>
      <BottomNav />
      <NotificationPrompt />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
