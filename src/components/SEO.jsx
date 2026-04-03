import { Helmet } from "react-helmet-async";

export default function SEO({ title, description, canonical, ogImage, type = "website", schema, noindex = false }) {
  const siteName = "Hyve";
  const baseUrl = "https://www.lazybee.sg";
  const fullTitle = title ? `${title} | ${siteName}` : "Hyve — Co-living in Singapore";
  const fullCanonical = canonical ? `${baseUrl}${canonical}` : baseUrl;
  const defaultDescription = "Premium co-living rooms in Singapore from S$950/month. Fully furnished, all bills included. Thomson, Hougang, Bukit Batok.";
  const desc = description || defaultDescription;
  const image = ogImage || `${baseUrl}/og-default.png`;

  return (
    <Helmet>
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
      {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
    </Helmet>
  );
}
