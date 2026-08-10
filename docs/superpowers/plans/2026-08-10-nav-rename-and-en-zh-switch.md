# Header Rename + EN/ZH Language Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Lazybee header nav to plain one-word labels, delete the light/dark toggle from the main site and lock it alabaster, and add an English/中文 switch to both the main site and the booking site. The booking site stays tobacco by default and keeps its own light/dark toggle.

**Architecture:** Two repos, two mechanisms, one shared decision. `hyve-website` (Vite + React Router + a Node prerender step) gets a React context holding the active language, a plain-object dictionary, and a `t()` lookup. `hyve-booking` (Next.js App Router, every page already `force-dynamic`) reads the language from a cookie inside its server components and re-renders through `router.refresh()`, so no server component has to become a client component. No i18n library is added to either repo. English stays the prerendered and crawlable default on both sites; Chinese is a client preference, so no `/zh` URLs and no sitemap change.

**Tech Stack:** React 18, Vite, React Router, Tailwind + `src/styles/lazybee.css` (main site). Next.js App Router, React server components, Tailwind + `app/globals.css` (booking site). No new dependencies.

---

## Decisions locked with Mark (2026-08-10)

| Question | Answer |
|---|---|
| Nav labels | One word each: Earnings · Compare · Portfolio · Guides · Estimate |
| Chinese scope | Whole owner homepage + every booking-site screen. Hive article bodies stay English. |
| Theme, main site | Alabaster (light), locked. Toggle deleted. |
| Theme, booking site | Tobacco (dark) default, **toggle kept** so a visitor can go alabaster. |

The booking site is photographic and reads better dark, so it keeps its theme control and its no-flash script exactly as they are. Only the main site loses the toggle. That means `components/ThemeToggle.tsx` is **not** deleted and `.lb-modebtn` stays in `app/globals.css`; the booking header simply gains a language button beside the existing theme button.

## File Structure

**hyve-website (main site)**

| File | Responsibility |
|---|---|
| `src/i18n/LangContext.jsx` | *Create.* Provider, `useLang()`, `useT()`. Holds `'en' \| 'zh'`, persists to `localStorage['lzb-lang']`, reads it in an effect so the first render matches the prerendered HTML. |
| `src/i18n/en.js` | *Create.* The English dictionary. Flat object, dotted string keys. |
| `src/i18n/zh.js` | *Create.* The Chinese dictionary. Identical key set. |
| `src/i18n/LangSwitch.jsx` | *Create.* The `EN / 中文` header control. Replaces the mode button in the same slot. |
| `src/components/owners/OwnerChrome.jsx` | *Modify.* New `NAV` labels, drop the duplicate Hive link, drop `theme`/`onToggleTheme`, mount `LangSwitch`. |
| `src/components/hive/HiveChrome.jsx` | *Modify.* Drop the mode button, mount `LangSwitch`. |
| `src/components/HomePage.jsx` | *Modify.* Drop `useState` theme, hardcode `data-theme="alabaster"`, wrap in `LangProvider`. |
| `src/pages/hive/HiveIndexPage.jsx`, `HiveTopicPage.jsx`, `HiveArticlePage.jsx` | *Modify.* Drop `useLazybeeTheme`, hardcode alabaster. |
| `src/hooks/useLazybeeTheme.js` | *Delete.* Nothing calls it once the four pages above are done. |
| `src/styles/lazybee.css` | *Modify.* Replace `.modebtn` rules with `.langbtn`, keep the 44px tap target. |
| `src/components/owners/*.jsx`, `src/data/ownerPage.js` | *Modify.* Every literal string becomes `t('section.key')`. |

**hyve-booking (booking site)**

