-- ============================================================================
-- ATLASBANX — Migration 024 — Renforcement RLS multi-tenant
-- ============================================================================
-- Restreint les policies créées en 023 pour que chaque table ne soit
-- accessible que par l'utilisateur owner du statement / compte parent.
-- Appliquée en prod via MCP.
-- ============================================================================

-- 1. anomaly_comments
DROP POLICY IF EXISTS anomaly_comments_select ON atlasbanx.anomaly_comments;
CREATE POLICY anomaly_comments_select ON atlasbanx.anomaly_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM atlasbanx.anomalies a
            WHERE a.id = anomaly_comments.anomaly_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS anomaly_comments_insert ON atlasbanx.anomaly_comments;
CREATE POLICY anomaly_comments_insert ON atlasbanx.anomaly_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM atlasbanx.anomalies a
                WHERE a.id = anomaly_comments.anomaly_id AND a.user_id = auth.uid())
  );

-- 2. bank_reconciliations
DROP POLICY IF EXISTS bank_recon_authenticated ON atlasbanx.bank_reconciliations;
DROP POLICY IF EXISTS bank_recon_owner ON atlasbanx.bank_reconciliations;
CREATE POLICY bank_recon_owner ON atlasbanx.bank_reconciliations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = bank_reconciliations.statement_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = bank_reconciliations.statement_id AND s.user_id = auth.uid())
  );

-- 3. bank_complaint_letters
DROP POLICY IF EXISTS complaint_authenticated ON atlasbanx.bank_complaint_letters;
DROP POLICY IF EXISTS complaint_owner ON atlasbanx.bank_complaint_letters;
CREATE POLICY complaint_owner ON atlasbanx.bank_complaint_letters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = bank_complaint_letters.statement_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = bank_complaint_letters.statement_id AND s.user_id = auth.uid())
  );

-- 4. signed_reports
DROP POLICY IF EXISTS signed_reports_authenticated ON atlasbanx.signed_reports;
DROP POLICY IF EXISTS signed_reports_owner ON atlasbanx.signed_reports;
CREATE POLICY signed_reports_owner ON atlasbanx.signed_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = signed_reports.statement_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM atlasbanx.bank_statements s
            WHERE s.id = signed_reports.statement_id AND s.user_id = auth.uid())
  );

-- 5. account_conventions
DROP POLICY IF EXISTS account_conv_authenticated ON atlasbanx.account_conventions;
DROP POLICY IF EXISTS account_conv_owner ON atlasbanx.account_conventions;
CREATE POLICY account_conv_owner ON atlasbanx.account_conventions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM atlasbanx.bank_accounts a
            WHERE a.id = account_conventions.account_id AND a.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM atlasbanx.bank_accounts a
            WHERE a.id = account_conventions.account_id AND a.user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
