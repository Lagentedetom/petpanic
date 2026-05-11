import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Dog, MapPin, Users, Bell } from 'lucide-react';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { nearbyAlerts } = useApp();
  const path = location.pathname;

  const items = [
    { icon: Home, path: '/', label: 'Inicio' },
    { icon: Dog, path: '/pets', label: 'Mascotas' },
    { icon: MapPin, path: '/zones', label: 'Zonas' },
    { icon: Users, path: '/friends', label: 'Amigos' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 flex justify-around items-center z-40" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' , paddingTop: '0.75rem' }}>
      {items.map(item => (
        <button
          key={item.path}
          aria-label={item.label}
          aria-current={path === item.path ? 'page' : undefined}
          onClick={() => navigate(item.path)}
          className={cn(
            "p-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
            path === item.path ? "text-orange-600 bg-orange-50" : "text-stone-500"
          )}
        >
          <item.icon className="w-7 h-7" />
        </button>
      ))}
      <button
        aria-label={
          nearbyAlerts.length > 0
            ? `Notificaciones, ${nearbyAlerts.length} ${nearbyAlerts.length === 1 ? 'alerta cercana' : 'alertas cercanas'}`
            : 'Notificaciones, sin alertas'
        }
        className="p-3 text-stone-500 relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        onClick={() => {
          if (nearbyAlerts.length > 0) {
            navigate(`/alerts/${nearbyAlerts[0].id}`);
          }
        }}
      >
        <Bell className="w-7 h-7" />
        {nearbyAlerts.length > 0 && (
          <span aria-hidden="true" className="absolute top-1 right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
        )}
      </button>
    </nav>
  );
}