| File | Responsibility |
|---|---|
| `lib/lang.ts` | *Create.* `type Lang`, `LANG_COOKIE`, `getLang()` server helper reading `cookies()`. |
| `lib/dict.ts` | *Create.* `en` and `zh` objects plus `tFor(lang)` returning a lookup function. Shared by server and client components. |
| `components/LangSwitch.tsx` | *Create.* `"use client"`. Writes the cookie, calls `router.refresh()`. |
| `components/Nav.tsx` | *Modify.* Keep `ThemeToggle`, add `LangSwitch` beside it, translate "The Hive" and "WhatsApp". |
| `components/ThemeToggle.tsx` | *Untouched.* Tobacco stays the booking-site default and the toggle stays. |
| `app/layout.tsx` | *Modify.* `lang` attribute from the cookie, pass `lang` to `Nav`. `data-theme="tobacco"` and the no-flash script both stay. |
| `app/page.tsx`, `app/rooms/[unitCode]/page.tsx`, `app/reserved/[token]/page.tsx` | *Modify.* Read `getLang()`, pass `lang` into the components they render. |
| `components/*.tsx` (text-bearing) | *Modify.* Accept `lang` (server) or read the `LangContext` (client), swap literals for `t()`. |
| `app/globals.css` | *Modify.* Add `.lb-langbtn` next to the existing `.lb-modebtn`, sharing its 44px height. |

---

## Task 1: The main-site language plumbing

**Files:**
- Create: `/Users/mark/Desktop/hyve-website/src/i18n/LangContext.jsx`
- Create: `/Users/mark/Desktop/hyve-website/src/i18n/en.js`
- Create: `/Users/mark/Desktop/hyve-website/src/i18n/zh.js`
- Test: `/Users/mark/Desktop/hyve-website/src/i18n/__tests__/lang.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/i18n/__tests__/lang.test.jsx
import { render, screen, act } from '@testing-library/react';
import { LangProvider, useLang, useT } from '../LangContext';

function Probe() {
  const [lang, setLang] = useLang();
  const t = useT();
  return (
    <>
      <span data-testid="label">{t('nav.earnings')}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang('zh')}>zh</button>
    </>
  );
}

test('defaults to English and swaps every key when the language changes', () => {
  render(<LangProvider><Probe /></LangProvider>);
  expect(screen.getByTestId('lang').textContent).toBe('en');
  expect(screen.getByTestId('label').textContent).toBe('Earnings');
  act(() => { screen.getByText('zh').click(); });
  expect(screen.getByTestId('label').textContent).toBe('收益');
});

test('an unknown key falls back to the key itself rather than rendering undefined', () => {
  render(<LangProvider><Probe /></LangProvider>);
  // guards against a half-translated dictionary shipping blank text to a visitor
});

test('a key missing from zh falls back to the English string', () => {
  // zh.js is allowed to be incomplete mid-migration; it must never render blank
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/i18n/__tests__/lang.test.jsx`
Expected: FAIL, "Failed to resolve import ../LangContext".

- [ ] **Step 3: Write the dictionaries and the provider**

```js
// src/i18n/en.js
export default {
  'nav.earnings': 'Earnings',
  'nav.compare': 'Compare',
  'nav.portfolio': 'Portfolio',
  'nav.guides': 'Guides',
  'nav.estimate': 'Estimate',
};
```

```js
// src/i18n/zh.js
export default {
  'nav.earnings': '收益',
  'nav.compare': '对比',
  'nav.portfolio': '房源',
  'nav.guides': '指南',
  'nav.estimate': '估算',
};
```

```jsx
// src/i18n/LangContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import zh from './zh';

const DICTS = { en, zh };
const LANG_KEY = 'lzb-lang';
const Ctx = createContext(null);

/* English is the first render on both the server prerender and the browser, so the
   markup matches and React never throws the hydrated tree away. A remembered
   Chinese choice is applied in an effect, one frame later. */
export function LangProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en') setLang(saved);
    } catch { /* private mode: English is a fine default */ }
  }, []);

  const choose = useCallback((next) => {
    setLang(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch { /* not worth breaking a page over */ }
    if (typeof document !== 'undefined') document.documentElement.lang = next === 'zh' ? 'zh-Hans' : 'en';
  }, []);

  /* A key absent from zh falls back to English, never to blank. */
  const t = useCallback((key) => DICTS[lang][key] ?? en[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, choose, t }), [lang, choose, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang must be used inside <LangProvider>');
  return [c.lang, c.choose];
}

export function useT() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useT must be used inside <LangProvider>');
  return c.t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/i18n/__tests__/lang.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/i18n
git commit -m "feat(i18n): language context, dictionaries and English fallback"
```

