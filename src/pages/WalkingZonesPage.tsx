import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Search, Navigation, MapPin, User as UserIcon, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../hooks/useSubscription';
import MapFlyTo from '../components/MapFlyTo';
import '../lib/leaflet-setup';

export default function WalkingZonesPage() {
  const navigate = useNavigate();
  const { userProfile, walkingZones, currentZoneId, location, joinZone, createWalkingZone, togglePrimaryZone, setLocation, showToast } = useApp();
  const {
    canJoinZone,
    canCreateNewZone,
    reachedZoneLimit,
    hasActiveSocial,
    isTrialing,
    maxZones,
    zonesIOwn,
  } = useSubscription();

  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', radius: 200 });
  const [mapSearch, setMapSearch] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([41.3851, 2.1734]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => { if (location && !mapSearch) setMapCenter([location.lat, location.lng]); }, [location]);

  // Scroll the create-zone form into view once it actually mounts.
  // Replaces a previous setTimeout(100) hack that broke on slow first paints.
  useEffect(() => {
    if (!isCreatingZone) return;
    const el = document.getElementById('create-zone-form');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isCreatingZone]);

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearch.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearch)}`);
      const data = await res.json();
      if (data?.length > 0) setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
    } catch (err) { console.error("Search error:", err); }
    finally { setIsSearching(false); }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) { showToast("Tu navegador no soporta geolocalización.", "error"); return; }
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const nl = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocation(nl); setMapCenter([nl.lat, nl.lng]); setMapSearch(''); setIsSearching(false); },
      () => { showToast("No se pudo obtener tu ubicación.", "error"); setIsSearching(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.name) return;
    await createWalkingZone(zoneForm.name, zoneForm.radius);
    setIsCreatingZone(false);
    setZoneForm({ name: '', radius: 200 });
  };

  const handleOpenCreateForm = () => {
    if (!hasActiveSocial) {
      showToast('Necesitas PetPanic Social para crear zonas de paseo.', 'error');
      navigate('/plan');
      return;
    }
    if (reachedZoneLimit) {
      showToast(
        isTrialing
          ? 'Durante el mes gratis solo puedes crear 1 zona. Activa Social para crear hasta 5.'
          : `Has alcanzado el límite de ${maxZones} zonas.`,
        'error'
      );
      return;
    }
    setIsCreatingZone(true);
  };

  return (
    <motion.div key="walking-zones" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <h2 className="text-3xl font-black tracking-tighter">ZONAS DE PASEO</h2>

      {/* Gating banner: no Social at all */}
      {!hasActiveSocial && (
        <button
          onClick={() => navigate('/plan')}
          className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-4 text-left hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-stone-900">Desbloquea las zonas de paseo</p>
              <p className="text-xs text-stone-500">Con PetPanic Social puedes crear tu zona y unirte a otras</p>
            </div>
          </div>
          <span className="text-xs font-bold text-orange-600 uppercase tracking-widest flex-shrink-0">Activar</span>
        </button>
      )}

      {/* Trial + zone usage indicator */}
      {isTrialing && hasActiveSocial && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-stone-600 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            Mes gratis · usas {zonesIOwn}/{maxZones} zonas propias
          </span>
          <button onClick={() => navigate('/plan')} className="font-bold text-orange-600 uppercase tracking-widest">Mi plan</button>
        </div>
      )}

      <div className="flex gap-2">
        <form onSubmit={handleSearchLocation} className="relative flex-1">
          <input type="text" placeholder="Buscar ciudad o zona (ej: Logroño)" value={mapSearch} onChange={e => setMapSearch(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl px-12 py-4 outline-none shadow-sm focus:ring-2 focus:ring-orange-500/20 transition-all" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <button type="submit" disabled={isSearching} aria-label="Buscar" className="absolute right-3 top-1/2 -translate-y-1/2 bg-stone-900 text-white p-2.5 rounded-xl disabled:opacity-50">
            {isSearching ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Navigation className="w-5 h-5" />}
          </button>
        </form>
        <button type="button" onClick={handleLocateMe} disabled={isSearching} className="bg-orange-100 text-orange-600 p-4 rounded-2xl hover:bg-orange-200 transition-colors disabled:opacity-50 flex-shrink-0" title="Mi ubicación">
          <MapPin className="w-6 h-6" />
        </button>
      </div>

      <div className="h-[350px] rounded-3xl overflow-hidden border border-stone-200 shadow-inner z-10 relative">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          <MapFlyTo center={mapCenter} />
          {walkingZones.map(zone => (
            <React.Fragment key={zone.id}>
              <Marker position={[zone.lat, zone.lng]}>
                <Popup><div className="p-2"><h4 className="font-bold text-sm">{zone.name}</h4><p className="text-xs text-stone-500 mb-2">{zone.member_count ?? 0} miembros</p><button onClick={() => navigate(`/zones/${zone.id}`)} className="w-full bg-orange-600 text-white text-[10px] font-bold py-1.5 rounded-lg">Ver Detalles</button></div></Popup>
              </Marker>
              <Circle center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: currentZoneId === zone.id ? '#ea580c' : '#78716c', fillColor: currentZoneId === zone.id ? '#ea580c' : '#78716c', fillOpacity: 0.2 }} />
            </React.Fragment>
          ))}
          {location && <Marker position={[location.lat, location.lng]} icon={L.divIcon({ className: 'custom-div-icon', html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })} />}
        </MapContainer>
      </div>

      {/* Primary CTA: create zone (only if user can and hasn't opened the form) */}
      {!isCreatingZone && canCreateNewZone && (
        <button
          onClick={handleOpenCreateForm}
          className="w-full flex items-center justify-center gap-3 bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-100 hover:bg-orange-700 active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" />
          Crear zona aquí
        </button>
      )}

      {/* Limit reached CTA (explains why instead of letting them click into nothing) */}
      {!isCreatingZone && hasActiveSocial && reachedZoneLimit && (
        <div className="w-full flex items-center justify-center gap-3 bg-stone-100 text-stone-500 font-medium py-4 rounded-2xl text-sm">
          <Lock className="w-4 h-4" />
          {isTrialing
            ? 'Durante el mes gratis solo puedes crear 1 zona'
            : `Límite alcanzado (${maxZones} zonas)`}
        </div>
      )}

      {isCreatingZone && (
        <div id="create-zone-form" className="bg-white p-6 rounded-3xl border-2 border-orange-400 shadow-lg shadow-orange-100 space-y-4">
          <h3 className="font-bold">Crear Nueva Zona</h3>
          <p className="text-xs text-stone-400">La zona se creará en tu ubicación actual.</p>
          <form onSubmit={handleCreateZone} className="space-y-4">
            <input type="text" placeholder="Nombre de la zona (ej: Parque del Retiro)" value={zoneForm.name} onChange={e => setZoneForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none" />
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Radio (metros): {zoneForm.radius}m</label>
              <input type="range" min="50" max="1000" step="50" value={zoneForm.radius} onChange={e => setZoneForm(prev => ({ ...prev, radius: parseInt(e.target.value) }))} className="w-full accent-orange-600" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-2xl">Crear Zona Aquí</button>
              <button type="button" onClick={() => setIsCreatingZone(false)} className="px-6 py-3 border border-stone-200 rounded-2xl font-bold">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Zonas Disponibles</h3>
        {walkingZones.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center italic text-stone-400">No hay zonas creadas todavía. ¡Sé el primero!</div>
        ) : walkingZones.map(zone => {
          const isActive = currentZoneId === zone.id;
          return (
            <div key={zone.id} className={cn("bg-white p-6 rounded-3xl border transition-all cursor-pointer", isActive ? "border-orange-500 ring-2 ring-orange-100" : "border-stone-200")} onClick={() => navigate(`/zones/${zone.id}`)}>
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="min-w-0 flex-1"><h3 className="text-xl font-bold truncate">{zone.name}</h3><p className="text-stone-400 text-sm">{zone.radius}m de radio</p></div>
                {isActive && <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">¡Estás aquí!</span>}
                <button onClick={(e) => { e.stopPropagation(); togglePrimaryZone(zone.id); }}
                  aria-label="Zona principal"
                  className={cn("p-3 rounded-xl transition-all", userProfile?.primary_zone_id === zone.id ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-400")}>
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-stone-400" /><span className="text-sm font-medium text-stone-600">{zone.member_count ?? 0} miembros</span></div>
                {!zone.is_member ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canJoinZone) {
                        showToast('Necesitas PetPanic Social para unirte a una zona.', 'error');
                        navigate('/plan');
                        return;
                      }
                      joinZone(zone);
                    }}
                    className={cn(
                      'text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5',
                      canJoinZone ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'
                    )}
                  >
                    {!canJoinZone && <Lock className="w-3 h-3" />}
                    Unirse
                  </button>
                ) : <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Miembro</span>}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
