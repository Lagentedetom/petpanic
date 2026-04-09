import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Edit2, User as UserIcon, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userProfile, updateProfile, logOut } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', display_name: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setProfileForm({ first_name: userProfile?.first_name || '', last_name: userProfile?.last_name || '', display_name: userProfile?.display_name || '' });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        display_name: profileForm.display_name || `${profileForm.first_name} ${profileForm.last_name}`.trim(),
      });
      setIsEditing(false);
    } catch (err) { console.error("Error updating profile:", err); }
    finally { setIsSaving(false); }
  };

  return (
    <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => { if (isEditing) setIsEditing(false); else navigate('/'); }} className="p-2 bg-white rounded-full shadow-sm border border-stone-200"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-2xl font-bold">{isEditing ? 'Editar Perfil' : 'Mi Perfil'}</h2>
        </div>
        {!isEditing && <button onClick={handleEdit} className="p-2 bg-stone-900 text-white rounded-xl shadow-lg shadow-stone-200"><Edit2 className="w-5 h-5" /></button>}
      </div>

      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-bold uppercase tracking-wider text-stone-500">Nombre</label>
                <input required type="text" value={profileForm.first_name} onChange={e => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Tu nombre" /></div>
              <div className="space-y-2"><label className="text-sm font-bold uppercase tracking-wider text-stone-500">Apellidos</label>
                <input required type="text" value={profileForm.last_name} onChange={e => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Tus apellidos" /></div>
              <div className="space-y-2"><label className="text-sm font-bold uppercase tracking-wider text-stone-500">Nombre de Usuario (Público)</label>
                <input type="text" value={profileForm.display_name} onChange={e => setProfileForm(prev => ({ ...prev, display_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Ej: Nico Tomic" />
                <p className="text-[10px] text-stone-400">Este es el nombre que verán otros usuarios.</p></div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl transition-all">CANCELAR</button>
              <button type="submit" disabled={isSaving} className="flex-1 bg-stone-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-stone-100 disabled:opacity-50">{isSaving ? 'GUARDANDO...' : 'GUARDAR'}</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-stone-100 overflow-hidden border-4 border-white shadow-lg">
                {userProfile?.photo_url ? <img src={userProfile.photo_url} alt={userProfile.display_name} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-6 text-stone-300" />}
              </div>
              <div className="text-center"><h3 className="text-xl font-bold">{userProfile?.display_name}</h3><p className="text-stone-400 text-sm">{userProfile?.email}</p></div>
            </div>
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Nombre</p><p className="bg-stone-50 p-3 rounded-xl font-medium text-stone-600">{userProfile?.first_name || '-'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Apellidos</p><p className="bg-stone-50 p-3 rounded-xl font-medium text-stone-600">{userProfile?.last_name || '-'}</p></div>
              </div>
              <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Código de Amigo</p><p className="bg-orange-50 p-3 rounded-xl font-bold text-orange-600 tracking-widest">{userProfile?.friend_code}</p></div>
            </div>
            <button onClick={logOut} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all mt-8"><LogOut className="w-5 h-5" /> CERRAR SESIÓN</button>
          </>
        )}
      </div>
    </motion.div>
  );
}
