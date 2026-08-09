import { Helmet } from "react-helmet-async";

export default function SEO({ title, description, canonical, ogImage, type = "website", schema, noindex = false }) {
  const siteName = "Lazybee";
  const baseUrl = "https://www.lazybee.sg";
  const fullTitle = title ? `${title} | ${siteName}` : "Lazybee — Co-living in Singapore";
  const fullCanonical = canonical ? `${baseUrl}${canonical}` : baseUrl;
  const defaultDescription = "All-inclusive co-living rooms in Singapore from S$950/month — furnished, bills included, near MRT in Lentor, Jurong East & Serangoon. No agent fees.";
  const desc = description || defaultDescription;
  const image = ogImage || `${baseUrl}/og-default.png`;
  const schemas = schema ? (Array.isArray(schema) ? schema : [schema]) : [];

  return (
    <Helmet>
      <html lang="en" />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={fullCanonical} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
