import AsyncStorage from "@react-native-async-storage/async-storage";
import { translateText, type AppLanguage } from "@stc-foundit/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (value: string) => string;
};

const LANGUAGE_KEY = "stc-foundit-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setCurrentLanguage] = useState<AppLanguage>("en");

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (alive && (saved === "en" || saved === "ar")) setCurrentLanguage(saved);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setCurrentLanguage(next);
    void AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => undefined);
  }, []);
  const t = useCallback((value: string) => translateText(value, language), [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
