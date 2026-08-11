import { createContext, useContext, useEffect, useState } from "react";
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
  // English first, on the server and in the browser alike, so the first client
  // render matches the prerendered HTML byte for byte and React keeps the tree
  // it hydrated. Running detectLanguage in the useState initialiser instead put
  // a Chinese first render against English markup for any visitor on a zh
  // browser, which React resolves by throwing the hydrated tree away. That was
  // invisible while no public page was translated. The owner header is, now.
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const detected = detectLanguage();
    if (detected !== "en") setLang(detected);
  }, []);

  // Screen readers switch voice on this, and Chrome stops offering to translate
  // a page that is already in the language it would translate to.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);

  function setLanguage(l) {
    setLang(l);
    try {
      window.localStorage.setItem("lazybee_lang", l);
    } catch {
      // not worth breaking the page over
    }
  }

  // A route-level default, for pages whose audience is not the site's audience.
  // The staff room desk is read by a Chinese rental aggregator, so it opens in
  // Chinese while the marketing site keeps its English default.
  //
  // Deliberately not persisted, and deliberately skipped when the visitor has
  // already chosen: a real choice outranks a route's opinion, and because
  // nothing is written, leaving the desk does not turn the rest of the site
  // Chinese behind you.
  function preferLanguage(l) {
    try {
      if (window.localStorage.getItem("lazybee_lang")) return;
    } catch {
      // storage disabled, so there is no stored choice to respect
    }
    setLang(l);
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
    <LanguageContext.Provider value={{ lang, setLanguage, preferLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