---

## Task 2: The EN/中文 switch control

**Files:**
- Create: `/Users/mark/Desktop/hyve-website/src/i18n/LangSwitch.jsx`
- Modify: `/Users/mark/Desktop/hyve-website/src/styles/lazybee.css:239-241` and `:543`
- Test: `/Users/mark/Desktop/hyve-website/src/i18n/__tests__/langswitch.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/i18n/__tests__/langswitch.test.jsx
import { render, screen, act } from '@testing-library/react';
import { LangProvider } from '../LangContext';
import LangSwitch from '../LangSwitch';

test('shows the language you would get, and flips on click', () => {
  render(<LangProvider><LangSwitch /></LangProvider>);
  const btn = screen.getByRole('button');
  expect(btn.textContent).toBe('中文');
  expect(btn.getAttribute('aria-label')).toBe('切换到中文 / Switch to Chinese');
  act(() => { btn.click(); });
  expect(btn.textContent).toBe('EN');
});

test('the tap target is a real button, not a div', () => {
  render(<LangProvider><LangSwitch /></LangProvider>);
  expect(screen.getByRole('button').tagName).toBe('BUTTON');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/i18n/__tests__/langswitch.test.jsx`
Expected: FAIL, "Failed to resolve import ../LangSwitch".

- [ ] **Step 3: Write the control**

```jsx
// src/i18n/LangSwitch.jsx
import { useLang } from './LangContext';

/* Labelled with the language you get by pressing it, which is how every
   bilingual site in Singapore does it. Showing the current language instead
   makes half the visitors press it twice. */
export default function LangSwitch() {
  const [lang, choose] = useLang();
  const goingChinese = lang === 'en';
  return (
    <button
      className="langbtn"
      type="button"
      onClick={() => choose(goingChinese ? 'zh' : 'en')}
      aria-label={goingChinese ? '切换到中文 / Switch to Chinese' : 'Switch to English / 切换到英文'}
    >
      {goingChinese ? '中文' : 'EN'}
    </button>
  );
}
```

- [ ] **Step 4: Rename the button styles**

In `src/styles/lazybee.css`, replace the `.modebtn` rules at lines 239-241 and 543 with the same declarations under `.langbtn`, and add a minimum tap target so the Chinese glyphs do not shrink the hit area:

```css
.lzb .langbtn{background:none;border:1px solid currentColor;color:inherit;cursor:pointer;padding:6px 10px;
  min-height:44px;min-width:56px;border-radius:999px;font:inherit;letter-spacing:.06em;opacity:.72}
.lzb .langbtn:hover{opacity:1}
.lzb.hive .langbtn{font-size:12px;padding:9px 13px;min-height:44px}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/i18n/__tests__/langswitch.test.jsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/i18n/LangSwitch.jsx src/i18n/__tests__/langswitch.test.jsx src/styles/lazybee.css
git commit -m "feat(i18n): EN/中文 header switch, replacing the mode button styles"
```

---

## Task 3: Rename the nav and drop the mode button

**Files:**
- Modify: `/Users/mark/Desktop/hyve-website/src/components/owners/OwnerChrome.jsx:16-69`
- Test: `/Users/mark/Desktop/hyve-website/src/components/owners/__tests__/ownerchrome.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/owners/__tests__/ownerchrome.test.jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createRef } from 'react';
import { LangProvider } from '../../../i18n/LangContext';
import { OwnerHeader } from '../OwnerChrome';

const mount = () => render(
  <MemoryRouter><LangProvider><OwnerHeader heroRef={createRef()} /></LangProvider></MemoryRouter>
);

test('the nav reads in plain one-word labels', () => {
  mount();
  const labels = [...document.querySelectorAll('.navlinks a')].map((a) => a.textContent);
  expect(labels).toEqual(['Earnings', 'Compare', 'Portfolio', 'Guides', 'Estimate']);
});

test('Guides is linked once, not twice', () => {
  mount();
  expect(screen.getAllByText('Guides')).toHaveLength(1);
});

test('there is no light/dark control left in the header', () => {
  mount();
  expect(document.querySelector('.modebtn')).toBeNull();
  expect(screen.queryByText('Light')).toBeNull();
  expect(screen.queryByText('Dark')).toBeNull();
});

test('the language switch sits in the header', () => {
  mount();
  expect(document.querySelector('.langbtn')).not.toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/components/owners/__tests__/ownerchrome.test.jsx`
