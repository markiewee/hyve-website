import { createContext, useContext, useState } from "react";
import en from "./en.json";
import zh from "./zh.json";

const translations = { en, zh };
const LanguageContext = createContext();

function detectLanguage() {
  // The prerender step renders these pages in Node, where there is no localStorage
  // and no navigator. English is the right default there: it is what the static
  // HTML a crawler reads should be in, and the browser corrects it on first paint.
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem("lazybee_lang");
    if (saved) return saved;
  } catch {
    // private mode, or storage disabled
  }
  // Auto-detect from browser
  const browserLang = navigator.language || navigator.userLanguage || "";
  if (browserLang.startsWith("zh")) return "zh";
  return "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLanguage);

  function setLanguage(l) {
    setLang(l);
    try {
      window.localStorage.setItem("lazybee_lang", l);
    } catch {
      // not worth breaking the page over
    }
  }

  function t(key, params = {}) {
    const keys = key.split(".");
    let val = translations[lang];
    for (const k of keys) val = val?.[k];
    if (!val) val = key; // fallback to key
    // Replace {param} placeholders
    return String(val).replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
