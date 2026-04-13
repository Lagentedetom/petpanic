import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Dog, Cat, Plus, Bell, AlertCircle, MapPin, ChevronLeft, Edit2, CheckCircle2, X, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { calculateDistance, formatDistance } from '../utils';
import type { Pet } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { pets, nearbyAlerts, activeAlerts, location, triggerPanic, resolveAlert } = useApp();
  const [confirmPanicPet, setConfirmPanicPet] = useState<Pet | null>(null);
  const [qrPet, setQrPet] = useState<Pet | null>(null);

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
      {nearbyAlerts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-red-600"><Bell className="w-5 h-5 animate-pulse" /><h2 className="text-lg font-bold uppercase tracking-wider">Alertas Cercanas (2km)</h2></div>
          <div className="grid gap-4">
            {nearbyAlerts.map(alert => (
              <motion.div key={alert.id} whileHover={{ scale: 1.02 }} onClick={() => navigate(`/alerts/${alert.id}`)}
                className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 flex items-center gap-4 cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex-shrink-0 border border-red-200">
                  {alert.pet_photo ? <img src={alert.pet_photo} alt={alert.pet_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center bg-stone-100"><Dog className="w-8 h-8 text-stone-300" /></div>}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 text-lg">¡{alert.pet_name} se ha perdido!</h3>
                  <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    {location && formatDistance(calculateDistance(location.lat, location.lng, alert.lat, alert.lng))} de ti
                  </div>
                </div>
                <ChevronLeft className="w-6 h-6 text-red-400 rotate-180" />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Mis Mascotas</h2>
          <button onClick={() => navigate('/pets/register')} aria-label="Registrar mascota" className="bg-stone-900 text-white p-3 rounded-full hover:bg-stone-800 transition-colors"><Plus className="w-6 h-6" /></button>
        </div>

        {pets.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
            <p className="text-stone-400 mb-6">Aún no has registrado ninguna mascota.</p>
            <button onClick={() => navigate('/pets/register')} className="text-orange-600 font-bold flex items-center gap-2 mx-auto"><Plus className="w-5 h-5" /> Registrar ahora</button>
          </div>
        ) : (
          <div className="grid gap-6">
            {pets.map(pet => (
              <div key={pet.id} className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-6 flex items-start gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-100">
                    {pet.photo_url ? <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center">{pet.species === 'perro' ? <Dog className="w-12 h-12 text-stone-300" /> : <Cat className="w-12 h-12 text-stone-300" />}</div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{pet.name}</h3>
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-xs font-bold rounded-full uppercase tracking-wider">{pet.species}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setQrPet(pet)} aria-label="Ver código QR" className="p-3 text-stone-400 hover:text-orange-600 transition-colors"><QrCode className="w-5 h-5" /></button>
                        <button onClick={() => navigate(`/pets/edit/${pet.id}`)} aria-label="Editar mascota" className="p-3 text-stone-400 hover:text-orange-600 transition-colors"><Edit2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <p className="text-stone-500 text-sm mb-4">{pet.breed} • {pet.color}</p>
                    {pet.is_lost ? (
                      <button onClick={() => { const a = activeAlerts.find(a => a.pet_id === pet.id); if (a) resolveAlert(a); }}
                        className="w-full bg-green-100 text-green-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-200 transition-colors">
                        <CheckCircle2 className="w-5 h-5" /> ¡Lo encontré!
                      </button>
                    ) : (
                      <button onClick={() => setConfirmPanicPet(pet)}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                        <AlertCircle className="w-5 h-5" /> BOTÓN DEL PÁNICO
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <AnimatePresence>
        {confirmPanicPet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
            onClick={() => setConfirmPanicPet(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold">¿{confirmPanicPet.name} se ha perdido?</h3>
              <p className="text-stone-500 text-sm">Se enviará una alerta a todos los usuarios cercanos. Esta acción no se puede deshacer fácilmente.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPanicPet(null)}
                  className="flex-1 py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => { triggerPanic(confirmPanicPet); setConfirmPanicPet(null); }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors">
                  Sí, activar alerta
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {qrPet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
            onClick={() => setQrPet(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold">QR de {qrPet.name}</h3>
              <p className="text-stone-500 text-xs">Escanea este código para ver el perfil público de tu mascota. Imprímelo y ponlo en su collar.</p>
              <div className="flex justify-center py-4">
                <QRCodeSVG
                  value={`${window.location.origin}/pet/${qrPet.id}`}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-[10px] text-stone-400 break-all">{window.location.origin}/pet/{qrPet.id}</p>
              <button onClick={() => setQrPet(null)}
                className="w-full py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