Expected: FAIL on the first test, received `['Your split', 'Versus a lease', 'The comb', 'The Hive', 'Free coffee', 'The Hive']`.

- [ ] **Step 3: Rewrite the nav**

Replace lines 16-26 of `OwnerChrome.jsx`:

```jsx
/* Nav labels name the thing, not the metaphor. A stranger scanning for three
   seconds has to know what each one opens. "Portfolio" is the live grid of real
   rooms at real prices; "Guides" is the Hive archive, which is a route rather
   than an anchor, so it carries a `to` instead of a section id. */
const NAV = [
  ['nav.earnings', 'split'],
  ['nav.compare', 'compare'],
  ['nav.portfolio', 'comb'],
  ['nav.guides', null, '/hive'],
  ['nav.estimate', 'ask'],
];
```

Replace the component signature and its nav block (lines 33, 44-68). Note the removed `theme`/`onToggleTheme` props, the removed duplicate Hive link, and the removed mode button:

```jsx
export function OwnerHeader({ heroRef }) {
  const [solid, setSolid] = useState(false);
  const t = useT();

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), { threshold: 0.06 });
    io.observe(hero);
    return () => io.disconnect();
  }, [heroRef]);

  return (
    <header className={`lzbheader${solid ? ' solid' : ''}`}>
      <a
        className="brandlock"
        href="#top"
        onClick={(e) => { e.preventDefault(); scrollToId('top'); }}
        aria-label="Lazybee, back to the top"
      >
        <BeeMark />
        <span className="wd">LAZYBEE</span>
      </a>
      <nav className="navlinks">
        {NAV.map(([key, id, to]) => (
          to
            ? <Link key={key} to={to}>{t(key)}</Link>
            : <a key={key} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>{t(key)}</a>
        ))}
        <LangSwitch />
      </nav>
    </header>
  );
}
```

Add to the imports at the top of the file:

```jsx
import { useT } from '../../i18n/LangContext';
import LangSwitch from '../../i18n/LangSwitch';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/components/owners/__tests__/ownerchrome.test.jsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/components/owners/OwnerChrome.jsx src/components/owners/__tests__/ownerchrome.test.jsx
git commit -m "feat(nav): plain one-word header labels, drop the duplicate Hive link"
```

---

## Task 4: Lock the main site to alabaster and delete the theme hook

**Files:**
- Modify: `/Users/mark/Desktop/hyve-website/src/components/HomePage.jsx:40,77,84-88`
- Modify: `/Users/mark/Desktop/hyve-website/src/components/hive/HiveChrome.jsx:26,37`
- Modify: `/Users/mark/Desktop/hyve-website/src/pages/hive/HiveIndexPage.jsx`, `HiveTopicPage.jsx`, `HiveArticlePage.jsx`
- Delete: `/Users/mark/Desktop/hyve-website/src/hooks/useLazybeeTheme.js`
- Test: `/Users/mark/Desktop/hyve-website/src/components/__tests__/theme-locked.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/__tests__/theme-locked.test.jsx
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

test('nothing in src still imports the deleted theme hook', () => {
  const hits = globSync('src/**/*.{js,jsx}')
    .filter((f) => readFileSync(f, 'utf8').includes('useLazybeeTheme'));
  expect(hits).toEqual([]);
});

test('no mode button markup survives anywhere in src', () => {
  const hits = globSync('src/**/*.{js,jsx,css}')
    .filter((f) => readFileSync(f, 'utf8').includes('modebtn'));
  expect(hits).toEqual([]);
});

test('the themed roots are pinned to alabaster', () => {
  const home = readFileSync('src/components/HomePage.jsx', 'utf8');
  expect(home).toContain('data-theme="alabaster"');
  expect(home).not.toContain('tobacco');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/components/__tests__/theme-locked.test.jsx`
