import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Dog, Cat, Plus, Bell, AlertCircle, MapPin, ChevronLeft, Edit2, CheckCircle2, X, QrCode, Clock, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { calculateDistance, formatDistance } from '../utils';
import type { Pet } from '../types';

// El QR se imprime y va en el collar: tiene que apuntar a la web pública,
// también cuando se genera desde la app nativa (allí el origin es localhost).
const PUBLIC_APP_URL = 'https://app.petpanic.es';

export default function DashboardPage() {
  const { t, i18n } = useTranslation('pets');
  const navigate = useNavigate();
  const { pets, nearbyAlerts, activeAlerts, resolvedAlerts, location, triggerPanic, resolveAlert } = useApp();
  const [confirmPanicPet, setConfirmPanicPet] = useState<Pet | null>(null);
  const [qrPet, setQrPet] = useState<Pet | null>(null);

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
      {nearbyAlerts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-red-600"><Bell className="w-5 h-5 animate-pulse" /><h2 className="text-lg font-bold uppercase tracking-wider">{t('dashboard.nearbyTitle')}</h2></div>
          <div className="grid gap-4">
            {nearbyAlerts.map(alert => (
              <motion.div key={alert.id} whileHover={{ scale: 1.02 }} onClick={() => navigate(`/alerts/${alert.id}`)}
                className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 flex items-center gap-4 cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex-shrink-0 border border-red-200">
                  {alert.pet_photo ? <img src={alert.pet_photo} alt={alert.pet_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-stone-100"><Dog className="w-8 h-8 text-stone-300" /></div>}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 text-lg">{t('dashboard.lostTitle', { name: alert.pet_name })}</h3>
                  <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    {location && t('dashboard.distanceFromYou', { distance: formatDistance(calculateDistance(location.lat, location.lng, alert.lat, alert.lng)) })}
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
          <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.myPets')}</h2>
          <button onClick={() => navigate('/pets/register')} aria-label={t('dashboard.registerPet')} className="bg-stone-900 text-white p-3 rounded-full hover:bg-stone-800 transition-colors"><Plus className="w-6 h-6" /></button>
        </div>

        {pets.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
            <p className="text-stone-400 mb-6">{t('dashboard.empty')}</p>
            <button onClick={() => navigate('/pets/register')} className="text-orange-600 font-bold flex items-center gap-2 mx-auto"><Plus className="w-5 h-5" /> {t('dashboard.registerNow')}</button>
          </div>
        ) : (
          <div className="grid gap-6">
            {pets.map(pet => (
              <div key={pet.id} className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-6 flex items-start gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-100">
                    {pet.photo_url ? <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{pet.species === 'perro' ? <Dog className="w-12 h-12 text-stone-300" /> : <Cat className="w-12 h-12 text-stone-300" />}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-xl font-bold truncate">{pet.name}</h3>
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-xs font-bold rounded-full uppercase tracking-wider flex-shrink-0">{t(`species.${pet.species}`, { defaultValue: pet.species })}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setQrPet(pet)} aria-label={t('dashboard.showQr')} className="p-3 text-stone-400 hover:text-orange-600 transition-colors"><QrCode className="w-5 h-5" /></button>
                        <button onClick={() => navigate(`/pets/edit/${pet.id}`)} aria-label={t('dashboard.editPet')} className="p-3 text-stone-400 hover:text-orange-600 transition-colors"><Edit2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <p className="text-stone-500 text-sm mb-4">{pet.breed} • {pet.color}</p>
                    {pet.is_lost ? (
                      <button onClick={() => { const a = activeAlerts.find(a => a.pet_id === pet.id); if (a) resolveAlert(a); }}
                        className="w-full bg-green-100 text-green-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-200 transition-colors">
                        <CheckCircle2 className="w-5 h-5" /> {t('dashboard.found')}
                      </button>
                    ) : (
                      <button onClick={() => setConfirmPanicPet(pet)}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                        <AlertCircle className="w-5 h-5" /> {t('dashboard.panicButton')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resolvedAlerts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-stone-400" />
            <h2 className="text-lg font-bold tracking-tight">{t('history.title')}</h2>
          </div>
          <div className="grid gap-3">
            {resolvedAlerts.map(alert => {
              const createdAt = new Date(alert.created_at);
              const resolvedAt = alert.resolved_at ? new Date(alert.resolved_at) : null;
              const durationMin = resolvedAt ? Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60000) : null;
              const durationText = durationMin !== null
                ? durationMin < 60 ? t('history.minutes', { count: durationMin }) : t('history.hoursMinutes', { hours: Math.floor(durationMin / 60), minutes: durationMin % 60 })
                : '';
              return (
                <div key={alert.id} className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white overflow-hidden flex-shrink-0 border border-green-200">
                    {alert.pet_photo
                      ? <img src={alert.pet_photo} alt={alert.pet_name} className="w-full h-full object-cover" />
                      : <Dog className="w-full h-full p-2.5 text-green-300" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-green-900">{t('history.found', { name: alert.pet_name })}</p>
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Clock className="w-3 h-3" />
                      <span>{t('history.after', { duration: durationText })}</span>
                      <span className="text-green-400">·</span>
                      <span>{createdAt.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {confirmPanicPet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6"
            onClick={() => setConfirmPanicPet(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="panic-confirm-title"
              aria-describedby="panic-confirm-desc"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle aria-hidden="true" className="w-8 h-8 text-red-600" />
              </div>
              <h3 id="panic-confirm-title" className="text-xl font-bold">{t('panicConfirm.title', { name: confirmPanicPet.name })}</h3>
              <p id="panic-confirm-desc" className="text-stone-500 text-sm">{t('panicConfirm.description')}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPanicPet(null)}
                  className="flex-1 py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                  {t('common:actions.cancel')}
                </button>
                <button onClick={() => { triggerPanic(confirmPanicPet); setConfirmPanicPet(null); }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors">
                  {t('panicConfirm.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {qrPet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6"
            onClick={() => setQrPet(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="qr-pet-title"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 id="qr-pet-title" className="text-xl font-bold">{t('qr.title', { name: qrPet.name })}</h3>
              <p className="text-stone-500 text-xs">{t('qr.description')}</p>
              <div className="flex justify-center py-4">
                <QRCodeSVG
                  value={`${PUBLIC_APP_URL}/pet/${qrPet.id}`}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-[10px] text-stone-400 break-all">{PUBLIC_APP_URL}/pet/{qrPet.id}</p>
              <button onClick={() => setQrPet(null)}
                className="w-full py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                {t('common:actions.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
