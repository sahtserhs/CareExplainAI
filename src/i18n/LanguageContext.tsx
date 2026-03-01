import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTranslation } from './translations';

type LanguageContextType = {
  appLanguage: string;
  setAppLanguage: (lang: string) => void;
  aiLanguage: string;
  setAiLanguage: (lang: string) => void;
  sameAsApp: boolean;
  setSameAsApp: (same: boolean) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [appLanguage, setAppLanguageState] = useState<string>('English');
  const [aiLanguage, setAiLanguageState] = useState<string>('English');
  const [sameAsApp, setSameAsApp] = useState<boolean>(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedAppLang = localStorage.getItem('appLanguage');
    const savedAiLang = localStorage.getItem('aiLanguage');
    const savedSame = localStorage.getItem('sameAsApp');

    if (savedAppLang) setAppLanguageState(savedAppLang);
    if (savedAiLang) setAiLanguageState(savedAiLang);
    if (savedSame !== null) setSameAsApp(savedSame === 'true');
  }, []);

  const setAppLanguage = (lang: string) => {
    setAppLanguageState(lang);
    localStorage.setItem('appLanguage', lang);
    if (sameAsApp) {
      setAiLanguageState(lang);
      localStorage.setItem('aiLanguage', lang);
    }
  };

  const setAiLanguage = (lang: string) => {
    setAiLanguageState(lang);
    localStorage.setItem('aiLanguage', lang);
  };

  const handleSetSameAsApp = (same: boolean) => {
    setSameAsApp(same);
    localStorage.setItem('sameAsApp', same.toString());
    if (same) {
      setAiLanguageState(appLanguage);
      localStorage.setItem('aiLanguage', appLanguage);
    }
  };

  const t = (key: string) => getTranslation(appLanguage, key);
  const dir = appLanguage === 'Arabic' ? 'rtl' : 'ltr';

  // Apply RTL to document body
  useEffect(() => {
    document.documentElement.dir = dir;
  }, [dir]);

  return (
    <LanguageContext.Provider value={{
      appLanguage, setAppLanguage,
      aiLanguage, setAiLanguage,
      sameAsApp, setSameAsApp: handleSetSameAsApp,
      t, dir
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
