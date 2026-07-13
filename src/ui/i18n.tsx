import { createContext, useContext, type ReactNode } from "react";

export type AppLocale = "zh" | "en";
export const LOCALE_STORAGE_KEY = "lightraw.workspace.locale";

interface I18nValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (zh: string, en: string) => string;
}

const I18nContext = createContext<I18nValue>({ locale: "zh", setLocale: () => undefined, t: (zh) => zh });

export function I18nProvider({ locale, setLocale, children }: Pick<I18nValue, "locale" | "setLocale"> & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, setLocale, t: (zh, en) => translate(locale, zh, en) }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function normalizeLocale(value: string | null): AppLocale {
  return value === "en" ? "en" : "zh";
}

export function translate(locale: AppLocale, zh: string, en: string): string {
  return locale === "en" ? en : zh;
}
