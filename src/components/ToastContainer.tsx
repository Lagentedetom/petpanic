import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
};

const bgColors = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
};

export default function ToastContainer() {
  const { toasts } = useApp();

  return (
    <div className="fixed top-4 left-4 right-4 z-[70] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`max-w-md w-full ${bgColors[toast.type]} border rounded-2xl p-4 flex items-center gap-3 shadow-lg pointer-events-auto`}
          >
            {icons[toast.type]}
            <p className="text-sm font-medium text-stone-800">{toast.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
