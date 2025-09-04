import { defineMigration, at, set } from "sanity/migrate";

export default defineMigration({
  title: "normalize-categories",
  name: "Normalize blog post categories to lowercase",
  documentTypes: ["blogPost"],
  migrate: {
    document(doc, context) {
      // Normalize category names to consistent format
      if (doc.category) {
        const normalizedCategory = doc.category.toLowerCase().replace(/\s+/g, '-');
        return [at("category", set(normalizedCategory))];
      }
      return [];
    },
  },
});