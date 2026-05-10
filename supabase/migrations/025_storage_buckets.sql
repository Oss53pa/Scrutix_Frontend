-- ============================================================================
-- Migration 025 — Storage buckets pour la page rapport
-- ============================================================================
-- Crée 3 buckets privés avec RLS owner-only :
--   - reports          : PDF générés par generate-report
--   - signed-reports   : bundles ADVIST (TSR) émis par sign-and-send
--   - forensic-bundles : ZIP scellés (CDC §8.3 ForensicExporter)
--
-- Convention path : <statement_id>/<filename>
-- L'owner = bank_statements.user_id ou signed_reports.statement_id → user
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('reports',          'reports',          false, 50 * 1024 * 1024, ARRAY['application/pdf','application/json','application/octet-stream']::text[]),
  ('signed-reports',   'signed-reports',   false, 50 * 1024 * 1024, ARRAY['application/octet-stream','application/pdf','application/zip']::text[]),
  ('forensic-bundles', 'forensic-bundles', false, 200 * 1024 * 1024, ARRAY['application/zip','application/octet-stream']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reports_owner_select" ON storage.objects;
CREATE POLICY "reports_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM atlasbanx.bank_statements s
      WHERE s.id::text = split_part(name, '/', 1) AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_owner_insert" ON storage.objects;
CREATE POLICY "reports_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM atlasbanx.bank_statements s
      WHERE s.id::text = split_part(name, '/', 1) AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "signed_reports_owner_select" ON storage.objects;
CREATE POLICY "signed_reports_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signed-reports'
    AND EXISTS (
      SELECT 1 FROM atlasbanx.signed_reports sr
      JOIN atlasbanx.bank_statements s ON s.id = sr.statement_id
      WHERE sr.id::text = split_part(name, '/', 1) AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forensic_bundles_owner_select" ON storage.objects;
CREATE POLICY "forensic_bundles_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'forensic-bundles'
    AND EXISTS (
      SELECT 1 FROM atlasbanx.bank_statements s
      WHERE s.id::text = split_part(name, '/', 1) AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forensic_bundles_owner_insert" ON storage.objects;
CREATE POLICY "forensic_bundles_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'forensic-bundles'
    AND EXISTS (
      SELECT 1 FROM atlasbanx.bank_statements s
      WHERE s.id::text = split_part(name, '/', 1) AND s.user_id = auth.uid()
    )
  );
