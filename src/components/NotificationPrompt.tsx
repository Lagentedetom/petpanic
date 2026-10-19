import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { isNative } from '../lib/native';
import { registerNativePush, requestNotificationPermission, getNotificationPermissionState } from '../lib/notifications';

export default function NotificationPrompt() {
  const { t } = useTranslation('shell');
  const { user } = useApp();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Native (iOS/Android): skip the custom card and register directly — the OS
    // shows its own permission dialog, and the web Notification API isn't
    // available inside the WebView anyway.
    if (isNative()) {
      void registerNativePush(user.id, (path) => navigate(path));
      return;
    }

    const permission = getNotificationPermissionState();
    const dismissed = sessionStorage.getItem('notif-prompt-dismissed');

    // Show prompt if permission hasn't been decided and user hasn't dismissed this session
    if (permission === 'default' && !dismissed) {
      // Small delay so the app loads first
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);

  const handleEnable = async () => {
    if (!user) return;
    setRequesting(true);
    await requestNotificationPermission(user.id);
    setRequesting(false);
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('notif-prompt-dismissed', 'true');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-24 left-4 right-4 z-50"
        >
          <div className="bg-stone-900 text-white p-5 rounded-3xl shadow-2xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 flex-shrink-0 flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-1">{t('notificationPrompt.title')}</h4>
              <p className="text-stone-400 text-xs leading-relaxed mb-3">
                {t('notificationPrompt.text')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {requesting ? t('notificationPrompt.enabling') : t('notificationPrompt.enable')}
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-stone-500 text-xs font-bold px-4 py-2 rounded-xl hover:text-stone-300 transition-colors"
                >
                  {t('notificationPrompt.later')}
                </button>
              </div>
            </div>
            <button onClick={handleDismiss} aria-label={t('notificationPrompt.close')} className="text-stone-500 hover:text-white p-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
