// Idiomas de la app: castellano (por defecto), catalán e inglés.
//
// Cada pantalla tiene su «namespace»: un JSON por idioma en
// src/i18n/locales/<idioma>/<namespace>.json. Para añadir un idioma basta con
// copiar la carpeta `es`, traducir los JSON y añadir el código a LANGUAGES.
//
// Uso en un componente:
//   const { t } = useTranslation('auth');
//   t('login.title')            → texto del namespace 'auth'
//   t('common:actions.save')    → texto de otro namespace
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = ['es', 'ca', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAMES: Record<Language, string> = { es: 'Castellano', ca: 'Català', en: 'English' };

const STORAGE_KEY = 'pp_lang';

// Carga todos los JSON en el paquete: son pocos y pequeños, y así la app
// funciona igual sin conexión dentro de Capacitor.
const files = import.meta.glob('./locales/*/*.json', { eager: true }) as Record<string, { default: Record<string, unknown> }>;
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, mod] of Object.entries(files)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lang, ns] = match;
  (resources[lang] ??= {})[ns] = mod.default;
}

function readStored(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return (LANGUAGES as readonly string[]).includes(value ?? '') ? (value as Language) : null;
  } catch {
    return null;
  }
}

/** Idioma del dispositivo: catalán si lo pide, castellano si es español, inglés para el resto. */
export function detectLanguage(): Language {
  const stored = readStored();
  if (stored) return stored;
  const wanted = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const tag of wanted) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'ca' || base === 'es' || base === 'en') return base;
    // Gallego, euskera y valenciano/aranés caen en castellano antes que en inglés
    if (base === 'gl' || base === 'eu' || base === 'oc') return 'es';
  }
  return 'en';
}

export function setLanguage(lang: Language) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* modo privado */ }
  void i18n.changeLanguage(lang);
}

i18n.on('languageChanged', (lang) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
});

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: Object.keys(resources.es ?? { common: {} }),
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
