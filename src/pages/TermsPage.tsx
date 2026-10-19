import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

// Fecha de la última revisión de los términos (auditoría legal del 19-10-2026).
const LAST_UPDATED = new Date(2026, 9, 19);

const SECTIONS = ['owner', 'acceptance', 'service', 'account'] as const;
const SECTIONS_AFTER_USE = ['location', 'content', 'liability', 'changes', 'law', 'contact'] as const;
const ACCEPTABLE_USE_ITEMS = ['noFakeAlerts', 'noHarassment', 'noOffensiveContent', 'truthfulInfo', 'noUnauthorizedAccess'] as const;

export default function TermsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('legal');
  const updated = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(LAST_UPDATED);
  const rich = (key: string) => <Trans t={t} i18nKey={key} components={{ strong: <strong /> }} />;

  return (
    <div className="min-h-screen bg-stone-100 p-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-10 space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} aria-label={t('common:actions.back')} className="p-3 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <ChevronLeft aria-hidden="true" className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('terms.title')}</h1>
        </div>

        <p className="text-xs text-stone-400">{t('updated', { date: updated })}</p>

        <div className="prose prose-stone prose-sm max-w-none space-y-4 text-stone-600 text-sm leading-relaxed">
          {SECTIONS.map(s => (
            <Section key={s} title={t(`terms.${s}.title`)}>{rich(`terms.${s}.body`)}</Section>
          ))}

          <h2 className="text-lg font-bold text-stone-900">{t('terms.acceptableUse.title')}</h2>
          <p>{t('terms.acceptableUse.intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            {ACCEPTABLE_USE_ITEMS.map(item => (
              <li key={item}>{t(`terms.acceptableUse.items.${item}`)}</li>
            ))}
          </ul>

          {SECTIONS_AFTER_USE.map(s => (
            <Section key={s} title={t(`terms.${s}.title`)}>{rich(`terms.${s}.body`)}</Section>
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
