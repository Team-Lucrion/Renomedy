import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { type AppLanguage, getInitialLanguage, initializeI18n, persistLanguage } from "../localization/i18n";

type LanguageContextValue = {
  language: AppLanguage;
  isReady: boolean;
  hasExplicitLanguagePreference: boolean;
  setAppLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [isReady, setIsReady] = useState(false);
  const [hasExplicitLanguagePreference, setHasExplicitLanguagePreference] = useState(false);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      const initial = await getInitialLanguage();
      await initializeI18n(initial.language);
      if (!active) {
        return;
      }
      setLanguage(initial.language);
      setHasExplicitLanguagePreference(initial.hasExplicitPreference);
      setIsReady(true);
    };

    void boot();

    return () => {
      active = false;
    };
  }, []);

  const setAppLanguage = async (nextLanguage: AppLanguage) => {
    await persistLanguage(nextLanguage);
    await initializeI18n(nextLanguage);
    setLanguage(nextLanguage);
    setHasExplicitLanguagePreference(true);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isReady,
      hasExplicitLanguagePreference,
      setAppLanguage,
    }),
    [hasExplicitLanguagePreference, isReady, language]
  );

  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }
  return context;
}
