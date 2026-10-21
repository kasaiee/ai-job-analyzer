import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {readStoredSettings, SETTINGS_CHANGED_EVENT} from '../utils/settings';
import {translations} from '../i18n/translations';
import {formatDate as formatDateValue, formatDateTime as formatDateTimeValue, getDateTimePreferences} from '../utils/dateTime';

const LanguageContext = createContext(null);

export const LanguageProvider = ({children}) => {
  const [settings, setSettings] = useState(() => readStoredSettings());
  const language = settings.language === 'fa' ? 'fa' : 'en';

  useEffect(() => {
    const updateSettings = () => setSettings(readStoredSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, updateSettings);
    window.addEventListener('storage', updateSettings);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, updateSettings);
      window.removeEventListener('storage', updateSettings);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const theme = settings.theme || 'system';
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  const value = useMemo(() => {
    const t = (key, variables = {}) => {
      const template = translations[language][key] ?? translations.en[key] ?? key;
      return Object.entries(variables).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
        template,
      );
    };
    const dateTimePreferences = getDateTimePreferences(settings);
    const formatDate = date => formatDateValue(date, {language, ...dateTimePreferences});
    const formatDateTime = date => formatDateTimeValue(date, {language, ...dateTimePreferences});
    return {language, dir: language === 'fa' ? 'rtl' : 'ltr', t, formatDate, formatDateTime, ...dateTimePreferences};
  }, [language, settings]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
