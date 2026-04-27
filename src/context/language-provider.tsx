'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import enTranslations from '@/locales/en.json';

// Define the shape of your translations
export type Translations = typeof enTranslations;
export type TranslationKey = keyof Translations;
export type Locale = 
  | 'en' | 'yo' | 'ig' | 'ha' | 'pidgin' | 'sw' | 'zu' | 'fr' | 'ar'
  | 'en-US' | 'am' | 'af' | 'pt' | 'es' | 'zh' | 'hi' | 'de' | 'tr' 
  | 'id' | 'no' | 'sv' | 'fi' | 'it' | 'ga' | 'xh' | 'rw' | 'so' 
  | 'ti' | 'sn' | 'st' | 'tn' | 'lg' | 'ny' | 'wo' | 'bm';

export const supportedLanguages: { code: Locale; name: string; icon: string }[] = [
    { code: 'en', name: 'English (British)', icon: '🇬🇧' },
    { code: 'yo', name: 'Yorùbá', icon: '🇳🇬' },
    { code: 'ig', name: 'Igbo', icon: '🇳🇬' },
    { code: 'ha', name: 'Hausa', icon: '🇳🇬' },
    { code: 'pidgin', name: 'Nigerian Pidgin', icon: '🇳🇬' },
    { code: 'sw', name: 'Swahili', icon: '🇹🇿' },
    { code: 'zu', name: 'Zulu', icon: '🇿🇦' },
    { code: 'fr', name: 'Français', icon: '🇫🇷' },
    { code: 'ar', name: 'العربية', icon: '🇸🇦' },
    { code: 'en-US', name: 'American English', icon: '🇺🇸' },
    { code: 'am', name: 'Amharic', icon: '🇪🇹' },
    { code: 'af', name: 'Afrikaans', icon: '🇿🇦' },
    { code: 'pt', name: 'Portuguese', icon: '🇧🇷' },
    { code: 'es', name: 'Spanish', icon: '🇪🇸' },
    { code: 'zh', name: 'Chinese Simplified', icon: '🇨🇳' },
    { code: 'hi', name: 'Hindi', icon: '🇮🇳' },
    { code: 'de', name: 'German', icon: '🇩🇪' },
    { code: 'tr', name: 'Turkish', icon: '🇹🇷' },
    { code: 'id', name: 'Indonesian', icon: '🇮🇩' },
    { code: 'no', name: 'Norwegian', icon: '🇳🇴' },
    { code: 'sv', name: 'Swedish', icon: '🇸🇪' },
    { code: 'fi', name: 'Finnish', icon: '🇫🇮' },
    { code: 'it', name: 'Italian', icon: '🇮🇹' },
    { code: 'ga', name: 'Irish', icon: '🇮🇪' },
    { code: 'xh', name: 'Xhosa', icon: '🇿🇦' },
    { code: 'rw', name: 'Kinyarwanda', icon: '🇷🇼' },
    { code: 'so', name: 'Somali', icon: '🇸🇴' },
    { code: 'ti', name: 'Tigrinya', icon: '🇪🇷' },
    { code: 'sn', name: 'Shona', icon: '🇿🇼' },
    { code: 'st', name: 'Sesotho', icon: '🇱🇸' },
    { code: 'tn', name: 'Setswana', icon: '🇧🇼' },
    { code: 'lg', name: 'Luganda', icon: '🇺🇬' },
    { code: 'ny', name: 'Chichewa', icon: '🇲🇼' },
    { code: 'wo', name: 'Wolof', icon: '🇸🇳' },
    { code: 'bm', name: 'Bambara', icon: '🇲🇱' },
];


interface LanguageContextType {
  locale: Locale;
  translations: Translations;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, options?: { [key: string]: string | number }) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const loadLocaleData = async (locale: Locale): Promise<Translations> => {
    const localeModule = await import(`@/locales/${locale}.json`);
    return localeModule.default;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [translations, setTranslations] = useState<Translations>(enTranslations);
  const [isMounted, setIsMounted] = useState(false);

  const setLocale = useCallback(async (newLocale: Locale) => {
    try {
        const newTranslations = await loadLocaleData(newLocale);
        setTranslations(newTranslations);
        setLocaleState(newLocale);
        localStorage.setItem('dacosta-locale', newLocale);

        if (newLocale === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
        }
    } catch (error) {
        console.error(`Could not load locale: ${newLocale}`, error);
        // Fallback to English if the desired locale fails to load.
        // This is a safer way to handle the fallback without recursion.
        try {
            const englishTranslations = await loadLocaleData('en');
            setTranslations(englishTranslations);
            setLocaleState('en');
            localStorage.setItem('dacosta-locale', 'en');
            document.documentElement.setAttribute('dir', 'ltr');
        } catch (fallbackError) {
            console.error('Could not load fallback English locale!', fallbackError);
        }
    }
  }, []);
  
  useEffect(() => {
    setIsMounted(true);
    const savedLocale = localStorage.getItem('dacosta-locale') as Locale;
    if (savedLocale && supportedLanguages.some(l => l.code === savedLocale)) {
      setLocale(savedLocale);
    }
  }, [setLocale]);
  
  const t = useCallback((key: TranslationKey, options?: { [key: string]: string | number }): string => {
    let translation: any = translations[key] || enTranslations[key] || key;
    
    if (typeof translation !== 'string') {
        return key;
    }

    if (options) {
      Object.keys(options).forEach((k) => {
        translation = translation.replace(new RegExp(`{{${k}}}`, 'g'), String(options[k]));
      });
    }
    return translation;
  }, [translations]);
  
  const value = { locale, translations, setLocale, t };

  // The provider must always be present to avoid context errors.
  // The content's visibility is toggled to prevent hydration mismatches
  // from server-rendered content (always 'en') and client-rendered content
  // which might use a different locale from localStorage.
  return (
    <LanguageContext.Provider value={value}>
      <div>{isMounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}</div>
    </LanguageContext.Provider>
  );
}

