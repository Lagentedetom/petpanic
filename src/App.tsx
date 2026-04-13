import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import NotificationToast from './components/NotificationToast';
import NotificationPrompt from './components/NotificationPrompt';
import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';

// Lazy load heavy pages (especially WalkingZonesPage which imports Leaflet)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RegisterPetPage = lazy(() => import('./pages/RegisterPetPage'));
const AlertDetailsPage = lazy(() => import('./pages/AlertDetailsPage'));
const WalkingZonesPage = lazy(() => import('./pages/WalkingZonesPage'));
const ZoneDetailsPage = lazy(() => import('./pages/ZoneDetailsPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const PublicPetPage = lazy(() => import('./pages/PublicPetPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useApp();
  const location = useLocation();

  // Public pages (accessible without login)
  if (location.pathname === '/terminos') return <Suspense fallback={<PageLoader />}><TermsPage /></Suspense>;
  if (location.pathname === '/privacidad') return <Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>;
  if (location.pathname.startsWith('/pet/')) return <Suspense fallback={<PageLoader />}><Routes><Route path="/pet/:petId" element={<PublicPetPage />} /></Routes></Suspense>;

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </main>
      <BottomNav />
      <NotificationPrompt />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AppRoutes />
          <ToastContainer />
          <CookieBanner />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
