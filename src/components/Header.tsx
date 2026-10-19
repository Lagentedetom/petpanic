import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';

export default function Header() {
  const { t } = useTranslation('common');
  const { logOut } = useApp();

  return (
    <header
      className="bg-stone-50/95 backdrop-blur border-b border-stone-200 sticky top-0 z-30 px-5 pb-3 flex items-center justify-between"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2">
        <img src="/petpanic-logo.svg" alt="" className="w-7 h-7" />
        <span className="font-display text-xl font-extrabold tracking-tight text-stone-900">{t('brand')}</span>
      </div>
      <button onClick={logOut} aria-label={t('nav.logout')} className="p-3 text-stone-500 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 rounded-xl">
        <LogOut className="w-6 h-6" />
      </button>
    </header>
  );
}
