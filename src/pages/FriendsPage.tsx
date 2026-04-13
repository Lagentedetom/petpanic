import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, User as UserIcon, UserPlus, UserCheck, UserX, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UserProfile } from '../types';

export default function FriendsPage() {
  const { user, userProfile, friendships, friendProfiles, searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest } = useApp();
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSearchTerm.trim()) return;
    setIsSearchingUsers(true);
    try { setFoundUsers(await searchUsers(userSearchTerm)); } catch (err) { console.error("User search error:", err); }
    finally { setIsSearchingUsers(false); }
  };

  const getFriendId = (f: import('../types').Friendship) => f.requester_id === user?.id ? f.addressee_id : f.requester_id;

  return (
    <motion.div key="friends" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tighter">AMIGOS</h2>
        <div className="text-right">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tu Código</p>
          <p className="text-lg font-black text-orange-600 tracking-tighter">{userProfile?.friend_code}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input type="text" placeholder="Introduce el código de tu amigo" value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded-2xl px-12 py-4 outline-none shadow-sm focus:ring-2 focus:ring-orange-500/20 transition-all uppercase" />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <button type="submit" disabled={isSearchingUsers} className="absolute right-3 top-1/2 -translate-y-1/2 bg-stone-900 text-white p-2 rounded-xl disabled:opacity-50">
          {isSearchingUsers ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </form>

      {foundUsers.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Resultados</h4>
          <div className="grid gap-4">
            {foundUsers.map(u => {
              const friendship = friendships.find(f => f.requester_id === u.id || f.addressee_id === u.id);
              return (
                <div key={u.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden">{u.photo_url ? <img src={u.photo_url} alt={u.display_name} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-2 text-stone-300" />}</div>
                    <div><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-stone-400">{u.email}</p></div>
                  </div>
                  {!friendship ? (
                    <button onClick={() => sendFriendRequest(u)} aria-label="Enviar solicitud" className="bg-orange-600 text-white p-3 rounded-xl"><UserPlus className="w-5 h-5" /></button>
                  ) : <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{friendship.status === 'pending' ? 'Pendiente' : 'Amigos'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {friendships.some(f => f.status === 'pending' && f.requester_id !== user?.id) && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-orange-600 px-2">Solicitudes Pendientes</h4>
          <div className="grid gap-4">
            {friendships.filter(f => f.status === 'pending' && f.requester_id !== user?.id).map(f => {
              const rp = friendProfiles[f.requester_id];
              return (
                <div key={f.id} className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center">{rp?.photo_url ? <img src={rp.photo_url} alt={rp.display_name} className="w-full h-full object-cover" /> : <Clock className="w-5 h-5 text-orange-400" />}</div>
                    <div><p className="font-bold text-sm text-orange-900">{rp?.display_name || 'Nueva solicitud'}</p><p className="text-[10px] text-orange-400">{rp?.email}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptFriendRequest(f)} aria-label="Aceptar solicitud" className="bg-green-600 text-white p-3 rounded-xl"><UserCheck className="w-5 h-5" /></button>
                    <button onClick={() => declineFriendRequest(f)} aria-label="Rechazar solicitud" className="bg-red-600 text-white p-3 rounded-xl"><UserX className="w-5 h-5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Tus Amigos</h4>
        {friendships.filter(f => f.status === 'accepted').length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center italic text-stone-400">Aún no tienes amigos agregados.</div>
        ) : (
          <div className="grid gap-4">
            {friendships.filter(f => f.status === 'accepted').map(f => {
              const fid = getFriendId(f);
              const fp = friendProfiles[fid];
              return (
                <div key={f.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden flex items-center justify-center">{fp?.photo_url ? <img src={fp.photo_url} alt={fp.display_name} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-stone-400" />}</div>
                    <div><p className="font-bold text-sm">{fp?.display_name || 'Usuario Conectado'}</p><p className="text-xs text-stone-400">{fp?.email}</p></div>
                  </div>
                  <button onClick={() => declineFriendRequest(f)} aria-label="Eliminar amigo" className="text-stone-400 hover:text-red-600 hover:bg-red-50 p-3 rounded-xl transition-colors"><UserX className="w-5 h-5" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
