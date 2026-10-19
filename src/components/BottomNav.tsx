import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Dog, MapPin, Users, Bell } from 'lucide-react';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';

export default function BottomNav() {
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const { nearbyAlerts } = useApp();
  const path = location.pathname;

  const items = [
    { icon: Home, path: '/', label: t('nav.home') },
    { icon: Dog, path: '/pets', label: t('nav.pets') },
    { icon: MapPin, path: '/zones', label: t('nav.zones') },
    { icon: Users, path: '/friends', label: t('nav.friends') },
  ];

  const tab = 'flex flex-col items-center gap-1 min-w-14 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-stone-200 px-3 flex justify-around items-center z-40" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', paddingTop: '0.5rem' }}>
      {items.map(item => (
        <button
          key={item.path}
          aria-current={path === item.path ? 'page' : undefined}
          onClick={() => navigate(item.path)}
          className={cn(tab, path === item.path ? 'text-orange-600 bg-orange-50' : 'text-stone-500')}
        >
          <item.icon className="w-6 h-6" aria-hidden="true" />
          {item.label}
        </button>
      ))}
      <button
        aria-label={nearbyAlerts.length > 0 ? t('nav.alertsNearby', { count: nearbyAlerts.length }) : t('nav.alertsNone')}
        className={cn(tab, 'relative text-stone-500')}
        onClick={() => {
          if (nearbyAlerts.length > 0) navigate(`/alerts/${nearbyAlerts[0].id}`);
        }}
      >
        <Bell className="w-6 h-6" aria-hidden="true" />
        {t('nav.alerts')}
        {nearbyAlerts.length > 0 && (
          <span aria-hidden="true" className="absolute top-1 right-3 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
        )}
      </button>
    </nav>
  );
}
