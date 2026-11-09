import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  translations,
} from "../i18n/translations";

const LanguageContext = createContext(null);

const isSupported = (code) => LANGUAGES.some((language) => language.code === code);

const readStored = () => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isSupported(stored)) return stored;
  } catch {
    /* localStorage can be unavailable */
  }
  return DEFAULT_LANGUAGE;
};

const resolve = (dictionary, path) => {
  return path.split(".").reduce((row, part) => (row && row[part] !== undefined ? row[part] : undefined), dictionary);
};

const interpolate = (value, vars) => {
  if (typeof value !== "string" || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match
  );
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStored);

  const setLanguage = useCallback((code) => {
    const next = isSupported(code) ? code : DEFAULT_LANGUAGE;
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const meta = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0];
    document.documentElement.lang = meta.code;
    document.documentElement.setAttribute("data-lang", meta.code);
  }, [language]);

  const t = useCallback(
    (path, vars) => {
      const current = translations[language];
      const fallback = translations[DEFAULT_LANGUAGE];
      const value = resolve(current, path) ?? resolve(fallback, path) ?? path;
      return interpolate(value, vars);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: LANGUAGES,
      current: LANGUAGES.find((item) => item.code === language) || LANGUAGES[0],
      isEnglish: language === DEFAULT_LANGUAGE,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}

/** Short alias used across the public site. */
export const useT = () => useI18n().t;

export default LanguageContext;