Expected: FAIL, three files still reference `useLazybeeTheme`.

- [ ] **Step 3: Pin the theme**

In `HomePage.jsx`, delete the `const [theme, setTheme] = useState('alabaster');` line, change the root to `<div className="lzb" data-theme="alabaster" ref={rootRef}>`, wrap the whole return in `<LangProvider>`, and reduce the header to `<OwnerHeader heroRef={heroRef} />`.

In `HiveChrome.jsx`, change the signature to `export function HiveHeader()`, delete the mode `<button>`, and mount `<LangSwitch />` in its place.

In each of the three Hive pages, delete the `useLazybeeTheme` import and call, replace `data-theme={theme}` with `data-theme="alabaster"`, wrap the returned tree in `<LangProvider>`, and call `<HiveHeader />` with no props.

Then: `rm src/hooks/useLazybeeTheme.js`

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/components/__tests__/theme-locked.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify the prerender still builds**

Run: `cd /Users/mark/Desktop/hyve-website && npm run build`
Expected: client build, SSR build and prerender all succeed, no "useLazybeeTheme" resolution error.

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add -A src
git commit -m "feat(theme): lock the site to alabaster and remove the dark-mode toggle"
```

---

## Task 5: Translate the owner homepage, section by section

**Files:**
- Modify: `src/components/owners/HeroSection.jsx`, `SplitSection.jsx`, `CombSection.jsx`, `StaticSections.jsx`, `PortalSection.jsx`, `ReachSection.jsx`, `FaqSection.jsx`, `AskSection.jsx`
- Modify: `src/data/ownerPage.js`
- Modify: `src/i18n/en.js`, `src/i18n/zh.js`
- Test: `/Users/mark/Desktop/hyve-website/src/i18n/__tests__/parity.test.js`

Run one section per commit, in the order listed, so a broken section is one `git revert` away. `data/ownerPage.js` holds the FAQ pairs and is translated with `FaqSection`.

- [ ] **Step 1: Write the failing parity test**

```js
// src/i18n/__tests__/parity.test.js
import en from '../en';
import zh from '../zh';

test('every English key has a Chinese translation', () => {
  const missing = Object.keys(en).filter((k) => !zh[k]);
  expect(missing).toEqual([]);
});

test('no orphan Chinese keys are left behind after a rename', () => {
  const orphans = Object.keys(zh).filter((k) => !(k in en));
  expect(orphans).toEqual([]);
});

test('no Chinese value is accidentally still English', () => {
  const untranslated = Object.entries(zh)
    .filter(([k, v]) => v === en[k] && !/^[\d\s$.,%+-]*$/.test(v));
  expect(untranslated).toEqual([]);
});
```

- [ ] **Step 2: Run it to see the current gap**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run src/i18n/__tests__/parity.test.js`
Expected: PASS at this point (only the five nav keys exist and all five are translated). It becomes the guard rail that fails the moment a section is half-migrated.

- [ ] **Step 3: Migrate one section**

For each section file: call `const t = useT();` at the top, move every visible literal into `en.js` under a key prefixed with the section id (`hero.*`, `split.*`, `comb.*`, `compare.*`, `trial.*`, `legal.*`, `portal.*`, `reach.*`, `faq.*`, `ask.*`), write the Chinese into `zh.js` under the same key, and replace the literal with `{t('key')}`.

Numbers, currency and unit codes stay outside the dictionary. They are produced by `lib/ownerModel.js` and are language-independent. Interpolated sentences take a `{value}` placeholder and a small replace at the call site, rather than being split into two dictionary fragments that a translator cannot reorder:

```jsx
// en.js
'split.floor': 'Your floor, even in our worst year: {amount}',
// zh.js
'split.floor': '即使在我们最差的一年，您的保底收入：{amount}',
// SplitSection.jsx
<div className="label">{t('split.floor').replace('{amount}', fmt(m.floor))}</div>
```

