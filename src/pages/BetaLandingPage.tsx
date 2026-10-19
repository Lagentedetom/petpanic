import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  MessageSquare,
  QrCode,
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
  const { t } = useTranslation('beta');
  useEffect(() => {
    document.title = t('meta.title');
  }, [t]);

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
  const { t } = useTranslation('beta');
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
        <a href="/beta" className="flex items-center gap-2">
          <img
            src="/petpanic-logo.svg"
            alt={t('common:brand')}
            className="h-8 w-8"
            loading="eager"
          />
          <span className="font-bold text-lg text-stone-900">{t('common:brand')}</span>
        </a>
        <a
          href="#instalar"
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          {t('header.cta')}
        </a>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t } = useTranslation('beta');
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
            {t('hero.badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-stone-900">
            <Trans
              t={t}
              i18nKey="hero.title"
              components={{ br: <br />, accent: <span className="text-orange-600" /> }}
            />
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-stone-700 leading-relaxed max-w-2xl">
            {t('hero.lead')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="#instalar"
              className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
            >
              <Smartphone className="w-5 h-5" />
              {t('hero.install')}
            </a>
            <a
              href="https://app.petpanic.es"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-900 font-semibold px-6 py-3 rounded-xl border border-stone-300 transition-colors"
            >
              {t('hero.tryWeb')}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            {t('hero.note')}
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
  const { t } = useTranslation('beta');
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-6">
          {t('whatIs.title')}
        </h2>
        <div className="space-y-5 text-stone-700 text-lg leading-relaxed">
          <p>{t('whatIs.problem')}</p>
          <p>
            <Trans
              t={t}
              i18nKey="whatIs.solution"
              components={{ strong: <strong className="text-stone-900" /> }}
            />
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
  const { t } = useTranslation('beta');
  const steps = [
    { num: '1', id: 'register', icon: Heart },
    { num: '2', id: 'alert', icon: AlertCircle },
    { num: '3', id: 'notify', icon: Bell },
    { num: '4', id: 'together', icon: CheckCircle2 },
  ].map((s) => ({
    ...s,
    title: t(`how.steps.${s.id}.title`),
    desc: t(`how.steps.${s.id}.desc`),
  }));

  return (
    <section className="bg-white py-16 sm:py-20 border-y border-stone-200">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-12 text-center">
          {t('how.title')}
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
  const { t } = useTranslation('beta');
  const features = [
    { id: 'nearby', icon: AlertCircle },
    { id: 'shelters', icon: Shield },
    { id: 'chat', icon: MessageSquare },
    { id: 'tag', icon: QrCode },
    { id: 'friends', icon: Users },
    { id: 'walks', icon: MapPin },
  ].map((f) => ({
    ...f,
    title: t(`features.items.${f.id}.title`),
    desc: t(`features.items.${f.id}.desc`),
  }));

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-12 text-center">
          {t('features.title')}
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
  const { t } = useTranslation('beta');
  const linkClass = 'underline font-semibold hover:text-white';
  return (
    <section
      id="instalar"
      className="bg-gradient-to-br from-orange-600 to-orange-700 text-white py-16 sm:py-20"
    >
      <div className="max-w-3xl mx-auto px-5">
        <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold mb-5">
          {t('pilot.badge')}
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-6">
          {t('pilot.title')}
        </h2>
        <p className="text-orange-100 text-lg leading-relaxed mb-8">
          {t('pilot.intro')}
        </p>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 sm:p-8 mb-8">
          <h3 className="font-bold text-xl mb-4">{t('pilot.join.title')}</h3>
          <ol className="space-y-4 text-orange-50">
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                1
              </span>
              <span>
                <strong className="text-white">{t('pilot.join.install.title')}</strong>{' '}
                {PLAY_STORE_URL ? (
                  <Trans
                    t={t}
                    i18nKey="pilot.join.install.play"
                    components={{ link: <a href={PLAY_STORE_URL} className={linkClass} /> }}
                  />
                ) : (
                  <Trans
                    t={t}
                    i18nKey="pilot.join.install.web"
                    components={{ link: <a href="https://app.petpanic.es" className={linkClass} /> }}
                  />
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                2
              </span>
              <span>
                <strong className="text-white">{t('pilot.join.use.title', { count: 3 })}</strong>{' '}
                {t('pilot.join.use.desc')}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-sm">
                3
              </span>
              <span>
                <strong className="text-white">{t('pilot.join.tell.title')}</strong>{' '}
                <Trans
                  t={t}
                  i18nKey="pilot.join.tell.desc"
                  count={10}
                  values={{ email: CONTACT_EMAIL }}
                  components={{ mail: <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass} /> }}
                />
              </span>
            </li>
          </ol>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 sm:p-8">
          <h3 className="font-bold text-xl mb-4">{t('pilot.perks.title')}</h3>
          <ul className="space-y-3 text-orange-50">
            {(['trial', 'free', 'team'] as const).map((id) => (
              <li key={id} className="flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  <Trans
                    t={t}
                    i18nKey={`pilot.perks.${id}`}
                    components={{ strong: <strong className="text-white" /> }}
                  />
                </span>
              </li>
            ))}
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
  const { t } = useTranslation('beta');
  const items = (['free', 'data', 'iphone', 'noPet', 'duration'] as const).map((id) => ({
    q: t(`faq.items.${id}.q`),
    a: t(`faq.items.${id}.a`),
  }));

  return (
    <section className="py-16 sm:py-20 bg-stone-100">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-10">
          {t('faq.title')}
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
  const { t } = useTranslation('beta');
  return (
    <section className="py-16 sm:py-20 bg-white border-t border-stone-200">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4">
          {t('cta.title')}
        </h2>
        <p className="text-stone-600 text-lg mb-8 max-w-xl mx-auto">
          {t('cta.text')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://app.petpanic.es"
            className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
          >
            <Smartphone className="w-5 h-5" />
            {t('cta.open')}
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('cta.mailSubject'))}`}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-900 font-semibold px-6 py-3 rounded-xl border border-stone-300 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {t('cta.write')}
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
  const { t } = useTranslation('beta');
  return (
    <footer className="bg-stone-900 text-stone-300 py-10">
      <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/petpanic-logo.svg"
            alt={t('common:brand')}
            className="h-7 w-7 brightness-0 invert"
          />
          <span className="font-bold text-white">{t('common:brand')}</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition">
            {CONTACT_EMAIL}
          </a>
          <a href="/privacidad" className="hover:text-white transition">
            {t('footer.privacy')}
          </a>
          <a href="/terminos" className="hover:text-white transition">
            {t('footer.terms')}
          </a>
          <a href="https://petpanic.es" className="hover:text-white transition">
            petpanic.es
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-5 mt-6 text-xs text-stone-500">
        {t('footer.copyright', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
