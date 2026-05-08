-- CMS content table — replaces Sanity for website display content.
-- Stores singletons (home/about/faq pages), neighborhoods, and future blog posts
-- in a single shape: type + slug + JSONB content. Properties + rooms remain in
-- their own tables (already source of truth per CLAUDE.md rule 9).

CREATE TABLE IF NOT EXISTS public.cms_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('page', 'neighborhood', 'blog_post')),
  slug text NOT NULL,
  title text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);

CREATE INDEX IF NOT EXISTS cms_content_type_idx ON public.cms_content (type);
CREATE INDEX IF NOT EXISTS cms_content_published_idx ON public.cms_content (published);

CREATE OR REPLACE FUNCTION public.cms_content_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cms_content_updated_at ON public.cms_content;
CREATE TRIGGER cms_content_updated_at
  BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.cms_content_set_updated_at();

ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;

-- Public can read published content (it's a public website)
DROP POLICY IF EXISTS "cms_content_public_read" ON public.cms_content;
CREATE POLICY "cms_content_public_read" ON public.cms_content
  FOR SELECT
  USING (published = true);

-- Only service role can write (admin edits via SQL / dashboard for v1)
DROP POLICY IF EXISTS "cms_content_service_write" ON public.cms_content;
CREATE POLICY "cms_content_service_write" ON public.cms_content
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.cms_content IS
  'Website CMS content (replaces Sanity). type: page | neighborhood | blog_post. Content shape varies by type — see migration script that exports from Sanity for canonical structure.';
