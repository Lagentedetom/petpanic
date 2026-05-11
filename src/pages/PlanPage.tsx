import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Check,
  Sparkles,
  Heart,
  Users,
  MessageCircle,
  Bell,
  MapPin,
  Shield,
  Lock,
  Star,
  Gift,
  Settings,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/cn';

// Pricing source of truth — kept in sync with the Stripe products created in
// the dashboard. The actual amount charged is whatever Stripe says (this is
// just for display); Stripe's price IDs are server-side env vars.
const PRICE_MONTHLY = 4.99;
const PRICE_ANNUAL = 39.99;
const ANNUAL_MONTHLY_EQUIVALENT = PRICE_ANNUAL / 12;
const ANNUAL_SAVINGS_PCT = Math.round(((PRICE_MONTHLY * 12 - PRICE_ANNUAL) / (PRICE_MONTHLY * 12)) * 100);

type Interval = 'month' | 'year';

export default function PlanPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useApp();
  const { isTrialing, isActivePaid, daysLeftInTrial, hasActiveSocial, interval: activeInterval } = useSubscription();

  // Default to annual because it's the better deal — that's the framing.
  const [selectedInterval, setSelectedInterval] = useState<Interval>('year');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Surface checkout success/cancel from the Stripe redirect URL.
  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'success') {
      showToast('¡Suscripción activada! Bienvenido a PetPanic Social.', 'success');
      setSearchParams({}, { replace: true });
    } else if (stripeStatus === 'cancel') {
      showToast('Pago cancelado. Puedes activar Social cuando quieras.', 'info');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);

  const handleActivate = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { interval: selectedInterval },
      });
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('No se pudo crear la sesión de pago');
      window.location.href = url;
    } catch (err) {
      console.error('[stripe-checkout] failed:', err);
      showToast('No se pudo iniciar el pago. Inténtalo de nuevo.', 'error');
      setIsCheckingOut(false);
    }
  };

  const handleManagePortal = async () => {
    if (isOpeningPortal) return;
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {});
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('No se pudo abrir el portal');
      window.location.href = url;
    } catch (err) {
      console.error('[stripe-customer-portal] failed:', err);
      showToast('No se pudo abrir el portal. Inténtalo de nuevo.', 'error');
      setIsOpeningPortal(false);
    }
  };

  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="p-3 bg-white rounded-full shadow-sm border border-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <ChevronLeft aria-hidden="true" className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold">Mi plan</h2>
      </div>

      {/* Status banner — depends on real subscription state */}
      {isActivePaid && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-3xl p-6 shadow-lg shadow-emerald-200 space-y-2">
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="w-5 h-5" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
              Plan activo
            </p>
          </div>
          <h3 className="text-xl font-bold leading-tight">
            PetPanic Social {activeInterval === 'year' ? 'anual' : 'mensual'} activo
          </h3>
          <p className="text-sm text-white/90 leading-relaxed">
            Tienes acceso completo a todas las funciones sociales. Gracias por apoyar el proyecto.
          </p>
          <button
            onClick={handleManagePortal}
            disabled={isOpeningPortal}
            className="mt-2 w-full bg-white/15 hover:bg-white/25 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Settings aria-hidden="true" className="w-4 h-4" />
            {isOpeningPortal ? 'Abriendo...' : 'Gestionar suscripción'}
          </button>
        </div>
      )}
      {isTrialing && (
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-3xl p-6 shadow-lg shadow-orange-200 space-y-2">
          <div className="flex items-center gap-2">
            <Gift aria-hidden="true" className="w-5 h-5" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
              Prueba gratuita activa
            </p>
          </div>
          <h3 className="text-xl font-bold leading-tight">
            Te quedan {daysLeftInTrial} {daysLeftInTrial === 1 ? 'día' : 'días'} de PetPanic Social
          </h3>
          <p className="text-sm text-white/90 leading-relaxed">
            Acceso completo a la capa social, sin tarjeta. Aprovéchalo para crear tu zona de paseo y
            conectar con otros dueños de tu barrio.
          </p>
        </div>
      )}
      {!hasActiveSocial && (
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-6 shadow-lg shadow-stone-200 space-y-2">
          <div className="flex items-center gap-2">
            <Lock aria-hidden="true" className="w-5 h-5 text-orange-300" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
              Tu prueba gratuita ha terminado
            </p>
          </div>
          <h3 className="text-xl font-bold leading-tight">
            Activa PetPanic Social para recuperar tus zonas
          </h3>
          <p className="text-sm text-white/80 leading-relaxed">
            Desde {PRICE_ANNUAL} €/año vuelves a crear zonas, unirte a las existentes y recibir avisos
            cuando tus amigos llegan.
          </p>
        </div>
      )}

      {/* PetPanic Social — plan principal (solo visible si no tiene Social activo de pago) */}
      {!isActivePaid && (
        <div className="relative bg-gradient-to-br from-orange-50 via-white to-yellow-50 rounded-3xl border-2 border-orange-200 shadow-sm p-6 space-y-4 overflow-hidden">
          {/* Ribbon */}
          <div className="absolute top-5 right-5">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-yellow-300 text-stone-900 px-3 py-1.5 rounded-full shadow-sm">
              15 días gratis
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 text-orange-600">
              <Sparkles aria-hidden="true" className="w-5 h-5" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Plan recomendado</p>
            </div>
            <h3 className="text-2xl font-bold mt-1">PetPanic Social</h3>
          </div>

          {/* Mensual / Anual toggle */}
          <div role="radiogroup" aria-label="Elegir periodo de facturación" className="grid grid-cols-2 gap-2 bg-white/70 backdrop-blur-sm rounded-2xl p-1 border border-orange-100">
            <button
              type="button"
              role="radio"
              aria-checked={selectedInterval === 'year'}
              onClick={() => setSelectedInterval('year')}
              className={cn(
                "py-3 rounded-xl text-sm font-bold transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                selectedInterval === 'year'
                  ? "bg-orange-600 text-white shadow-md"
                  : "text-stone-600 hover:bg-white"
              )}
            >
              Anual
              <span className={cn(
                "ml-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full",
                selectedInterval === 'year' ? "bg-yellow-300 text-stone-900" : "bg-emerald-100 text-emerald-700"
              )}>
                –{ANNUAL_SAVINGS_PCT}%
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedInterval === 'month'}
              onClick={() => setSelectedInterval('month')}
              className={cn(
                "py-3 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                selectedInterval === 'month'
                  ? "bg-orange-600 text-white shadow-md"
                  : "text-stone-600 hover:bg-white"
              )}
            >
              Mensual
            </button>
          </div>

          {/* Price block */}
          <div>
            {selectedInterval === 'year' ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-stone-900">{PRICE_ANNUAL.toFixed(2).replace('.', ',')} €</span>
                  <span className="text-sm text-stone-500">/ año</span>
                </div>
                <p className="text-sm text-stone-600 mt-1">
                  Equivale a <strong>{ANNUAL_MONTHLY_EQUIVALENT.toFixed(2).replace('.', ',')} €/mes</strong>. Ahorras {ANNUAL_SAVINGS_PCT}% frente al plan mensual.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-stone-900">{PRICE_MONTHLY.toFixed(2).replace('.', ',')} €</span>
                  <span className="text-sm text-stone-500">/ mes</span>
                </div>
                <p className="text-sm text-stone-600 mt-1">
                  Sin permanencia. Cancela cuando quieras desde la app.
                </p>
              </>
            )}
            <p className="text-xs text-stone-500 mt-2">
              Los primeros <strong>15 días son gratis</strong> sin tarjeta. Solo se cobra si decides activar Social al terminar la prueba.
            </p>
          </div>

          <div className="border-t border-orange-100 pt-4 space-y-3">
            <PremiumFeature
              icon={<Star aria-hidden="true" className="w-3.5 h-3.5" />}
              text="Crea tu zona de paseo y sé el fundador/a oficial"
            />
            <PremiumFeature
              icon={<MapPin aria-hidden="true" className="w-3.5 h-3.5" />}
              text="Únete a zonas existentes y aparece en ellas"
            />
            <PremiumFeature
              icon={<Users aria-hidden="true" className="w-3.5 h-3.5" />}
              text="Ve cuánta gente hay ahora en las zonas donde estás apuntado"
            />
            <PremiumFeature
              icon={<Bell aria-hidden="true" className="w-3.5 h-3.5" />}
              text='Aviso "tu amigo acaba de llegar a tu zona" — aunque estés en casa'
            />
            <PremiumFeature
              icon={<MessageCircle aria-hidden="true" className="w-3.5 h-3.5" />}
              text="Añadir amigos por código y mensajería privada"
            />
          </div>

          {/* CTA */}
          <button
            onClick={handleActivate}
            disabled={isCheckingOut}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {isCheckingOut ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles aria-hidden="true" className="w-4 h-4" />
                {isTrialing ? 'Activar al terminar la prueba' : 'Activar PetPanic Social'}
              </>
            )}
          </button>

          {/* Limits callout */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 text-xs text-stone-600 leading-relaxed border border-orange-100 space-y-2">
            <p className="font-bold text-stone-800 flex items-center gap-2">
              <Star aria-hidden="true" className="w-3.5 h-3.5 text-orange-500" /> Límites de zonas
            </p>
            <p>
              Durante la prueba puedes crear <strong>1 zona</strong>. Con Social activo,
              hasta <strong>5 zonas</strong> a la vez. No se pueden crear dos zonas en el mismo
              sitio: si ya existe una cerca, la app te ofrecerá unirte a ella.
            </p>
          </div>
        </div>
      )}

      {/* Plan Gratis */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Si no pasas a Social
          </p>
          <h3 className="text-xl font-bold mt-1 flex items-center gap-2">
            <Heart aria-hidden="true" className="w-5 h-5 text-stone-400 fill-stone-400" />
            PetPanic Gratis
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            Todo lo esencial para encontrar a tu mascota, para siempre.
          </p>
        </div>

        <div className="border-t border-stone-100 pt-4 space-y-3">
          <FreeFeature icon={<Heart aria-hidden="true" className="w-4 h-4" />} text="Mascotas ilimitadas" />
          <FreeFeature icon={<Bell aria-hidden="true" className="w-4 h-4" />} text="Alertas de pérdida sin límite" />
          <FreeFeature
            icon={<MapPin aria-hidden="true" className="w-4 h-4" />}
            text="Aviso push a vecinos en 5 km y a protectoras cercanas"
          />
          <FreeFeature
            icon={<MessageCircle aria-hidden="true" className="w-4 h-4" />}
            text="Chat con quien te encuentra la mascota"
          />
          <FreeFeature
            icon={<Users aria-hidden="true" className="w-4 h-4" />}
            text="Ver el mapa de zonas de paseo (sin unirte ni crear)"
          />
        </div>

        <div className="bg-stone-50 rounded-2xl p-4 text-xs text-stone-500 leading-relaxed">
          <strong className="text-stone-700">
            Buscar a tu mascota siempre es gratis.
          </strong>{' '}
          Al terminar la prueba, las zonas que creaste siguen en el mapa, pero pierdes
          el acceso a su parte social hasta que reactives Social.
        </div>
      </div>

      {/* Privacidad */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-6 space-y-4 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
            <Shield aria-hidden="true" className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              Privacidad
            </p>
            <h3 className="text-lg font-bold">Tu ubicación, tuya</h3>
          </div>
        </div>

        <div className="space-y-3 text-sm text-white/80 leading-relaxed">
          <div className="flex items-start gap-3">
            <Lock aria-hidden="true" className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
            <p>
              PetPanic{' '}
              <strong className="text-white">
                solo envía tu ubicación al servidor cuando entras en una zona de paseo en la
                que te has dado de alta
              </strong>
              . Fuera de esas zonas, la app no sabe dónde estás.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Users aria-hidden="true" className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
            <p>
              Tu presencia en una zona solo es visible para personas que sean{' '}
              <strong className="text-white">amigas tuyas</strong> (les has dado tu código de
              amigo) <strong className="text-white">y</strong> que además estén dadas de alta
              en esa misma zona. Un desconocido que entre en la zona solo ve "hay X personas
              paseando", nunca tu nombre.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-lg">Preguntas frecuentes</h3>

        <FaqBlock
          q="¿Tengo que pagar para lanzar una alerta?"
          a="No. Nunca. Lanzar alertas, recibirlas, chatear con quien encuentra a tu mascota y registrar todas tus mascotas es gratis para siempre."
        />
        <FaqBlock
          q="¿Las protectoras reciben las alertas?"
          a="Sí, automáticamente. Cuando se lanza una alerta de pérdida, las protectoras cercanas reciben un aviso para que estén atentas por si el animal aparece. Forma parte del plan gratuito."
        />
        <FaqBlock
          q="¿Cómo funciona la prueba gratuita?"
          a="Al registrarte, tu cuenta arranca con 15 días completos de PetPanic Social sin introducir tarjeta. Durante esos días puedes crear tu primera zona, unirte a otras, añadir amigos y probar toda la capa social. Al terminar decides si quieres seguir activando Social, o quedarte en el plan gratuito."
        />
        <FaqBlock
          q="¿Cuál es la diferencia entre el plan mensual y el anual?"
          a={`El plan mensual son ${PRICE_MONTHLY.toFixed(2).replace('.', ',')} € al mes, sin compromiso, cancelas cuando quieras. El anual son ${PRICE_ANNUAL.toFixed(2).replace('.', ',')} € al año (equivalente a ${ANNUAL_MONTHLY_EQUIVALENT.toFixed(2).replace('.', ',')} €/mes), un ${ANNUAL_SAVINGS_PCT}% más barato. Funciona exactamente igual; solo cambia la frecuencia de cobro.`}
        />
        <FaqBlock
          q="¿Puedo cambiar de mensual a anual o cancelar cuando quiera?"
          a="Sí, desde el botón 'Gestionar suscripción' que aparece arriba cuando tienes Social activo. Te lleva al portal de Stripe donde puedes cambiar de plan, actualizar la tarjeta o cancelar. Si cancelas, mantienes Social hasta el final del periodo ya pagado."
        />
        <FaqBlock
          q="¿Qué pasa con mis zonas si dejo Social?"
          a="Siguen existiendo y visibles en el mapa para todos. Tú, como usuario gratuito, pierdes el acceso a su parte social. Si reactivas Social en el futuro, recuperas automáticamente el acceso a las zonas que creaste, sin perder nada."
        />
      </div>
    </motion.div>
  );
}

function FreeFeature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check aria-hidden="true" className="w-4 h-4" strokeWidth={3} />
      </div>
      <div className="flex items-center gap-2 text-sm text-stone-700 leading-snug pt-1">
        <span className="text-stone-400">{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

function PremiumFeature({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon ?? <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />}
      </div>
      <span className="text-sm text-stone-700 leading-snug pt-1">{text}</span>
    </div>
  );
}

function FaqBlock({ q, a }: { q: string; a: string }) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer flex items-start justify-between gap-3 py-2">
        <span className="font-semibold text-sm text-stone-800">{q}</span>
        <span className="text-orange-500 text-xl leading-none font-light group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <p className="text-xs text-stone-500 leading-relaxed pt-1 pb-2">{a}</p>
    </details>
  );
}
