import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, User as UserIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ZonePresence } from '../types';

export default function ZoneDetailsPage() {
  const navigate = useNavigate();
  const { zoneId } = useParams();
  const { user, walkingZones, friendships } = useApp();

  const selectedZone = walkingZones.find(z => z.id === zoneId);
  const [zonePresence, setZonePresence] = useState<ZonePresence[]>([]);

  useEffect(() => {
    if (!user || !zoneId) return;

    const fetchPresence = async () => {
      const { data } = await supabase.from('zone_presence').select('*')
        .eq('zone_id', zoneId).order('updated_at', { ascending: false });
      setZonePresence((data ?? []) as ZonePresence[]);
    };
    fetchPresence();

    const channel = supabase
      .channel(`zone-presence-${zoneId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_presence', filter: `zone_id=eq.${zoneId}` },
        () => fetchPresence()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, zoneId]);

  if (!selectedZone) {
    return (
      <div className="text-center py-20 text-stone-400">
        <p>Zona no encontrada.</p>
        <button onClick={() => navigate('/zones')} className="text-orange-600 font-bold mt-4">Volver</button>
      </div>
    );
  }

  const isFriendOf = (userId: string) =>
    friendships.some(f => f.status === 'accepted' && (f.requester_id === userId || f.addressee_id === userId));

  return (
    <motion.div key="zone-details" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/zones')} className="p-2 bg-white rounded-full shadow-sm border border-stone-200"><ChevronLeft className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold">{selectedZone.name}</h2>
      </div>

      <div className="bg-stone-900 text-white p-8 rounded-3xl space-y-2">
        <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Estado Actual</p>
        <h3 className="text-3xl font-black">{zonePresence.length} PERROS PASEANDO</h3>
        <p className="text-stone-400 text-sm">
          {selectedZone.is_member ? "Como miembro, puedes ver quién está presente." : "Únete a la zona para ver los nombres de los perros y sus dueños."}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Presentes ahora</h4>
        {zonePresence.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center italic text-stone-400">No hay nadie en la zona en este momento.</div>
        ) : (
          <div className="grid gap-4">
            {zonePresence.map(presence => {
              const isSelf = presence.user_id === user?.id;
              if (!isSelf && !isFriendOf(presence.user_id)) return null;
              return (
                <div key={presence.user_id} className="bg-white p-5 rounded-3xl border border-stone-200 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0">
                    {presence.user_photo ? (
                      <img src={presence.user_photo} alt={presence.user_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><UserIcon className="w-6 h-6 text-stone-300" /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-bold">{isSelf ? "Tú" : presence.user_name}</h5>
                    <p className="text-xs text-stone-400">Con: {presence.pet_names.join(', ') || 'Sin mascota'}</p>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                </div>
              );
            })}
            {zonePresence.filter(p => p.user_id !== user?.id && !isFriendOf(p.user_id)).length > 0 && (
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                <p className="text-xs text-stone-400 font-medium">
                  Hay {zonePresence.filter(p => p.user_id !== user?.id && !isFriendOf(p.user_id)).reduce((acc, p) => acc + p.pet_names.length, 0)} perros más paseando (privado)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
