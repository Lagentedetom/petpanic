import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Dog, MapPin, Bell, ChevronRight, X } from 'lucide-react';

const steps = [
  {
    icon: Dog,
    color: 'bg-orange-100 text-orange-600',
    title: 'Registra tu mascota',
    description: 'Añade a tu perro o gato con su foto, raza y datos de contacto. Si algún día se pierde, la comunidad podrá ayudarte a encontrarlo.',
    action: '/pets/register',
    actionLabel: 'Registrar mascota',
  },
  {
    icon: MapPin,
    color: 'bg-emerald-100 text-emerald-600',
    title: 'Únete a una zona de paseo',
    description: 'Encuentra zonas de paseo cerca de ti y conéctate con otros dueños de tu barrio. Podrás ver quién está paseando en tiempo real.',
    action: '/zones',
    actionLabel: 'Ver zonas',
  },
  {
    icon: Bell,
    color: 'bg-sky-100 text-sky-600',
    title: 'Activa las notificaciones',
    description: 'Recibe alertas cuando una mascota se pierda cerca de ti. Las primeras 2 horas son vitales para encontrarla.',
    action: null,
    actionLabel: 'Entendido',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isComplete = localStorage.getItem('onboarding-complete');
  if (isComplete) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleAction = () => {
    if (step.action) {
      navigate(step.action);
    }
    if (isLast) {
      localStorage.setItem('onboarding-complete', 'true');
      setDismissed(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-complete', 'true');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-3xl border-2 border-orange-200 shadow-lg shadow-orange-50 overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Primeros pasos</span>
              <span className="text-[10px] text-stone-400">{currentStep + 1}/{steps.length}</span>
            </div>
            <button onClick={handleSkip} aria-label="Saltar" className="p-1 text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center`}>
                <step.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleAction}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm">
              {step.actionLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isLast && (
              <button onClick={() => setCurrentStep(prev => prev + 1)}
                className="text-stone-400 text-xs font-medium hover:text-stone-600 transition-colors px-3 py-3">
                Saltar
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-1">
            {steps.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-orange-600' : i < currentStep ? 'bg-orange-300' : 'bg-stone-200'}`} />
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