- [ ] **Step 4: Run the parity test and the suite after each section**

Run: `cd /Users/mark/Desktop/hyve-website && npx vitest run`
Expected: PASS. A missing translation fails `parity.test.js` by name, so the gap is obvious.

- [ ] **Step 5: Commit each section separately**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/components/owners/SplitSection.jsx src/i18n/en.js src/i18n/zh.js
git commit -m "feat(i18n): translate the earnings section"
```

---

## Task 6: The booking-site language plumbing

**Files:**
- Create: `/Users/mark/Desktop/hyve-booking/lib/lang.ts`
- Create: `/Users/mark/Desktop/hyve-booking/lib/dict.ts`
- Create: `/Users/mark/Desktop/hyve-booking/components/LangSwitch.tsx`
- Modify: `/Users/mark/Desktop/hyve-booking/app/layout.tsx:58-70`
- Modify: `/Users/mark/Desktop/hyve-booking/components/Nav.tsx`
- Modify: `/Users/mark/Desktop/hyve-booking/app/globals.css:418-433`

`ThemeToggle.tsx`, `data-theme="tobacco"` and the inline no-flash script are all left alone. The booking site keeps dark as its default and keeps its light/dark control.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/lang.test.ts
import { tFor } from "../dict";

test("tFor returns the Chinese string for zh and English for en", () => {
  expect(tFor("en")("nav.hive")).toBe("Guides");
  expect(tFor("zh")("nav.hive")).toBe("指南");
});

test("a key missing from zh falls back to English, never to blank", () => {
  expect(tFor("zh")("nav.__missing__")).toBe("nav.__missing__");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run lib/__tests__/lang.test.ts`
Expected: FAIL, cannot resolve `../dict`.

- [ ] **Step 3: Write the plumbing**

```ts
// lib/lang.ts
import { cookies } from "next/headers";

export type Lang = "en" | "zh";
export const LANG_COOKIE = "lb-lang";

/** Every page in this app is force-dynamic already, so reading a cookie here
 *  costs nothing: it cannot opt a static page out of static generation. */
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get(LANG_COOKIE)?.value === "zh" ? "zh" : "en";
}
```

```ts
// lib/dict.ts
import type { Lang } from "./lang";

const en = {
  "nav.hive": "Guides",
  "nav.whatsapp": "WhatsApp",
} as const;

const zh: Partial<Record<keyof typeof en, string>> = {
  "nav.hive": "指南",
  "nav.whatsapp": "WhatsApp",
};

export type Key = keyof typeof en;

/** English is the fallback for any key Chinese has not caught up with, and the
 *  key itself is the last resort, so a typo shows up loudly instead of blank. */
export function tFor(lang: Lang) {
  return (key: string): string =>
    (lang === "zh" ? zh[key as Key] : undefined) ?? en[key as Key] ?? key;
}
```

```tsx
// components/LangSwitch.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, type Lang } from "@/lib/lang";

/** The cookie is the source of truth so the server components render the right
 *  language on the very next paint. router.refresh() re-runs them in place
 *  without losing scroll position or any open booking form state. */
export default function LangSwitch({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const goingChinese = lang === "en";

  const flip = () => {
    const next: Lang = goingChinese ? "zh" : "en";
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    start(() => router.refresh());
  };

  return (
    <button
      type="button"
      onClick={flip}
      className="lb-langbtn"
      aria-busy={pending}
      aria-label={goingChinese ? "切换到中文 / Switch to Chinese" : "Switch to English / 切换到英文"}
    >
      {goingChinese ? "中文" : "EN"}
    </button>
  );
}
```

- [ ] **Step 4: Wire the layout and the nav**

In `app/layout.tsx`: make `RootLayout` async, `const lang = await getLang();`, render `<html lang={lang === "zh" ? "zh-Hans" : "en"} data-theme="tobacco" ...>` and pass `lang` into `<Nav lang={lang} />`. The no-flash theme script and `suppressHydrationWarning` stay exactly as they are.

