import { useState, useEffect, useMemo } from 'react';
import { Bell, MapPin, Mail, Check, AlertCircle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

type CpInfo = { city: string; province: string } | null;

export default function ProtectorasAltaPage() {
  const { t } = useTranslation('shelters');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [cpBase, setCpBase] = useState('');
  const [radioKm, setRadioKm] = useState(25);
  const [optInPerdidos, setOptInPerdidos] = useState(true);
  const [optInEncontrados, setOptInEncontrados] = useState(true);
  const [optInOverflow, setOptInOverflow] = useState(false);
  const [digestDiario, setDigestDiario] = useState(false);

  const [cpInfo, setCpInfo] = useState<CpInfo>(null);
  const [cpChecking, setCpChecking] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Clave de traducción del error (namespace `shelters`), no el texto.
  const [error, setError] = useState<string | null>(null);

  // Validate CP against spanish_postal_codes as the user types (debounced).
  useEffect(() => {
    if (!/^\d{5}$/.test(cpBase)) {
      setCpInfo(null);
      return;
    }
    setCpChecking(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('spanish_postal_codes')
        .select('city, province')
        .eq('cp', cpBase)
        .maybeSingle();
      setCpInfo(data || null);
      setCpChecking(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [cpBase]);

  const canSubmit = useMemo(
    () =>
      nombre.trim().length >= 2 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
      cpInfo !== null &&
      radioKm >= 5 &&
      radioKm <= 100 &&
      (optInPerdidos || optInEncontrados),
    [nombre, email, cpInfo, radioKm, optInPerdidos, optInEncontrados],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'protectora-subscribe',
        {
          body: {
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            cp_base: cpBase,
            radio_km: radioKm,
            opt_in_perdidos: optInPerdidos,
            opt_in_encontrados: optInEncontrados,
            opt_in_overflow_50km: optInOverflow,
            digest_diario: digestDiario,
          },
        },
      );
      if (fnErr) throw fnErr;
      if (!data?.ok) {
        setError(mapError(data?.error));
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('signup.errors.send');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PublicShell>
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold">{t('signup.sent.title')}</h1>
          <p className="text-stone-600 leading-relaxed">
            <Trans t={t} i18nKey="signup.sent.body" values={{ email }} components={{ strong: <strong />, em: <em /> }} />
          </p>
          <p className="text-xs text-stone-400">
            <Trans t={t} i18nKey="signup.sent.spam" values={{ sender: 'alertas@petpanic.es' }} components={{ strong: <strong /> }} />
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600">{t('signup.eyebrow')}</p>
        <h1 className="text-3xl font-bold leading-tight">{t('signup.title')}</h1>
        <p className="text-stone-600 leading-relaxed pt-2">
          {t('signup.intro')}
        </p>
      </div>

      <ul className="space-y-3 py-2 text-sm text-stone-700">
        <Feat icon={Bell}>{t('signup.features.alert')}</Feat>
        <Feat icon={MapPin}>{t('signup.features.zone')}</Feat>
        <Feat icon={Check}>{t('signup.features.closed')}</Feat>
      </ul>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
        <Field label={t('signup.fields.name')} htmlFor="prot-nombre">
          <input
            id="prot-nombre"
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={t('signup.fields.namePlaceholder')}
            className={inputClass}
            required
            maxLength={120}
            autoComplete="organization"
          />
        </Field>

        <Field label={t('signup.fields.email')} htmlFor="prot-email">
          <input
            id="prot-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('signup.fields.emailPlaceholder')}
            className={inputClass}
            required
            autoComplete="email"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('signup.fields.postcode')} htmlFor="prot-cp">
            <input
              id="prot-cp"
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              value={cpBase}
              onChange={e => setCpBase(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="08001"
              className={inputClass}
              required
              autoComplete="postal-code"
            />
            <p className="text-xs text-stone-400 mt-1 min-h-[1.25rem]">
              {cpBase.length === 5 && cpChecking && t('signup.fields.postcodeChecking')}
              {cpBase.length === 5 && !cpChecking && cpInfo && (
                <span className="text-stone-600">
                  ✓ {cpInfo.city}, {cpInfo.province}
                </span>
              )}
              {cpBase.length === 5 && !cpChecking && !cpInfo && (
                <span className="text-red-600">{t('signup.fields.postcodeNotFound')}</span>
              )}
            </p>
          </Field>
          <Field label={t('signup.fields.radius')} htmlFor="prot-radio">
            <input
              id="prot-radio"
              type="number"
              min={5}
              max={100}
              step={5}
              value={radioKm}
              onChange={e => setRadioKm(Number(e.target.value) || 25)}
              className={inputClass}
              required
            />
            <p className="text-xs text-stone-400 mt-1">{t('signup.fields.radiusHint')}</p>
          </Field>
        </div>

        <fieldset className="space-y-2 pt-2">
          <legend className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">
            {t('signup.optIns.legend')}
          </legend>
          <Toggle label={t('signup.optIns.lost')} checked={optInPerdidos} onChange={setOptInPerdidos} />
          <Toggle label={t('signup.optIns.found')} checked={optInEncontrados} onChange={setOptInEncontrados} />
          <Toggle label={t('signup.optIns.overflow')} checked={optInOverflow} onChange={setOptInOverflow} />
          <Toggle label={t('signup.optIns.digest')} checked={digestDiario} onChange={setDigestDiario} />
        </fieldset>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t(error)}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold py-4 rounded-2xl transition-colors text-base"
        >
          {submitting ? t('signup.submitting') : t('signup.submit')}
        </button>

        <p className="text-xs text-stone-400 leading-relaxed">
          <Trans t={t} i18nKey="signup.consent" components={{ privacyLink: <a href="/privacidad" className="underline" /> }} />
        </p>
      </form>
    </PublicShell>
  );
}

// Devuelve la clave de traducción del error (namespace `shelters`).
function mapError(code?: string): string {
  switch (code) {
    case 'invalid_nombre': return 'signup.errors.invalidName';
    case 'invalid_email': return 'signup.errors.invalidEmail';
    case 'invalid_cp': return 'signup.errors.invalidPostcode';
    case 'invalid_radio': return 'signup.errors.invalidRadius';
    case 'no_opt_in': return 'signup.errors.noOptIn';
    default: return 'signup.errors.generic';
  }
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-2xl mx-auto p-6">
        <a href="/" className="inline-block mb-6">
          <span className="text-2xl font-extrabold text-stone-900">Pet</span>
          <span className="text-2xl font-extrabold text-orange-600">Panic</span>
        </a>
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-bold uppercase tracking-wider text-stone-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
      />
      <span className="text-sm text-stone-700 leading-snug">{label}</span>
    </label>
  );
}

const inputClass =
  'w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-shadow';

function Feat({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon aria-hidden className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
