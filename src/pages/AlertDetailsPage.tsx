import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Dog, MapPin, MessageSquare, ChevronLeft, Send } from 'lucide-react';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';
import type { Message } from '../types';

export default function AlertDetailsPage() {
  const navigate = useNavigate();
  const { alertId } = useParams();
  const { activeAlerts, user } = useApp();

  const selectedAlert = activeAlerts.find(a => a.id === alertId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!alertId) return;

    const fetchMessages = async () => {
      const { data } = await supabase.from('alert_messages').select('*')
        .eq('alert_id', alertId).order('created_at', { ascending: true });
      setMessages((data ?? []) as Message[]);
    };
    fetchMessages();

    const channel = supabase
      .channel(`alert-messages-${alertId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alert_messages',
        filter: `alert_id=eq.${alertId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [alertId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !alertId || !newMessage.trim()) return;
    await supabase.from('alert_messages').insert({
      alert_id: alertId,
      sender_id: user.id,
      sender_name: user.user_metadata?.display_name || 'Usuario',
      text: newMessage,
    });
    setNewMessage('');
  };

  if (!selectedAlert) {
    return (
      <div className="text-center py-20 text-stone-400">
        <p>Alerta no encontrada o ya resuelta.</p>
        <button onClick={() => navigate('/pets')} className="text-orange-600 font-bold mt-4">Volver</button>
      </div>
    );
  }

  return (
    <motion.div
      key="alert-details"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/pets')} className="p-2 bg-white rounded-full shadow-sm border border-stone-200">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold">Detalles de Alerta</h2>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden border border-stone-100">
            {selectedAlert.pet_photo ? (
              <img src={selectedAlert.pet_photo} alt={selectedAlert.pet_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Dog className="w-10 h-10 text-stone-300" /></div>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-red-600">{selectedAlert.pet_name}</h3>
            <p className="text-stone-500 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Perdido hace {Math.round((Date.now() - new Date(selectedAlert.created_at).getTime()) / 60000)} min
            </p>
          </div>
        </div>

        <div className="h-64 w-full bg-stone-100 relative border-b border-stone-100">
          <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
            title="Ubicación de la mascota"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedAlert.lng - 0.002}%2C${selectedAlert.lat - 0.002}%2C${selectedAlert.lng + 0.002}%2C${selectedAlert.lat + 0.002}&layer=mapnik&marker=${selectedAlert.lat}%2C${selectedAlert.lng}`} />
          <div className="absolute bottom-4 right-4">
            <a href={`https://www.google.com/maps?q=${selectedAlert.lat},${selectedAlert.lng}`} target="_blank" rel="noopener noreferrer"
              className="bg-white/90 backdrop-blur-sm text-stone-900 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-white transition-all hover:scale-105">
              <MapPin className="w-3 h-3 text-red-600" /> ABRIR EN GOOGLE MAPS
            </a>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 border-b border-stone-100 bg-stone-50/50">
          <div><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Raza</h4><p className="text-sm font-medium">{selectedAlert.pet_breed || 'No especificada'}</p></div>
          <div><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Color</h4><p className="text-sm font-medium">{selectedAlert.pet_color || 'No especificado'}</p></div>
          <div className="col-span-2"><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Características</h4><p className="text-sm text-stone-600 italic">"{selectedAlert.pet_traits || 'Sin descripción adicional'}"</p></div>
        </div>

        <div className="p-6 bg-orange-50 border-b border-orange-100">
          <h4 className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">Contacto del Dueño</h4>
          <p className="text-lg font-bold text-stone-900">{selectedAlert.owner_contact}</p>
          <p className="text-xs text-stone-500 mt-1 italic">Por favor, contacta solo si tienes información relevante.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-stone-500 mb-4">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Mensajes de Ayuda</span>
          </div>

          <div className="h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <p className="text-center text-stone-400 py-10 italic">No hay mensajes aún. ¡Ayuda a encontrarlo!</p>
            ) : messages.map(msg => (
              <div key={msg.id}
                className={cn("max-w-[80%] p-4 rounded-2xl",
                  msg.sender_id === user?.id ? "bg-orange-600 text-white ml-auto rounded-tr-none" : "bg-stone-100 text-stone-800 rounded-tl-none")}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">{msg.sender_name}</p>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 pt-4">
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe algo..."
              className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
            <button type="submit" className="bg-orange-600 text-white p-4 rounded-2xl hover:bg-orange-700 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
