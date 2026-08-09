// src/lib/seo.js — pure JSON-LD builders. No side effects.
const BASE = 'https://www.lazybee.sg';
const BRAND = 'Lazybee';
const PHONE = '+6580695410';
const EMAIL = 'hello@lazybee.sg';
const SAME_AS = ['https://wa.me/6580695410', 'https://www.instagram.com/lazybee.sg'];

export function orgSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    url: BASE,
    logo: `${BASE}/lazybee-logo.png`,
    telephone: PHONE,
    email: EMAIL,
    sameAs: SAME_AS,
  };
}

export function lodgingBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: BRAND,
    url: BASE,
    image: `${BASE}/og-default.png`,
    telephone: PHONE,
    email: EMAIL,
    priceRange: 'S$950–S$1,800 / month',
    address: { '@type': 'PostalAddress', addressCountry: 'SG', addressRegion: 'Singapore' },
    areaServed: ['Lentor', 'Jurong East', 'Serangoon'],
    sameAs: SAME_AS,
  };
}

export function faqPageSchema(qas) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: { '@type': 'Answer', text: qa.a },
    })),
  };
}

export function blogPostingSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    datePublished: post.publishedAt || post.date || undefined,
    image: post.coverImage || `${BASE}/og-default.png`,
    author: { '@type': 'Organization', name: BRAND },
    publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: `${BASE}/lazybee-logo.png` } },
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
  };
}

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.path}`,
    })),
  };
}
