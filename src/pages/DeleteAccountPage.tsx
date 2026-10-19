// Página pública para pedir que se borre una cuenta. Google Play exige un
// enlace web así en el formulario de seguridad de los datos, para quien ya no
// tiene la app instalada. URL: https://app.petpanic.es/eliminar-cuenta
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

const EMAIL = 'hola@petpanic.es';

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('deleteAccount');
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(t('email.subject'))}&body=${encodeURIComponent(t('email.body'))}`;

  return (
    <div className="min-h-screen bg-stone-50 p-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-stone-200 p-8 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} aria-label={t('common:actions.back')} className="p-3 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600">
            <ChevronLeft aria-hidden="true" className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        </div>

        <p className="text-stone-600">{t('intro')}</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t('inApp.title')}</h2>
          <ol className="list-decimal pl-5 space-y-1 text-stone-700">
            <li>{t('inApp.step1')}</li>
            <li>{t('inApp.step2')}</li>
            <li>{t('inApp.step3')}</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t('byEmail.title')}</h2>
          <p className="text-stone-700">
            <Trans t={t} i18nKey="byEmail.body" values={{ email: EMAIL }} components={{ a: <a href={mailto} className="text-orange-700 font-semibold underline" /> }} />
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t('what.title')}</h2>
          <p className="text-stone-700">{t('what.deleted')}</p>
          <p className="text-stone-700">{t('what.kept')}</p>
        </section>
      </div>
    </div>
  );
}
