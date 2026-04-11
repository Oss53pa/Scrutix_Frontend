-- ============================================================================
-- ATLASBANX - Migration 007 — Cabinet Billing
-- ----------------------------------------------------------------------------
-- Purpose:
--   Invoicing subsystem for cabinet accounts: billing_settings (per-user
--   defaults), invoices (main record), invoice_lines (line items), plus a
--   sequential numbering helper that guarantees gapless, per-user invoice
--   numbers.
--
-- Tenancy note:
--   This migration uses user_id as the tenant, following the convention
--   of earlier migrations. When a proper cabinets table is introduced
--   later, a nullable cabinet_id column already exists for retrofitting.
-- ============================================================================

-- ============================================================================
-- BILLING SETTINGS (per cabinet/user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.billing_settings (
  user_id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id                    UUID,
  default_payment_terms_days    INTEGER NOT NULL DEFAULT 30
                                CHECK (default_payment_terms_days >= 0),
  default_tax_rate              NUMERIC(5,2) NOT NULL DEFAULT 18.00
                                CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
  invoice_prefix                VARCHAR(10) NOT NULL DEFAULT 'ATB',
  last_sequence_number          INTEGER NOT NULL DEFAULT 0,
  last_sequence_year            INTEGER,
  legal_name                    TEXT,
  nif                           TEXT,
  rccm                          TEXT,
  address                       TEXT,
  city                          TEXT,
  country                       TEXT DEFAULT 'CI',
  phone                         TEXT,
  email                         TEXT,
  bank_name                     TEXT,
  bank_account                  TEXT,
  bank_rib                      TEXT,
  legal_mentions                TEXT,
  footer_text                   TEXT,
  logo_url                      TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE atlasbanx.billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_settings_select_own" ON atlasbanx.billing_settings;
CREATE POLICY "billing_settings_select_own" ON atlasbanx.billing_settings
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_insert_own" ON atlasbanx.billing_settings;
CREATE POLICY "billing_settings_insert_own" ON atlasbanx.billing_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_update_own" ON atlasbanx.billing_settings;
CREATE POLICY "billing_settings_update_own" ON atlasbanx.billing_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_billing_settings_updated_at
  BEFORE UPDATE ON atlasbanx.billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE ON atlasbanx.billing_settings TO authenticated;
GRANT ALL ON atlasbanx.billing_settings TO service_role;

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id            UUID,
  client_id             UUID NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE RESTRICT,
  invoice_number        VARCHAR(20) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date              DATE NOT NULL,
  subtotal_fcfa         NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate              NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  tax_amount_fcfa       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_fcfa            NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(3) NOT NULL DEFAULT 'XOF',
  notes                 TEXT,
  payment_received_at   TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status
  ON atlasbanx.invoices(user_id, status, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON atlasbanx.invoices(client_id, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON atlasbanx.invoices(user_id, due_date)
  WHERE status IN ('sent', 'overdue');

ALTER TABLE atlasbanx.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_own" ON atlasbanx.invoices;
CREATE POLICY "invoices_select_own" ON atlasbanx.invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "invoices_insert_own" ON atlasbanx.invoices;
CREATE POLICY "invoices_insert_own" ON atlasbanx.invoices
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "invoices_update_own" ON atlasbanx.invoices;
CREATE POLICY "invoices_update_own" ON atlasbanx.invoices
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "invoices_delete_own" ON atlasbanx.invoices;
CREATE POLICY "invoices_delete_own" ON atlasbanx.invoices
  FOR DELETE USING (user_id = auth.uid() AND status = 'draft');
-- Rationale: only draft invoices can be deleted; sent/paid are kept for
-- OHADA accounting traceability. Cancellation is modeled as a status change.

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON atlasbanx.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.invoices TO authenticated;
GRANT ALL ON atlasbanx.invoices TO service_role;

-- ============================================================================
-- INVOICE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.invoice_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES atlasbanx.invoices(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL DEFAULT 0,
  description       TEXT NOT NULL,
  quantity          NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_fcfa   NUMERIC(15,2) NOT NULL CHECK (unit_price_fcfa >= 0),
  line_total_fcfa   NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price_fcfa) STORED,
  line_type         VARCHAR(20) NOT NULL DEFAULT 'service'
                    CHECK (line_type IN ('service', 'forfait', 'deplacement', 'frais')),
  -- Optional references for traceability
  analysis_id       UUID,
  report_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
  ON atlasbanx.invoice_lines(invoice_id, position);

ALTER TABLE atlasbanx.invoice_lines ENABLE ROW LEVEL SECURITY;

-- Lines inherit ownership from their parent invoice
DROP POLICY IF EXISTS "invoice_lines_select_own" ON atlasbanx.invoice_lines;
CREATE POLICY "invoice_lines_select_own" ON atlasbanx.invoice_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM atlasbanx.invoices i
      WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invoice_lines_insert_own" ON atlasbanx.invoice_lines;
CREATE POLICY "invoice_lines_insert_own" ON atlasbanx.invoice_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM atlasbanx.invoices i
      WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invoice_lines_update_own" ON atlasbanx.invoice_lines;
CREATE POLICY "invoice_lines_update_own" ON atlasbanx.invoice_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM atlasbanx.invoices i
      WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invoice_lines_delete_own" ON atlasbanx.invoice_lines;
CREATE POLICY "invoice_lines_delete_own" ON atlasbanx.invoice_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM atlasbanx.invoices i
      WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.invoice_lines TO authenticated;
GRANT ALL ON atlasbanx.invoice_lines TO service_role;

-- ============================================================================
-- SEQUENTIAL INVOICE NUMBERING
-- ----------------------------------------------------------------------------
-- Per-user, per-year, gapless sequence. Format: {PREFIX}-{YEAR}-{NNNN}.
-- Implemented as a SECURITY DEFINER function so the row-lock on
-- billing_settings is atomic regardless of RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION atlasbanx.next_invoice_number(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, public, pg_temp
AS $$
DECLARE
  v_prefix        VARCHAR(10);
  v_current_year  INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_last_year     INTEGER;
  v_next_seq      INTEGER;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'next_invoice_number: unauthorized';
  END IF;

  -- Ensure a billing_settings row exists
  INSERT INTO atlasbanx.billing_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the row for atomic increment
  SELECT invoice_prefix, last_sequence_number, last_sequence_year
  INTO v_prefix, v_next_seq, v_last_year
  FROM atlasbanx.billing_settings
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Reset sequence on new year
  IF v_last_year IS DISTINCT FROM v_current_year THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := v_next_seq + 1;
  END IF;

  UPDATE atlasbanx.billing_settings
  SET last_sequence_number = v_next_seq,
      last_sequence_year = v_current_year,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_prefix || '-' || v_current_year || '-' || LPAD(v_next_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION atlasbanx.next_invoice_number(UUID) TO authenticated;
