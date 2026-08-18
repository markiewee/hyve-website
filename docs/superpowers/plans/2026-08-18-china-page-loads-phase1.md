# China Page Loads, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lazybee.sg render correctly and fast for visitors inside mainland China, and make it crawlable by the Chinese search and AI engines, without an ICP licence and at zero recurring cost.

**Architecture:** The site is a Vite + React SPA prerendered to static HTML (scripts/prerender.mjs). The mainland problem is not our HTML (proven reachable, avg 1.0s across 269 CN probe nodes on 18 Aug 2026): it is the render-blocking fonts.googleapis.com stylesheets in the head, which the Great Firewall blocks so the first paint stalls until timeout. Fix: serve the same font families same-origin via @fontsource packages, give the Google Maps loader a failure path, and open the door to the Chinese crawlers explicitly. hreflang, zh sitemap alternates and the four-language blog already exist (PR #104): this plan does not touch them.

**Tech Stack:** Vite, React 19, @fontsource/* (self-hosted woff2 + CSS, font-display swap), material-symbols npm package, plain robots.txt, IndexNow key file.

**Branch:** `feat/china-seo-phase1` cut from `origin/master`. Repo: /Users/mark/Desktop/hyve-website. Package manager: npm (package-lock.json).

**Explicitly out of scope:** the 206-article Mandarin translation job (separate in-flight workstream, lands into src/content/hive/zh/ on its own), GTM (async, harmless), the staff PropertyPanel map (behind /portal/, mainland-irrelevant), contract templates in public/templates/ (rendered to PDF locally, not web pages), Chinese brand name (Mark deciding), WeChat contact ID (Mark deciding, one-line follow-up once given).

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Cut the branch from origin/master**

```bash
cd /Users/mark/Desktop/hyve-website
git fetch origin
git checkout -B feat/china-seo-phase1 origin/master
```

Expected: `Switched to a new branch 'feat/china-seo-phase1'`, `git status` clean.

---

### Task 1: Self-host all fonts (the mainland page-breaker)

Today index.html carries 2 preconnects + 4 render-blocking stylesheet links to fonts.googleapis.com covering Hanken Grotesk, Inter, Cormorant Garamond, Italiana, Inter Tight, JetBrains Mono and the Material Symbols Outlined icon font (used via the `material-symbols-outlined` class in 58 files). fonts.googleapis.com and fonts.gstatic.com are GFW-blocked: mainland visitors stall on first paint and icons render as raw ligature text. Self-hosting keeps the exact same font-family names, so no other file changes.

**Files:**
- Modify: `package.json` (+ lockfile, via npm install)
- Modify: `src/main.jsx` (add font imports at the top, before the CSS import)
- Modify: `index.html:49-56` (remove the Google Fonts preconnects and stylesheet links)

- [ ] **Step 1: Install the font packages**

```bash
cd /Users/mark/Desktop/hyve-website
npm install @fontsource/hanken-grotesk @fontsource/inter @fontsource/cormorant-garamond @fontsource/italiana @fontsource/inter-tight @fontsource/jetbrains-mono material-symbols
```

Expected: all seven packages added to dependencies, install exits 0.

- [ ] **Step 2: Import the exact weights in src/main.jsx**

Add this block at the very top of `src/main.jsx`, above all existing imports (weights mirror the old css2 URLs one-for-one):

```jsx
// Self-hosted fonts. These used to be four render-blocking <link> tags to
// fonts.googleapis.com in index.html. That host is blocked in mainland China,
// so a visitor there stared at an unstyled stall while the browser waited out
// the firewall. Same families, same weights, now served from our own origin,
// which we have verified loads fine from inside China. font-display: swap is
// baked into the @fontsource CSS.
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/hanken-grotesk/800.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/italiana/400.css';
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
// The icon font. Provides the .material-symbols-outlined class the site
// already uses in 58 components.
import 'material-symbols/outlined.css';
```

- [ ] **Step 3: Remove the Google Fonts tags from index.html**

Delete exactly these lines from `index.html` (currently lines 49-56), including the two comments that belong to them:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <!-- Lazybee design system faces: statements, wordmark, body and every number -->
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Italiana&family=Inter+Tight:wght@300;400;500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    <!-- Lazybee design system typefaces (portal + owner surfaces) -->
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Italiana&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

Replace them with a single comment so the next reader knows where they went:

```html
    <!-- Fonts are self-hosted (imported in src/main.jsx via @fontsource).
         fonts.googleapis.com is blocked in mainland China and these links were
         render-blocking there. Do not add Google Fonts <link> tags back. -->
```

- [ ] **Step 4: Build and verify the bytes**

```bash
cd /Users/mark/Desktop/hyve-website
npm run build
grep -c "fonts.googleapis" dist/index.html || echo "OK: no google fonts in dist/index.html"
grep -rl "@font-face" dist/assets/*.css | head -1
ls dist/assets/ | grep -ci "woff2"
grep -rc "fonts.googleapis" dist/assets/*.css | grep -v ":0" || echo "OK: no google fonts in built CSS"
```

Expected: "OK: no google fonts in dist/index.html", at least one CSS file with @font-face, woff2 count > 20, "OK: no google fonts in built CSS". (The prerendered article pages reuse the same head template, spot-check one: `grep -c "fonts.googleapis" dist/hive/index.html` should be 0.)

- [ ] **Step 5: Visual smoke test**

```bash
npm run serve:dist
```

Open the printed localhost URL: headings must render in Cormorant Garamond/Italiana (serif display), body in Inter/Inter Tight, icons as icons (not words like "home"). Then stop the server.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add package.json package-lock.json src/main.jsx index.html
git commit -m "feat: self-host all fonts, drop render-blocking fonts.googleapis links (GFW-blocked in mainland China)"
```

---

### Task 2: Google Maps failure fallback (address card)

maps.googleapis.com is also GFW-blocked, but the script is async so pages still render: mainland users just get a map box that never resolves. Give `src/components/MapComponent.jsx` a timeout + error path that swaps in an address card with working links. (LocationsMapComponent does not load Google Maps; the staff PropertyPanel is behind /portal/ and out of scope.)

**Files:**
- Modify: `src/components/MapComponent.jsx`

- [ ] **Step 1: Add the failure state and arm the loader**

In `MapComponent.jsx`, add to the existing state block (after `const [showAmenities, ...]`, around line 16):

```jsx
  const [loadFailed, setLoadFailed] = useState(false);
```

Replace the `loadGoogleMaps` function (currently lines ~24-36) with:

```jsx
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=3.exp`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      // In mainland China maps.googleapis.com is blocked and the request hangs
      // rather than erroring. Eight seconds, then the address card takes over.
      script.onerror = () => setLoadFailed(true);
      const bail = setTimeout(() => {
        if (!(window.google && window.google.maps)) setLoadFailed(true);
      }, 8000);
      script.addEventListener('load', () => clearTimeout(bail));
      document.head.appendChild(script);
    };
```

- [ ] **Step 2: Render the fallback card**

Immediately before the component's main `return`, add:

```jsx
  if (loadFailed) {
    const addr =
      property?.location?.address || property?.address || property?.name || 'Singapore';
    const q = encodeURIComponent(addr);
    return (
      <Card className={className} style={{ height }}>
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <MapPin className="h-6 w-6" aria-hidden="true" />
          {property?.name && <div className="font-medium">{property.name}</div>}
          <div className="text-sm text-muted-foreground">{addr}</div>
          <div className="flex gap-4 text-sm">
            <a
              className="underline"
              href={`https://www.google.com/maps/search/?api=1&query=${q}`}
              target="_blank"
              rel="noreferrer"
            >
              Google Maps
            </a>
            <a
              className="underline"
              href={`https://uri.amap.com/search?keyword=${q}`}
              target="_blank"
              rel="noreferrer"
            >
              高德地图
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }
```

- [ ] **Step 3: Manually verify the fallback fires**

```bash
npm run dev
```

In Chrome DevTools > Network, add a request-blocking pattern for `maps.googleapis.com`, open a page that renders MapComponent, confirm the address card appears within ~8s with both links working. Remove the block, reload, confirm the live map still initializes. Stop the dev server.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add src/components/MapComponent.jsx
git commit -m "feat: address-card fallback when Google Maps cannot load (blocked in mainland China)"
```

---

### Task 3: robots.txt, name the Chinese crawlers

`public/robots.txt` already names Bytespider (Doubao) and PetalBot. Add the four missing Chinese search crawlers: Baiduspider (Baidu + ERNIE), Sogou web spider (Sogou index, feeds Tencent Yuanbao and WeChat search), YisouSpider (Shenma index, feeds Alibaba Quark), 360Spider (360 search).

**Files:**
- Modify: `public/robots.txt` (insert after the PetalBot block, before SemrushBot-OCOB)

- [ ] **Step 1: Insert the new groups**

```
# Chinese search engine crawlers. The site serves mainland readers directly
# (custom domain is not GFW-blocked; verified 18 Aug 2026, 269 probe nodes).
# Named explicitly for the same reason as the AI crawlers above: several look
# for their own token first, and being unambiguous costs nothing.

User-agent: Baiduspider
Allow: /
Disallow: /portal/

User-agent: Sogou web spider
Allow: /
Disallow: /portal/

User-agent: YisouSpider
Allow: /
Disallow: /portal/

User-agent: 360Spider
Allow: /
Disallow: /portal/
```

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat: name Baidu, Sogou, Shenma and 360 crawlers in robots.txt"
```

---

### Task 4: IndexNow key file

IndexNow lets us push new/changed URLs to Bing (and partners) instantly. Bing operates legally in China and its index feeds parts of the Chinese AI retrieval layer. The protocol needs a key file at the site root.

**Files:**
- Create: `public/<key>.txt`

- [ ] **Step 1: Generate the key and file**

```bash
cd /Users/mark/Desktop/hyve-website
KEY=$(uuidgen | tr -d '-' | tr 'A-Z' 'a-z')
echo "$KEY" > "public/${KEY}.txt"
echo "IndexNow key: $KEY"
```

Record the printed key in the PR description (it is public by design, not a secret).

- [ ] **Step 2: Commit**

```bash
git add public/*.txt
git commit -m "feat: IndexNow key file for instant Bing indexing"
```

---

### Task 5: Email contact in the blog footer

The only contact routes on the blog chrome are the /contact link and, sitewide, a wa.me link. WhatsApp is blocked in mainland China, so a zh reader pre-arrival has no working contact. Put the email address directly in `HiveFooter` (all languages: it helps everyone and avoids per-language branching). WeChat ID gets added the same way once Mark provides one.

**Files:**
- Modify: `src/components/hive/HiveChrome.jsx` (HiveFooter, the `<p className="label">` around line 86)

- [ ] **Step 1: Add the mailto**

In `HiveFooter`, change the footer line to include the email between "Find a room" and "Privacy":

```jsx
      <p className="label">
        Makery Pte Ltd · Singapore ·{' '}
        <Link to="/hive" style={{ textDecoration: 'none' }}>{t('nav.guides')}</Link> ·{' '}
        <a href={BOOKING_URL} className="accent" style={{ textDecoration: 'none' }}>Find a room</a> ·{' '}
        {/* Plain email on purpose: WhatsApp is blocked in mainland China, and
            the blog's Chinese readers need a contact route that works there. */}
        <a href="mailto:hello@lazybee.sg" style={{ textDecoration: 'none' }}>hello@lazybee.sg</a> ·{' '}
        <Link to="/privacy-policy" style={{ textDecoration: 'none' }}>Privacy</Link> ·{' '}
        <Link to="/terms-of-service" style={{ textDecoration: 'none' }}>Terms</Link> ·{' '}
        <Link to="/contact" style={{ textDecoration: 'none' }}>Contact</Link>
      </p>
```

- [ ] **Step 2: Lint, build, commit**

```bash
npm run lint
npm run build
git add src/components/hive/HiveChrome.jsx
git commit -m "feat: email address in blog footer (WhatsApp is blocked in mainland China)"
```

---

### Task 6: Final verification and PR

- [ ] **Step 1: Full build + dist assertions in one pass**

```bash
cd /Users/mark/Desktop/hyve-website
npm run build
grep -rc "fonts.googleapis\|fonts.gstatic" dist/index.html dist/hive/index.html | grep -v ":0" || echo "OK fonts"
grep -c "Baiduspider" dist/robots.txt 2>/dev/null || grep -c "Baiduspider" public/robots.txt
ls public/*.txt
```

Expected: "OK fonts", Baiduspider count 1, IndexNow key file listed.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/china-seo-phase1
gh pr create --title "China page loads: self-hosted fonts, Maps fallback, Chinese crawlers, IndexNow" --body-file - <<'EOF'
(PR body from the approved draft)
EOF
```

- [ ] **Step 3: Post-merge ops (not code, tracked on the loops board)**

1. Verify www.lazybee.sg in Bing Webmaster Tools (mark@meetmillia.com Microsoft account), submit sitemap.xml, send an IndexNow ping with the new key.
2. Mark pastes the real Google Search Console token into index.html (the old placeholder was removed; noted in the head comment).
3. Attempt Baidu ziyuan.baidu.com registration once via the overseas flow; do not fight it if SMS fails.
4. Re-run the itdog.cn full-page test on a deployed page to confirm first paint no longer stalls.
