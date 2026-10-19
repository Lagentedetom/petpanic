import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { ChevronLeft, Check, Gift, Lock, Settings, RotateCcw, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/cn';
import {
  storeBillingAvailable,
  initBilling,
  getStorePlans,
  buy,
  restore,
  storeManagementUrl,
  type StorePlan,
} from '../lib/billing';

// Precios de la web (Stripe). En iOS y Android el precio que se enseña es el
// que devuelve la tienda, ya en la moneda del usuario.
const PRICE_MONTHLY = 4.99;
const PRICE_ANNUAL = 39.99;
const ANNUAL_SAVINGS_PCT = Math.round(((PRICE_MONTHLY * 12 - PRICE_ANNUAL) / (PRICE_MONTHLY * 12)) * 100);

type Interval = 'month' | 'year';

export default function PlanPage() {
  const { t, i18n } = useTranslation('plan');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast, user, userProfile } = useApp();
  const { isTrialing, isActivePaid, daysLeftInTrial, hasActiveSocial, interval: activeInterval } = useSubscription();

  const native = Capacitor.isNativePlatform();
  const store = Capacitor.getPlatform() === 'ios' ? 'apple' : 'google';
  const source = userProfile?.billing_source ?? null;

  const [selected, setSelected] = useState<Interval>('year');
  const [busy, setBusy] = useState<'buy' | 'manage' | 'restore' | null>(null);
  const [storePlans, setStorePlans] = useState<StorePlan[] | null>(null);

  const money = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(value);
  const priceOf = (interval: Interval) =>
    native
      ? storePlans?.find((p) => p.interval === interval)?.price ?? '—'
      : money(interval === 'year' ? PRICE_ANNUAL : PRICE_MONTHLY);

  // Vuelta de Stripe Checkout (web)
  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'success') {
      showToast(t('toast.activated'), 'success');
      setSearchParams({}, { replace: true });
    } else if (stripeStatus === 'cancel') {
      showToast(t('toast.cancelled'), 'info');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast, t]);

  // Precios de la tienda (nativo)
  useEffect(() => {
    if (!native || !user || !storeBillingAvailable()) return;
    let alive = true;
    initBilling(user.id)
      .then(() => getStorePlans())
      .then((plans) => { if (alive) setStorePlans(plans); })
      .catch((err) => {
        console.error('[plan] no se pudieron cargar los planes de la tienda:', err);
        if (alive) setStorePlans([]);
      });
    return () => { alive = false; };
  }, [native, user]);

  const handleBuy = async () => {
    if (busy) return;
    setBusy('buy');
    if (!native) {
      try {
        const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { interval: selected } });
        if (error) throw error;
        const url = (data as { url?: string } | null)?.url;
        if (!url) throw new Error('sin url de checkout');
        window.location.href = url;
        return;
      } catch (err) {
        console.error('[stripe-checkout] failed:', err);
        showToast(t('toast.checkoutError'), 'error');
        setBusy(null);
        return;
      }
    }
    const plan = storePlans?.find((p) => p.interval === selected);
    if (!plan) { setBusy(null); return; }
    const outcome = await buy(plan);
    if (outcome === 'ok') showToast(t('toast.purchased'), 'success');
    if (outcome === 'error') showToast(t('toast.purchaseError'), 'error');
    setBusy(null);
  };

  const handleRestore = async () => {
    if (busy || !user) return;
    setBusy('restore');
    try {
      await initBilling(user.id);
      const found = await restore();
      showToast(found ? t('toast.restored') : t('toast.nothingToRestore'), found ? 'success' : 'info');
    } catch (err) {
      console.error('[plan] restaurar falló:', err);
      showToast(t('toast.purchaseError'), 'error');
    }
    setBusy(null);
  };

  const handleManage = async () => {
    if (busy) return;
    setBusy('manage');
    try {
      if (source === 'stripe') {
        const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {});
        if (error) throw error;
        const url = (data as { url?: string } | null)?.url;
        if (!url) throw new Error('sin url del portal');
        window.location.href = url;
        return;
      }
      if (user) await initBilling(user.id);
      const url = await storeManagementUrl();
      if (url) window.open(url, '_blank');
    } catch (err) {
      console.error('[plan] gestionar falló:', err);
      showToast(t('toast.manageError'), 'error');
    }
    setBusy(null);
  };

  // Quién gestiona la suscripción activa, visto desde esta plataforma
  const manageHere = source === 'stripe' ? !native : native && ((source === 'app_store' && store === 'apple') || (source === 'play_store' && store === 'google'));
  const managedElsewhere = isActivePaid && !manageHere;
  const canBuyHere = !native || storeBillingAvailable();

  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5 pb-24"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common:actions.back')}
          className="p-3 bg-white rounded-full border border-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          <ChevronLeft aria-hidden="true" className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-extrabold">{t('title')}</h2>
      </div>

      {/* Estado */}
      {isActivePaid && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Check aria-hidden="true" className="w-4 h-4" /> {t('status.activeLabel')}
          </p>
          <h3 className="text-xl font-bold">{activeInterval === 'year' ? t('status.activeAnnual') : t('status.activeMonthly')}</h3>
          {managedElsewhere ? (
            <p className="text-sm text-stone-600">
              {source === 'stripe' ? t('status.managedOnWeb') : source === 'app_store' ? t('status.managedOnApple') : t('status.managedOnGoogle')}
            </p>
          ) : (
            <button
              onClick={handleManage}
              disabled={busy !== null}
              className="mt-1 w-full bg-white border border-stone-300 text-stone-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            >
              <Settings aria-hidden="true" className="w-4 h-4" />
              {busy === 'manage' ? t('common:actions.loading') : t('status.manage')}
            </button>
          )}
        </section>
      )}
      {isTrialing && (
        <section className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-orange-700">
            <Gift aria-hidden="true" className="w-4 h-4" /> {t('status.trialLabel')}
          </p>
          <h3 className="text-xl font-bold">{t('status.trialDaysLeft', { count: daysLeftInTrial })}</h3>
          <p className="text-sm text-stone-600">{t('status.trialBody')}</p>
        </section>
      )}
      {!hasActiveSocial && (
        <section className="bg-stone-100 border border-stone-200 rounded-2xl p-5 space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <Lock aria-hidden="true" className="w-4 h-4" /> {t('status.expiredLabel')}
          </p>
          <h3 className="text-xl font-bold">{t('status.expiredTitle')}</h3>
          <p className="text-sm text-stone-600">{t('status.expiredBody')}</p>
        </section>
      )}

      {/* PetPanic Social: la tarjeta destacada, como en la web */}
      {!isActivePaid && (
        <section className="relative bg-stone-900 text-stone-50 rounded-2xl p-6 pt-7 space-y-5" aria-labelledby="plan-social">
          <span className="absolute -top-3 right-5 bg-yellow-400 text-stone-900 text-xs font-bold px-3 py-1 rounded-full">
            {t('social.badge')}
          </span>
          <h3 id="plan-social" className="text-lg font-bold">PetPanic Social</h3>

          <div role="radiogroup" aria-label={t('social.intervalLabel')} className="grid grid-cols-2 gap-2">
            {(['year', 'month'] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                role="radio"
                aria-checked={selected === interval}
                onClick={() => setSelected(interval)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                  selected === interval ? 'border-orange-500 bg-orange-500/10' : 'border-stone-700'
                )}
              >
                <span className="block text-sm font-semibold text-stone-300">
                  {interval === 'year' ? t('social.annual') : t('social.monthly')}
                  {interval === 'year' && !native && (
                    <span className="ml-1 text-xs text-emerald-300">−{ANNUAL_SAVINGS_PCT} %</span>
                  )}
                </span>
                <span className="block font-display text-2xl font-extrabold text-orange-400">{priceOf(interval)}</span>
                <span className="block text-xs text-stone-400">{interval === 'year' ? t('social.perYear') : t('social.perMonth')}</span>
              </button>
            ))}
          </div>

          <ul className="space-y-2.5 text-sm">
            {(['zones', 'join', 'count', 'friendArrives', 'friends'] as const).map((key) => (
              <li key={key} className="flex gap-2.5">
                <Check aria-hidden="true" className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-400" />
                <span className="text-stone-200">{t(`social.features.${key}`)}</span>
              </li>
            ))}
          </ul>

          {canBuyHere ? (
            <button
              onClick={handleBuy}
              disabled={busy !== null || (native && !storePlans?.length)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
            >
              {busy === 'buy'
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : isTrialing ? t('social.ctaTrial') : t('social.cta')}
            </button>
          ) : (
            <p className="text-sm text-stone-300">{t('social.storeSoon')}</p>
          )}
          {canBuyHere && isTrialing && <p className="text-xs text-stone-400 -mt-2">{t('social.trialNote')}</p>}

          {native ? (
            <div className="space-y-3 text-xs text-stone-400 leading-relaxed">
              <p>{store === 'apple' ? t('legal.autoRenewApple') : t('legal.autoRenewGoogle')}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <a href="/terminos" className="underline text-stone-300">{t('legal.terms')}</a>
                <a href="/privacidad" className="underline text-stone-300">{t('legal.privacy')}</a>
              </p>
              {canBuyHere && (
                <button onClick={handleRestore} disabled={busy !== null} className="flex items-center gap-1.5 font-semibold text-stone-200 underline disabled:opacity-50">
                  <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                  {busy === 'restore' ? t('common:actions.loading') : t('legal.restore')}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-stone-400">{t('legal.webNote')}</p>
          )}
        </section>
      )}

      {/* Lo gratis */}
      <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4" aria-labelledby="plan-free">
        <div>
          <h3 id="plan-free" className="text-lg font-bold">{t('free.title')}</h3>
          <p className="font-display text-4xl font-extrabold text-emerald-700 mt-1">
            {money(0)} <span className="font-sans text-sm font-semibold text-stone-500">{t('free.always')}</span>
          </p>
        </div>
        <ul className="space-y-2.5 text-sm">
          {(['pets', 'panic', 'notify', 'chat', 'qr'] as const).map((key) => (
            <li key={key} className="flex gap-2.5">
              <Check aria-hidden="true" className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
              <span className="text-stone-700">{t(`free.features.${key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-500 leading-relaxed">{t('free.note')}</p>
      </section>

      {/* Privacidad: lo que de verdad hace la app */}
      <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Shield aria-hidden="true" className="w-5 h-5 text-emerald-600" /> {t('privacy.title')}
        </h3>
        <p className="text-sm text-stone-600 leading-relaxed">
          <Trans t={t} i18nKey="privacy.location" components={{ b: <strong className="text-stone-900" /> }} />
        </p>
        <p className="text-sm text-stone-600 leading-relaxed">
          <Trans t={t} i18nKey="privacy.zones" components={{ b: <strong className="text-stone-900" /> }} />
        </p>
      </section>

      {/* Preguntas */}
      <section className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-2">{t('faq.title')}</h3>
        {(['free', 'trial', 'cancel', 'zones'] as const).map((key) => (
          <details key={key} className="group border-t border-stone-200 first-of-type:border-t-0">
            <summary className="list-none cursor-pointer flex items-start justify-between gap-3 py-3 font-semibold text-sm text-stone-900">
              {t(`faq.${key}.q`)}
              <span aria-hidden="true" className="text-orange-600 text-xl leading-none group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="text-sm text-stone-600 leading-relaxed pb-3">
              {t(`faq.${key}.a`, { store: native ? (store === 'apple' ? 'App Store' : 'Google Play') : 'Stripe' })}
            </p>
          </details>
        ))}
      </section>
    </motion.div>
  );
}
