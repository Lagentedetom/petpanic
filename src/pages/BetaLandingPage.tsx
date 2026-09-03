import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  MapPin,
  Users,
  Heart,
  Shield,
  Bell,
  Smartphone,
  CheckCircle2,
  Mail,
  ArrowRight,
} from 'lucide-react';

/**
 * Public landing for the closed beta pilot with animal protectoras.
 * Accessible at /beta, no login required (routed in App.tsx before the auth gate).
 *
 * Goals:
 *   - Explain what PetPanic is and how it works to any visitor.
 *   - Onboard the ~20 socios from a partner protectora into the beta.
 *   - Stay aligned with the rest of the app's visual language (Tailwind, orange-500/600, stone scale).
 *
 * The hero CTA points to the existing web app (app.petpanic.es) so visitors can
 * try the PWA immediately. When the Google Play Internal Testing link is live,
 * swap it into PLAY_STORE_URL below.
 */

const PLAY_STORE_URL: string | null = null; // TODO: set when Google Play Internal Testing link is live
const CONTACT_EMAIL = 'hola@petpanic.es';

export default function BetaLandingPage() {
  useEffect(() => {
    document.title = 'PetPanic — Prueba la app | Beta cerrada';
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <Header />
      <main>
        <Hero />
        <WhatIs />
        <HowItWorks />
        <Features />
        <PilotSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
        <a href="/beta" className="flex items-center gap-2">
          <img
            src="/petpanic-logo.svg"
            alt="PetPanic"
            className="h-8 w-8"
            loading="eager"
          />
          <span className="font-bold text-lg text-stone-900">PetPanic</span>
        </a>
        <a
          href="#instalar"
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          Probar la app
        </a>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-stone-50 to-amber-50 border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-5 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-semibold mb-5">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Beta cerrada — piloto con protectoras
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-stone-900">
            Cuando tu perro se pierde,
            <br />
            <span className="text-orange-600">tu barrio entero responde.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-stone-700 leading-relaxed max-w-2xl">
            PetPanic avisa al instante a los vecinos y protectoras de tu zona en cuanto
            lanzas un aviso. Más ojos buscando, en menos tiempo. Hecho en España, gratis
            para empezar.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="#instalar"
              className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
            >
              <Smartphone className="w-5 h-5" />
              Instalar la app
            </a>
            <a
              href="https://app.petpanic.es"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-900 font-semibold px-6 py-3 rounded-xl border border-stone-300 transition-colors"
            >
              Probarla en el navegador
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            Sin tarjeta. Funciones esenciales gratis para siempre.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* What is PetPanic                                                            */
/* -------------------------------------------------------------------------- */

function WhatIs() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-6">
          Las primeras horas son las que más importan.
        </h2>
        <div className="space-y-5 text-stone-700 text-lg leading-relaxed">
          <p>
            Cuando un perro se pierde, la mayoría de avisos se quedan en el grupo de
            WhatsApp del bloque o en un cartel pegado a una farola. Mientras tanto,
            el perro sigue moviéndose.
          </p>
          <p>
            <strong className="text-stone-900">PetPanic</strong> hace que tu aviso
            llegue al instante a las personas que están cerca: vecinos, amigos y
            protectoras de la zona. Sin imprimir nada. Sin esperar a que alguien lo
            comparta.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works (4 steps)                                                     */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      num: '1',
      title: 'Registra a tu mascota',
      desc: 'Una foto, su nombre y unos datos básicos. Cinco minutos.',
      icon: Heart,
    },
    {
      num: '2',
      title: 'Si se pierde, lanza un aviso',
      desc: 'Un solo botón. La app capta tu ubicación y crea la alerta al momento.',
      icon: AlertCircle,
    },
    {
      num: '3',
      title: 'Avisamos a quienes están cerca',
      desc: 'Tus amigos en PetPanic y las protectoras que cubren la zona reciben el aviso al instante.',
      icon: Bell,
    },
    {
      num: '4',
      title: 'La encontráis juntos',
      desc: 'Cuando aparece, marcas la alerta como resuelta y avisamos a todo el mundo.',
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="bg-white py-16 sm:py-20 border-y border-stone-200">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-12 text-center">
          Cómo funciona
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.li
              key={s.num}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.08 }}
              className="relative bg-stone-50 rounded-2xl p-6 border border-stone-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-600 text-white font-bold text-sm">
                  {s.num}
                </span>
                <s.icon className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-bold text-stone-900 mb-2">{s.title}</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{s.desc}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features grid                                                              */
/* -------------------------------------------------------------------------- */

function Features() {
  const features = [
    {
      icon: AlertCircle,
      title: 'Avisos geolocalizados',
      desc: 'Tu aviso solo se envía a quienes están en el radio relevante. Sin spam, sin ruido.',
    },
    {
      icon: MapPin,
      title: 'Mapa de la zona',
      desc: 'Ves en tiempo real las mascotas perdidas cerca de ti y las zonas activas de búsqueda.',
    },
    {
      icon: Users,
      title: 'Red de amigos',
      desc: 'Conecta con otras personas que también tienen mascotas. Os ayudáis cuando una se pierde.',
    },
    {
      icon: Heart,
      title: 'Zonas de paseo',
      desc: 'Comparte los sitios donde paseas habitualmente. Otros usuarios ven dónde hay actividad.',
    },
    {
      icon: Shield,
      title: 'Protectoras conectadas',
      desc: 'Las protectoras locales reciben tus avisos al instante. Más ojos, mejor coordinación.',
    },
    {
      icon: Bell,
      title: 'Sin instalar nada para los amigos',
      desc: 'Quien recibe el aviso lo abre desde un enlace. No hace falta que tengan la app.',
    },
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-12 text-center">
          Lo que hace por ti
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-stone-200 hover:border-orange-300 hover:shadow-md transition"
            >
              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-orange-700" />
              </div>
              <h3 className="font-bold text-stone-900 mb-2">{f.title}</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pilot section — install + what we ask                                      */
/* -------------------------------------------------------------------------- */

function PilotSection() {
  return (
    <section
      id="instalar"
      className="bg-gradient-to-br from-orange-600 to-orange-700 text-white py-16 sm:py-20"
    >
      <div className="max-w-3xl mx-auto px-5">
        <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold mb-5">
          Para socios del piloto
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-6">
          ¿Te ha llegado este enlace desde tu protectora?
        </h2>
        <p className="text-orange-100 text-lg leading-relaxed mb-8">
          Estás en el grupo de personas que va a probar PetPanic antes de su lanzamiento
          público. Tu feedback es lo que determina qué arreglamos y qué priorizamos.
        </p>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 sm:p-8 mb-8">
          <h3 className="font-bold text-xl mb-4">Cómo participar</h3>
          <ol className="space-y-4 text-orange-50">
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                1
              </span>
              <span>
                <strong className="text-white">Instala la app.</strong>{' '}
                {PLAY_STORE_URL ? (
                  <>
                    Disponible en{' '}
                    <a
                      href={PLAY_STORE_URL}
                      className="underline font-semibold hover:text-white"
                    >
                      Google Play (canal de prueba)
                    </a>
                    . iPhone aún no — llega en pocos días.
                  </>
                ) : (
                  <>
                    Estamos terminando el alta en Google Play. Hasta entonces puedes
                    usar la versión web abriendo{' '}
                    <a
                      href="https://app.petpanic.es"
                      className="underline font-semibold hover:text-white"
                    >
                      app.petpanic.es
                    </a>{' '}
                    en tu móvil.
                  </>
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                2
              </span>
              <span>
                <strong className="text-white">Úsala 3 semanas con normalidad.</strong>{' '}
                Registra a tu mascota, prueba lanzar un aviso de prueba, conecta con
                amigos, mira el mapa. Lo que harías de verdad.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                3
              </span>
              <span>
                <strong className="text-white">Cuéntanos.</strong> Al final del piloto
                te mandamos un formulario corto (10 minutos) para que nos digas qué te
                ha gustado y qué no. Si encuentras algo que no funciona durante el
                piloto, escríbenos directamente a{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="underline font-semibold hover:text-white"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </span>
            </li>
          </ol>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 sm:p-8">
          <h3 className="font-bold text-xl mb-4">Qué te llevas tú</h3>
          <ul className="space-y-3 text-orange-50">
            <li className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">6 meses gratis</strong> de PetPanic Social
                cuando lancemos la versión de pago.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Tu protectora recibe una donación</strong>{' '}
                en agradecimiento por ayudar al piloto.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Acceso directo al equipo.</strong>{' '}
                Si algo no te encaja, lo arreglamos contigo.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

function FAQ() {
  const items = [
    {
      q: '¿Es gratis?',
      a: 'Las funciones esenciales son gratis y van a seguir siéndolo. Hay una versión de pago con extras (PetPanic Social) pero durante el piloto no la necesitas.',
    },
    {
      q: '¿Qué pasa con mis datos?',
      a: 'Tus datos están alojados en servidores europeos (Supabase, eu-west-2). Solo compartimos tu ubicación cuando tú lanzas un aviso, y solo con personas en el radio relevante. Puedes borrar tu cuenta en cualquier momento desde el perfil.',
    },
    {
      q: '¿Funciona en iPhone?',
      a: 'La versión web (app.petpanic.es) funciona en iPhone. La app nativa para iOS llega en pocos días — te avisaremos por email cuando esté disponible en TestFlight.',
    },
    {
      q: 'Soy socio de una protectora pero no tengo perro, ¿puedo participar?',
      a: 'Sí. Puedes registrar la cuenta sin mascota propia y usar la app para ayudar cuando otras personas lancen avisos en tu zona. Eso es justamente lo que más necesitamos probar.',
    },
    {
      q: '¿Cuánto dura el piloto?',
      a: 'Tres semanas de uso activo + una de cierre. Después decides si te quedas o no, sin compromiso.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-stone-100">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-10">
          Dudas frecuentes
        </h2>
        <dl className="space-y-4">
          {items.map((it) => (
            <details
              key={it.q}
              className="group bg-white rounded-2xl border border-stone-200 overflow-hidden"
            >
              <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4 font-semibold text-stone-900 hover:bg-stone-50">
                <span>{it.q}</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 group-open:bg-orange-100 text-stone-600 group-open:text-orange-700 flex items-center justify-center text-sm font-bold transition">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <div className="px-5 pb-5 text-stone-600 leading-relaxed">{it.a}</div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                  */
/* -------------------------------------------------------------------------- */

function CTA() {
  return (
    <section className="py-16 sm:py-20 bg-white border-t border-stone-200">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4">
          ¿Empezamos?
        </h2>
        <p className="text-stone-600 text-lg mb-8 max-w-xl mx-auto">
          Si has llegado hasta aquí, ya formas parte del piloto. Solo te falta abrir la
          app.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://app.petpanic.es"
            className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
          >
            <Smartphone className="w-5 h-5" />
            Abrir PetPanic
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Quiero%20participar%20en%20el%20piloto%20de%20PetPanic`}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-900 font-semibold px-6 py-3 rounded-xl border border-stone-300 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Escríbenos
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 py-10">
      <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/petpanic-logo.svg"
            alt="PetPanic"
            className="h-7 w-7 brightness-0 invert"
          />
          <span className="font-bold text-white">PetPanic</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition">
            {CONTACT_EMAIL}
          </a>
          <a href="/privacidad" className="hover:text-white transition">
            Privacidad
          </a>
          <a href="/terminos" className="hover:text-white transition">
            Términos
          </a>
          <a href="https://petpanic.es" className="hover:text-white transition">
            petpanic.es
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-5 mt-6 text-xs text-stone-500">
        © {new Date().getFullYear()} La Gente de Tom S.L.U. — Hecho en Sant Cugat.
      </div>
    </footer>
  );
}
