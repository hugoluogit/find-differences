import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Localization from 'expo-localization';

import en from './en.json';
import zh from './zh.json';
import zhTW from './zh-TW.json';

export type Locale = 'en' | 'zh' | 'zh-TW';

const STORAGE_FILE = FileSystem.documentDirectory + 'app-locale.json';

const translations: Record<Locale, Record<string, string>> = { en, zh, 'zh-TW': zhTW };

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function loadLocale(): Promise<Locale | null> {
  try {
    const data = await FileSystem.readAsStringAsync(STORAGE_FILE);
    const parsed: Locale = JSON.parse(data);
    if (parsed in translations) return parsed;
  } catch {}
  return null;
}

async function saveLocale(locale: Locale): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(locale));
  } catch {}
}

function detectLocale(): Locale {
  try {
    const locales = Localization.getLocales();
    const primary = locales[0]?.languageCode;
    if (primary === 'zh') {
      const region = locales[0]?.regionCode;
      return region === 'TW' || region === 'HK' ? 'zh-TW' : 'zh';
    }
  } catch {}
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    loadLocale().then((stored) => {
      if (stored) setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    await saveLocale(l);
  }, []);

  const t = useCallback(
    (key: string) => translations[locale]?.[key] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
