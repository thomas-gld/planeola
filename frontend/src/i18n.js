import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/fr';
import 'dayjs/locale/ru';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ru: { translation: ru },
};

// browser language if supported, else English
function detectLanguage() {
  const code = navigator.language?.toLowerCase().split('-')[0];
  return code in resources ? code : 'en';
}

// before react-i18next's own listener, so a re-render sees the new dayjs locale
function applyLanguage(lng) {
  document.documentElement.lang = lng;
  dayjs.locale(lng);
}

i18n.on('languageChanged', applyLanguage);

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
