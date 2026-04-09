import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import type { Pet } from '../types';

export default function RegisterPetPage() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const { user, pets, registerPet } = useApp();

  const editingPet = petId ? pets.find(p => p.id === petId) : null;

  const [petForm, setPetForm] = useState<Partial<Pet>>({ species: 'perro', is_lost: false, contact_info: '' });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editingPet) {
      setPetForm({
        name: editingPet.name, species: editingPet.species, breed: editingPet.breed,
        color: editingPet.color, traits: editingPet.traits, contact_info: editingPet.contact_info,
        photo_url: editingPet.photo_url, is_lost: editingPet.is_lost,
      });
      setPhotoPreview(editingPet.photo_url || null);
    }
  }, [editingPet]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${petId || crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage.from('pet-photos').upload(filePath, file, { upsert: true, contentType: file.type });

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
      setPetForm(prev => ({ ...prev, photo_url: publicUrl }));
    } else {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petForm.name || !petForm.contact_info) return;
    try {
      await registerPet(petForm, petId || null);
      navigate('/pets');
    } catch (err) {
      console.error("Error registering/updating pet:", err);
    }
  };

  return (
    <motion.div key="register" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/pets')} className="p-2 bg-white rounded-full shadow-sm border border-stone-200"><ChevronLeft className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold">{editingPet ? 'Editar Mascota' : 'Registrar Mascota'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative w-32 h-32 rounded-3xl bg-stone-100 overflow-hidden border-2 border-dashed border-stone-300 flex items-center justify-center">
            {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Camera className="w-10 h-10 text-stone-300" />}
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <span className="text-sm font-medium text-stone-500">
            {uploading ? 'Subiendo...' : photoPreview ? 'Cambiar foto' : 'Subir foto'}
          </span>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Nombre</label>
            <input required type="text" value={petForm.name || ''} onChange={e => setPetForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Ej: Max" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Especie</label>
              <select value={petForm.species} onChange={e => setPetForm(prev => ({ ...prev, species: e.target.value as any }))}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none">
                <option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Raza</label>
              <input type="text" value={petForm.breed || ''} onChange={e => setPetForm(prev => ({ ...prev, breed: e.target.value }))}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none" placeholder="Ej: Labrador" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Color</label>
            <input type="text" value={petForm.color || ''} onChange={e => setPetForm(prev => ({ ...prev, color: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none" placeholder="Ej: Marrón y blanco" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Características / Carácter</label>
            <textarea value={petForm.traits || ''} onChange={e => setPetForm(prev => ({ ...prev, traits: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none min-h-[100px]" placeholder="Ej: Se asusta fácilmente, es muy cariñoso..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-stone-500">Datos de Contacto (Privados)</label>
            <input required type="text" value={petForm.contact_info || ''} onChange={e => setPetForm(prev => ({ ...prev, contact_info: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none" placeholder="Ej: Teléfono 600 000 000" />
            <p className="text-[10px] text-stone-400">Estos datos solo se compartirán con usuarios cercanos si activas el botón del pánico.</p>
          </div>
        </div>

        <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-100">
          {editingPet ? 'Actualizar Mascota' : 'Guardar Mascota'}
        </button>
      </form>
    </motion.div>
  );
}
