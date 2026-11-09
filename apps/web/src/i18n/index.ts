import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
const files = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<
  string,
  Record<string, string>
>;
const resources: Record<string, Record<string, Record<string, string>>> = {};
for (const [path, value] of Object.entries(files)) {
  const [, lang, namespace] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)!;
  (resources[lang] ??= {})[namespace] = value;
}
let saved: string | null = null;
try {
  saved = localStorage.getItem('highlords.language');
} catch {
  /* optional storage */
}
const detected = navigator.languages.find(
  (l) => l.toLowerCase().startsWith('en') || l.toLowerCase().startsWith('pt'),
);
void i18n.use(initReactI18next).init({
  resources,
  lng: saved === 'en' || saved === 'pt-BR' ? saved : detected?.startsWith('en') ? 'en' : 'pt-BR',
  fallbackLng: 'pt-BR',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem('highlords.language', lng);
  } catch {
    /* optional */
  }
});
document.documentElement.lang = i18n.language;
export default i18n;
