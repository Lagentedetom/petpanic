import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Dog, Cat, MapPin, Users, User as UserIcon, AlertCircle, ChevronRight, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Onboarding from '../components/Onboarding';

export default function HomePage() {
  const navigate = useNavigate();
  const { userProfile, pets, nearbyAlerts, walkingZones, friendships, primaryZonePresence, user } = useApp();

  const acceptedFriends = friendships.filter(f => f.status === 'accepted');
  const primaryZone = userProfile?.primary_zone_id
    ? walkingZones.find(z => z.id === userProfile.primary_zone_id)
    : null;

  return (
    <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Bienvenido</p>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            {userProfile?.first_name || userProfile?.display_name.split(' ')[0]}
          </h1>
        </div>
        <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-xl bg-white border border-stone-200 overflow-hidden shadow-sm">
          {userProfile?.photo_url
            ? <img src={userProfile.photo_url} alt={userProfile.display_name} className="w-full h-full object-cover" />
            : <UserIcon className="w-full h-full p-2 text-stone-300" />}
        </button>
      </header>

      {/* Onboarding */}
      <Onboarding />

      {/* Alertas cercanas (prioridad máxima) */}
      {nearbyAlerts.length > 0 && (
        <div className="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-3">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <p className="font-bold text-xs uppercase tracking-widest">Alertas Cercanas</p>
          </div>
          {nearbyAlerts.map(alert => (
            <button
              key={alert.id}
              onClick={() => navigate(`/alerts/${alert.id}`)}
              className="w-full bg-white p-4 rounded-2xl border border-red-100 flex items-center gap-4 shadow-sm text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
                {alert.pet_photo
                  ? <img src={alert.pet_photo} alt={alert.pet_name} className="w-full h-full object-cover" />
                  : <Dog className="w-full h-full p-2.5 text-stone-300" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-red-900">¡{alert.pet_name} se ha perdido!</p>
                <p className="text-red-500 text-xs">Cerca de ti</p>
              </div>
              <ChevronRight className="w-5 h-5 text-red-300" />
            </button>
          ))}
        </div>
      )}

      {/* Mis mascotas */}
      <button onClick={() => navigate('/pets')} className="w-full bg-white p-5 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4 text-left hover:border-stone-300 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Dog className="w-6 h-6 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Mis Mascotas</p>
          {pets.length > 0 ? (
            <p className="font-bold text-stone-900">{pets.map(p => p.name).join(', ')}</p>
          ) : (
            <p className="text-stone-400 text-sm">Registra tu primera mascota</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pets.length > 0 && (
            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-full">{pets.length}</span>
          )}
          <ChevronRight className="w-5 h-5 text-stone-300" />
        </div>
      </button>

      {/* Grid: Zonas + Amigos */}
      <div className="grid grid-cols-2 gap-4">
        {/* Zonas de paseo */}
        <button onClick={() => navigate('/zones')} className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm text-left hover:border-stone-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            {primaryZone ? primaryZone.name : 'Zonas de Paseo'}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-stone-900">
              {primaryZone ? primaryZonePresence.reduce((acc, p) => acc + p.pet_names.length, 0) : walkingZones.length}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {primaryZone ? 'paseando' : 'zonas'}
            </span>
          </div>
        </button>

        {/* Amigos */}
        <button onClick={() => navigate('/friends')} className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm text-left hover:border-stone-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Amigos</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-stone-900">{acceptedFriends.length}</span>
            <span className="text-xs text-stone-400 font-medium">conectados</span>
          </div>
        </button>
      </div>

      {/* Perfil / Configuración */}
      <button onClick={() => navigate('/profile')} className="w-full bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4 text-left hover:border-stone-300 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
          <Settings className="w-5 h-5 text-stone-500" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-stone-600 text-sm">Mi Perfil y Configuración</p>
        </div>
        <ChevronRight className="w-5 h-5 text-stone-300" />
      </button>
    </motion.div>
  );
}
