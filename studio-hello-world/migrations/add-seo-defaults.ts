import { defineMigration, at, set } from "sanity/migrate";

export default defineMigration({
  title: "add-seo-defaults",
  name: "Add default SEO meta title and description from title and excerpt",
  documentTypes: ["blogPost"],
  migrate: {
    document(doc, context) {
      const updates = [];
      
      // Set default meta title if not present
      if (doc.title && (!doc.seo?.metaTitle || doc.seo?.metaTitle === '')) {
        updates.push(at("seo.metaTitle", set(`${doc.title} | Hyve Blog`)));
      }
      
      // Set default meta description if not present
      if (doc.excerpt && (!doc.seo?.metaDescription || doc.seo?.metaDescription === '')) {
        updates.push(at("seo.metaDescription", set(doc.excerpt)));
      }
      
      return updates;
    },
  },
});