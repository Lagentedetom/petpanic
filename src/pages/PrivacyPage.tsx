import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

// Fecha de la última revisión de la política (auditoría legal del 19-10-2026).
const LAST_UPDATED = new Date(2026, 9, 19);

// Secciones con lista: [sección, elementos de la lista]
const DATA_ITEMS = ['account', 'pets', 'location', 'usage'] as const;
const PURPOSE_ITEMS = ['account', 'lostPets', 'zones', 'push', 'messages'] as const;
const LEGAL_BASIS_ITEMS = ['consent', 'contract', 'legitimateInterest'] as const;
const RIGHTS_ITEMS = ['access', 'rectification', 'erasure', 'portability', 'objection', 'restriction'] as const;
const SECTIONS_AFTER_RIGHTS = ['security', 'storage', 'minors', 'authority'] as const;

export default function PrivacyPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('legal');
  const updated = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(LAST_UPDATED);
  const rich = (key: string) => <Trans t={t} i18nKey={key} components={{ strong: <strong /> }} />;
  const list = (section: string, items: readonly string[]) => (
    <ul className="list-disc pl-5 space-y-1">
      {items.map(item => (
        <li key={item}>{rich(`privacy.${section}.items.${item}`)}</li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-stone-100 p-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-10 space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} aria-label={t('common:actions.back')} className="p-3 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <ChevronLeft aria-hidden="true" className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('privacy.title')}</h1>
        </div>

        <p className="text-xs text-stone-400">{t('updated', { date: updated })}</p>

        <div className="prose prose-stone prose-sm max-w-none space-y-4 text-stone-600 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-stone-900">{t('privacy.controller.title')}</h2>
          <p>{rich('privacy.controller.body')}</p>

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.data.title')}</h2>
          <p>{t('privacy.data.intro')}</p>
          {list('data', DATA_ITEMS)}

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.purpose.title')}</h2>
          <p>{t('privacy.purpose.intro')}</p>
          {list('purpose', PURPOSE_ITEMS)}

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.legalBasis.title')}</h2>
          <p>{t('privacy.legalBasis.intro')}</p>
          {list('legalBasis', LEGAL_BASIS_ITEMS)}

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.location.title')}</h2>
          <p>{rich('privacy.location.body')}</p>

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.sharing.title')}</h2>
          <p>{rich('privacy.sharing.body')}</p>

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.retention.title')}</h2>
          <p>{rich('privacy.retention.body')}</p>

          <h2 className="text-lg font-bold text-stone-900">{t('privacy.rights.title')}</h2>
          <p>{t('privacy.rights.intro')}</p>
          {list('rights', RIGHTS_ITEMS)}
          <p>{rich('privacy.rights.outro')}</p>

          {SECTIONS_AFTER_RIGHTS.map(s => (
            <Section key={s} title={t(`privacy.${s}.title`)}>{rich(`privacy.${s}.body`)}</Section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-lg font-bold text-stone-900">{title}</h2>
      <p>{children}</p>
    </>
  );
}
