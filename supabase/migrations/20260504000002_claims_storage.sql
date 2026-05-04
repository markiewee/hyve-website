-- Create the claims bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claims',
  'claims',
  false,
  10 * 1024 * 1024,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Captain can upload to {auth.uid()}/* in claims bucket (must be a captain)
CREATE POLICY "Captains upload to own claims folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'claims'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
    )
  );

-- Captain can read their own files
CREATE POLICY "Captains read own claim files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claims'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can read all files in claims bucket
CREATE POLICY "Admins read all claim files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claims'
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );
