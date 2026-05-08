#!/usr/bin/env node
// Migrate Sanity content (neighborhoods + page singletons) into Supabase cms_content.
//
// One-shot script. Reads from Sanity project ydn0o1zt/production, writes to
// Supabase project diiilqpfmlxjwiaeophb. Downloads referenced images to
// public/cms/<type>/<slug>/ and rewrites asset refs to local paths.
//
// Usage:
//   node scripts/migrate-sanity-to-supabase.mjs
//
// Reads service-role key from .env.vercel.prod (IOT_SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from '@sanity/client';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ── credentials ────────────────────────────────────────────────────────
const envFile = await readFile(join(REPO_ROOT, '.env.vercel.prod'), 'utf8');
const SR_KEY = envFile.match(/IOT_SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1];
if (!SR_KEY) throw new Error('IOT_SUPABASE_SERVICE_ROLE_KEY not found in .env.vercel.prod');
const SUPABASE_URL = 'https://diiilqpfmlxjwiaeophb.supabase.co';

// ── sanity client ──────────────────────────────────────────────────────
const sanity = createClient({
  projectId: 'ydn0o1zt',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
});

// ── helpers ────────────────────────────────────────────────────────────
const renameHyveStrings = (val) => {
  if (typeof val === 'string') {
    return val
      .replace(/HYVE/g, 'LAZYBEE')
      .replace(/Hyve/g, 'Lazybee')
      .replace(/hyve/g, 'lazybee');
  }
  if (Array.isArray(val)) return val.map(renameHyveStrings);
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = renameHyveStrings(val[k]);
    return out;
  }
  return val;
};

// Sanity image refs look like: image-<hash>-<W>x<H>-<ext>
// Resolve to https://cdn.sanity.io/images/<projectId>/<dataset>/<hash>-<W>x<H>.<ext>
const refToUrl = (ref) => {
  const m = ref.match(/^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/);
  if (!m) return null;
  return `https://cdn.sanity.io/images/ydn0o1zt/production/${m[1]}-${m[2]}.${m[3]}`;
};

const refToFilename = (ref) => {
  const m = ref.match(/^image-([a-f0-9]+)-\d+x\d+-(\w+)$/);
  if (!m) return null;
  return `${m[1].slice(0, 16)}.${m[2]}`;
};

const downloads = new Set();

// Walk content, replace `{ _type: 'image', asset: { _ref: '...' } }` with `{ src: '/cms/<type>/<slug>/<filename>' }`.
// Records the image to download in `downloads`.
const rewriteImages = (val, type, slug) => {
  if (Array.isArray(val)) return val.map((v) => rewriteImages(v, type, slug));
  if (val && typeof val === 'object') {
    if (val._type === 'image' && val.asset?._ref) {
      const filename = refToFilename(val.asset._ref);
      const url = refToUrl(val.asset._ref);
      if (filename && url) {
        const localPath = `/cms/${type}/${slug}/${filename}`;
        downloads.add(JSON.stringify({ url, dest: join(REPO_ROOT, 'public', localPath) }));
        return { src: localPath, alt: val.alt || null, caption: val.caption || null };
      }
    }
    const out = {};
    for (const k of Object.keys(val)) out[k] = rewriteImages(val[k], type, slug);
    return out;
  }
  return val;
};

const downloadImage = async ({ url, dest }) => {
  if (existsSync(dest)) return 'cached';
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return 'downloaded';
};

const upsertCms = async (rows) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cms_content?on_conflict=type,slug`, {
    method: 'POST',
    headers: {
      apikey: SR_KEY,
      Authorization: `Bearer ${SR_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Upsert failed ${res.status}: ${await res.text()}`);
  return res.json();
};

// ── pull from sanity ───────────────────────────────────────────────────
console.log('→ Fetching neighborhoods + page singletons from Sanity...');
const [neighborhoods, homePage, aboutPage, faqPage] = await Promise.all([
  sanity.fetch(`*[_type=="neighborhood" && !(_id in path("drafts.**"))]`),
  sanity.fetch(`*[_type=="homePage" && !(_id in path("drafts.**"))][0]`),
  sanity.fetch(`*[_type=="aboutPage" && !(_id in path("drafts.**"))][0]`),
  sanity.fetch(`*[_type=="faqPage" && !(_id in path("drafts.**"))][0]`),
]);
console.log(`  ${neighborhoods.length} neighborhoods, homePage=${!!homePage}, aboutPage=${!!aboutPage}, faqPage=${!!faqPage}`);

// ── transform ──────────────────────────────────────────────────────────
const stripSystem = (doc) => {
  if (!doc) return null;
  const out = {};
  for (const k of Object.keys(doc)) {
    if (!['_id', '_type', '_rev', '_createdAt', '_updatedAt', '_system'].includes(k)) {
      out[k] = doc[k];
    }
  }
  return out;
};

const rows = [];

// Neighborhoods
for (const n of neighborhoods) {
  const slug = n.slug?.current;
  if (!slug) continue;
  const content = renameHyveStrings(rewriteImages(stripSystem(n), 'neighborhood', slug));
  rows.push({
    type: 'neighborhood',
    slug,
    title: n.name,
    content,
    published: true,
    sort_order: n.featured ? 0 : 100,
  });
}

// Page singletons
const pages = [
  { slug: 'home', doc: homePage },
  { slug: 'about', doc: aboutPage },
  { slug: 'faq',   doc: faqPage  },
];
for (const { slug, doc } of pages) {
  if (!doc) continue;
  const content = renameHyveStrings(rewriteImages(stripSystem(doc), 'page', slug));
  rows.push({
    type: 'page',
    slug,
    title: doc.title || slug,
    content,
    published: true,
    sort_order: 0,
  });
}

console.log(`→ Built ${rows.length} cms_content rows`);

// ── download images ───────────────────────────────────────────────────
console.log(`→ Downloading ${downloads.size} referenced images...`);
const downloadJobs = [...downloads].map((s) => JSON.parse(s));
let dl = 0, cached = 0;
for (const job of downloadJobs) {
  try {
    const status = await downloadImage(job);
    if (status === 'cached') cached++; else dl++;
  } catch (e) {
    console.warn(`  ⚠ ${e.message}`);
  }
}
console.log(`  ${dl} downloaded, ${cached} cached`);

// ── upsert ────────────────────────────────────────────────────────────
console.log('→ Upserting to Supabase cms_content...');
const inserted = await upsertCms(rows);
console.log(`✓ Upserted ${inserted.length} rows`);
console.log('  ' + inserted.map((r) => `${r.type}/${r.slug}`).join(', '));
