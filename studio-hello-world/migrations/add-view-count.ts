import { defineMigration, at, set } from "sanity/migrate";

export default defineMigration({
  title: "add-view-count",
  name: "Add view count field to blog posts",
  documentTypes: ["blogPost"],
  migrate: {
    document(doc, context) {
      // Add a default view count of 0 to all existing blog posts
      return [at("viewCount", set(0))];
    },
  },
});