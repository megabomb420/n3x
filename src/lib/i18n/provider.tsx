import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readPref, writePref } from "@/lib/prefs";
import { LANGS, STRINGS, type Lang, type StringKey } from "./dictionary";

const LANG_KEY = "n3x.lang";

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
} | null>(null);

function isLang(value: string | null): value is Lang {
  return value === "en" || value === "pl";
}

/** Polish for a device that asks for it, English otherwise. */
function deviceLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.toLowerCase().startsWith("pl") ? "pl" : "en";
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Rendered on the server too, so the first paint uses English and the saved
  // choice lands after mount (the whole app is client-fetched anyway).
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = readPref(LANG_KEY);
    const next = isLang(saved) ? saved : deviceLang();
    writePref(LANG_KEY, next);
    setLangState(next);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    writePref(LANG_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: StringKey, params?: Record<string, string | number>) =>
      interpolate(STRINGS[lang][key] ?? STRINGS.en[key] ?? key, params),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Inside the provider: the chosen language and its strings. */
export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
}

export function useT() {
  return useI18n().t;
}

/** Club roles, in the language the interface is using. */
export function useRoleLabel() {
  const t = useT();
  return (role: string | null | undefined): string => {
    if (role === "president") return t("role.president");
    if (role === "vicePresident") return t("role.vicePresident");
    if (role === "senior") return t("role.senior");
    if (role === "member") return t("role.member");
    return role ?? t("role.member");
  };
}

export { LANGS };
export type { Lang, StringKey };