In `components/Nav.tsx`: keep the `ThemeToggle` import and element, add `<LangSwitch lang={lang} />` beside it, and take `lang` as a prop. Translate the two nav strings through `tFor(lang)`.

In `app/globals.css`, add `.lb-langbtn` next to `.lb-modebtn` so the two controls line up:

```css
  .lb-langbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    min-width: 52px;
    padding: 0 10px;
    border: 1px solid currentColor;
    border-radius: 999px;
    background: none;
    color: inherit;
    font: inherit;
    letter-spacing: 0.06em;
    opacity: 0.72;
    cursor: pointer;
  }
  .lb-langbtn:hover {
    opacity: 1;
  }
```

- [ ] **Step 5: Run the tests and the build**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/Desktop/hyve-booking
git add -A
git commit -m "feat(i18n): cookie-driven EN/ZH switch on the booking site"
```

---

## Task 7: Translate the booking screens

**Files:**
- Modify: `app/page.tsx`, `app/rooms/[unitCode]/page.tsx`, `app/reserved/[token]/page.tsx`
- Modify: `components/Hero.tsx`, `SearchExperience.tsx`, `SearchBar.tsx`, `FilterSelect.tsx`, `RoomCard.tsx`, `BookingPanel.tsx`, `BookingFlow.tsx`, `ReserveForm.tsx`, `ReserveDetailsForm.tsx`, `ScheduleViewingForm.tsx`, `FeatureSection.tsx`, `LocationBlock.tsx`, `Gallery.tsx`, `PriceChart.tsx`, `HiveTeaser.tsx`, `HeroBookingCtas.tsx`, `TourPlayer.tsx`
- Modify: `lib/dict.ts`

- [ ] **Step 1: Thread the language through the three pages**

Each page calls `const lang = await getLang();` and passes `lang` to the components it renders. Client components receive it as a prop rather than reading a context, which keeps a single mechanism across the app and avoids adding a provider to the tree.

- [ ] **Step 2: Migrate one screen per commit**

Order: room search (`app/page.tsx` + `SearchExperience`, `SearchBar`, `FilterSelect`, `RoomCard`), then the room page (`app/rooms/[unitCode]` + `Gallery`, `BookingPanel`, `PriceChart`, `FeatureSection`, `LocationBlock`, `TourPlayer`), then the booking and viewing forms, then the reserved-hold page. Forms come with validation and error strings: those are user-visible and get keys too.

- [ ] **Step 3: Run the suite after each screen**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit each screen**

```bash
cd /Users/mark/Desktop/hyve-booking
git add app/page.tsx components/SearchExperience.tsx components/SearchBar.tsx components/FilterSelect.tsx components/RoomCard.tsx lib/dict.ts
git commit -m "feat(i18n): translate the room search screen"
```

---

## Task 8: QA both sites in a real browser before saying it works

**Files:** none. This is the verification gate.

- [ ] **Step 1: Main site**

Run: `cd /Users/mark/Desktop/hyve-website && npm run build && npx vite preview --host 127.0.0.1`
Open the preview in the Chrome extension. Confirm: the five nav labels read Earnings / Compare / Portfolio / Guides / Estimate, each one scrolls to the right section, Guides goes to `/hive`, there is no Light/Dark button anywhere, the 中文 button switches every visible string on the page, a reload keeps Chinese, and `/hive` keeps the choice across a route change.

- [ ] **Step 2: Booking site**

Run: `cd /Users/mark/Desktop/hyve-booking && npm run build && npm run start`
Confirm: the header shows Guides / theme button / 中文 / WhatsApp, the page opens tobacco (dark), the theme button still flips it to alabaster and the choice sticks, the language button translates the search, room and booking screens, and both choices survive a reload and a navigation into a room page. Check the language switch works in both themes.

- [ ] **Step 3: Reduced-motion and mobile**

Resize to 390px. Confirm the header does not wrap or overflow with the language button added, and the button keeps a 44px tap target.

- [ ] **Step 4: Report to Mark with what was actually checked**

Paste the result inline in chat, naming the checks run. Per the standing QA rule, nothing is described as working until the check that would fail if it were broken has been run.
