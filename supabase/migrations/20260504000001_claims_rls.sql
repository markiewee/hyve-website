-- Captain reads own claims
CREATE POLICY "Captains read own claims"
  ON claims FOR SELECT
  USING (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
    )
  );

-- Captain inserts own claims
CREATE POLICY "Captains insert own claims"
  ON claims FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'SUBMITTED'
    AND EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
        AND tp.property_id = claims.property_id
    )
  );

-- Admin reads all claims
CREATE POLICY "Admins read all claims"
  ON claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );

-- Admin updates claims
CREATE POLICY "Admins update claims"
  ON claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN', 'SUPER_ADMIN')
        AND tp.is_active = true
    )
  );
