"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type SiteLanguage = "fr" | "en";

const STORAGE_KEY = "riftbound-site-language";
const CHANGE_EVENT = "riftbound:language-change";
const fallback = { language: "fr" as SiteLanguage, setLanguage: (_language: SiteLanguage) => {} };
const SiteLanguageContext = createContext(fallback);

function readLanguage(): SiteLanguage {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fr";
}

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<SiteLanguage>(
    (listener) => { window.addEventListener(CHANGE_EVENT, listener); return () => window.removeEventListener(CHANGE_EVENT, listener); },
    readLanguage,
    () => "fr",
  );
  const setLanguage = useCallback((next: SiteLanguage) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <SiteLanguageContext.Provider value={{ language, setLanguage }}>{children}</SiteLanguageContext.Provider>;
}

export function useSiteLanguage() {
  return useContext(SiteLanguageContext);
}
