import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Dog, Cat, Phone, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Pet } from '../types';

export default function PublicPetPage() {
  const { petId } = useParams();
  const [pet, setPet] = useState<Pet | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!petId) return;
    const fetch = async () => {
      const { data } = await supabase.from('pets').select('*').eq('id', petId).single();
      if (data) {
        setPet(data as Pet);
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.owner_id).single();
        if (profile) setOwnerName(profile.display_name);
      }
      setLoading(false);
    };
    fetch();
  }, [petId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm">
          <p className="text-stone-400">Mascota no encontrada.</p>
        </div>
      </div>
    );
  }

  const SpeciesIcon = pet.species === 'gato' ? Cat : Dog;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {pet.photo_url ? (
          <img src={pet.photo_url} alt={pet.name} className="w-full h-64 object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-64 bg-stone-100 flex items-center justify-center">
            <SpeciesIcon className="w-24 h-24 text-stone-300" />
          </div>
        )}

        <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/petpanic-logo.svg" alt="PetPanic" className="w-6 h-6" />
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">PetPanic</span>
            </div>
            <h1 className="text-3xl font-black">{pet.name}</h1>
            <p className="text-stone-500 text-sm mt-1">Registrado por {ownerName}</p>
          </div>

          {pet.is_lost && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900">¡{pet.name} está perdido/a!</p>
                <p className="text-red-600 text-xs">Si lo/la ves, contacta al dueño inmediatamente.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Especie</p>
              <p className="font-medium capitalize">{pet.species}</p>
            </div>
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Raza</p>
              <p className="font-medium">{pet.breed || '-'}</p>
            </div>
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Color</p>
              <p className="font-medium">{pet.color || '-'}</p>
            </div>
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Características</p>
              <p className="font-medium text-xs">{pet.traits || '-'}</p>
            </div>
          </div>

          {pet.is_lost && pet.contact_info && (
            <a href={`tel:${pet.contact_info.replace(/\D/g, '')}`}
              className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-700 transition-colors">
              <Phone className="w-5 h-5" /> Llamar al dueño
            </a>
          )}

          <p className="text-center text-xs text-stone-400">
            Perfil generado con PetPanic - Red de protección animal
          </p>
        </div>
      </div>
    </div>
  );
}
