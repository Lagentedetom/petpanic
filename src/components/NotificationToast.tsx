import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Dog, Bell, ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function NotificationToast() {
  const { notification, setNotification } = useApp();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div initial={{ opacity: 0, y: -100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-4 right-4 z-50 pointer-events-none">
          <div className="bg-red-600 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 pointer-events-auto cursor-pointer border-2 border-red-500/50 backdrop-blur-sm"
            onClick={() => { navigate(`/alerts/${notification.id}`); setNotification(null); }}>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {notification.pet_photo ? <img src={notification.pet_photo} alt={notification.pet_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Dog className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Bell className="w-3 h-3 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">¡Emergencia Cercana!</span>
              </div>
              <p className="text-sm font-bold leading-tight">{notification.pet_name} se ha perdido cerca de ti.</p>
            </div>
            <ChevronLeft className="w-5 h-5 rotate-180 opacity-50" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
