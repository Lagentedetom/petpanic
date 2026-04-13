import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookie-consent');
    if (!accepted) setShow(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-0 left-0 right-0 z-[60] p-4"
        >
          <div className="max-w-2xl mx-auto bg-stone-900 text-white p-5 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-xs text-stone-300 flex-1 leading-relaxed">
              Esta app usa almacenamiento local para mantener tu sesión. No usamos cookies de terceros ni seguimiento publicitario.{' '}
              <Link to="/privacidad" className="text-orange-400 hover:underline">Política de privacidad</Link>
            </p>
            <button onClick={handleAccept}
              className="bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-orange-700 transition-colors flex-shrink-0">
              Aceptar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
