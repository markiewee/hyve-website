import { createContext, useContext, useState } from "react";
import en from "./en.json";
import zh from "./zh.json";

const translations = { en, zh };
const LanguageContext = createContext();

function detectLanguage() {
  const saved = localStorage.getItem("hyve_lang");
  if (saved) return saved;
  // Auto-detect from browser
  const browserLang = navigator.language || navigator.userLanguage || "";
  if (browserLang.startsWith("zh")) return "zh";
  return "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLanguage);

  function setLanguage(l) {
    setLang(l);
    localStorage.setItem("hyve_lang", l);
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
