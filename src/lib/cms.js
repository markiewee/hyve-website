// The blog's reader.
//
// This began as a drop-in replacement for src/lib/sanity.js, so it mirrored
// that file's whole surface: twelve queries, a property mapper, a room mapper,
// an aggregate helper and a urlFor image builder, all shaped like Sanity so
// call sites could swap the import and change nothing else.
//
// Nine of those queries and every one of those helpers lost their last caller
// when the marketing site moved to prerendered pages and booking moved to
// book.lazybee.sg. What is left is the blog: BlogPage asks for the list,
// BlogPostPage asks for one by slug, and nothing else in the codebase calls
// this file at all. Rooms and properties are read straight from their own
// tables now, which is why the Sanity-shaped mappers had nothing to map.
//
// The rows still live in cms_content, 206 of them, all published.

import { supabase } from './supabase';

/* Each "query" is an opaque tag; client.fetch switches on kind. Kept rather
   than inlined because both call sites read better naming what they want. */
export const QUERIES = {
  blogPosts:      { kind: 'blogPosts' },
  blogPostBySlug: { kind: 'blogPostBySlug' },
};

export const client = {
  async fetch(q, params = {}) {
    if (!q || !q.kind) {
      console.warn('cms.client.fetch: invalid query', q);
      return null;
    }

    switch (q.kind) {
      case 'blogPosts': {
        const { data, error } = await supabase
          .from('cms_content')
          .select('slug, content')
          .eq('type', 'blog_post')
          .eq('published', true)
          .order('sort_order')
          .order('created_at', { ascending: false });
        if (error) console.warn('cms blogPosts fetch failed:', error.message);
        return (data ?? []).map((r) => ({ ...r.content, slug: r.content?.slug ?? r.slug }));
      }

      case 'blogPostBySlug': {
        const { data, error } = await supabase
          .from('cms_content')
          .select('content')
          .eq('type', 'blog_post')
          .eq('slug', params.slug)
          .eq('published', true)
          .maybeSingle();
        if (error) console.warn('cms blogPostBySlug fetch failed:', error.message);
        return data?.content ?? null;
      }

      default:
        console.warn('cms.client.fetch: unknown query kind', q.kind);
        return null;
    }
  },
};
