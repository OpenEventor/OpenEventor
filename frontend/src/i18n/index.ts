/**
 * i18n setup (react-i18next).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW LANGUAGE
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Create `src/i18n/locales/<xx>.json` (copy `en.json`, translate the values —
 *    keep the SAME set of keys as en.json).
 * 2. Import it below and add ONE line to the `resources` map:
 *       import xx from './locales/xx.json';
 *       resources: { ..., xx: { translation: xx } }
 * 3. Add `'<xx>'` to `supportedLngs`.
 * 4. Add an option to the language switcher (see `LanguageRadioGroup` in
 *    `src/components/AppBar/AppBar.tsx`).
 * That's it — no other code changes are required.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Detection: on first visit the user's browser language is auto-detected; a
 * manual choice is persisted to localStorage and wins on subsequent visits.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false, // React already escapes values against XSS.
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
