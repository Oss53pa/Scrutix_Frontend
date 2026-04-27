-- ============================================================================
-- ATLASBANX - App-specific schema (Iter 1)
-- Creates the `atlasbanx` schema for app-specific tables in the shared core DB.
-- Core tables (auth.users, public.profiles, public.organizations,
-- public.user_settings) remain in their existing schemas and are shared
-- across all apps on the core database.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS atlasbanx;

-- Grant usage to authenticated users (RLS enforces row ownership)
GRANT USAGE ON SCHEMA atlasbanx TO authenticated;
GRANT USAGE ON SCHEMA atlasbanx TO service_role;

-- Expose schema to PostgREST so the JS client can query it
-- (this requires updating the `api.db-extra-search-path` via the Supabase
-- dashboard → API Settings → Exposed schemas: add `atlasbanx`)
-- If not exposed via dashboard, queries must use the fully-qualified form
-- supabase.schema('atlasbanx').from('clients') which works out of the box.

-- ============================================================================
-- CLIENTS
-- ============================================================================

CREATE TABLE atlasbanx.clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  -- Legal info
  legal_name      TEXT,
  siret           TEXT,
  rccm            TEXT,
  nif             TEXT,
  legal_form      TEXT,
  capital         NUMERIC,
  currency        TEXT DEFAULT 'XAF',
  -- Address
  address         TEXT,
  city            TEXT,
  postal_code     TEXT,
  country         TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  -- Main contact
  contact_name    TEXT,
  contact_role    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  -- Business info
  sector          TEXT,
  activity        TEXT,
  employee_count  INTEGER,
  annual_revenue  NUMERIC,
  fiscal_year_end TEXT,
  -- Misc
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id ON atlasbanx.clients(user_id);
CREATE INDEX idx_clients_user_code ON atlasbanx.clients(user_id, code);

ALTER TABLE atlasbanx.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_clients_select" ON atlasbanx.clients
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_clients_insert" ON atlasbanx.clients
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_clients_update" ON atlasbanx.clients
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_clients_delete" ON atlasbanx.clients
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- BANK ACCOUNTS
-- ============================================================================

CREATE TABLE atlasbanx.bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  bank_code      TEXT NOT NULL,
  bank_name      TEXT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'XAF',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_client_id ON atlasbanx.bank_accounts(client_id);
CREATE INDEX idx_bank_accounts_user_id ON atlasbanx.bank_accounts(user_id);

ALTER TABLE atlasbanx.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_accounts_select" ON atlasbanx.bank_accounts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_accounts_insert" ON atlasbanx.bank_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_accounts_update" ON atlasbanx.bank_accounts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_accounts_delete" ON atlasbanx.bank_accounts
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- BANK STATEMENTS (imported files metadata)
-- ============================================================================

CREATE TABLE atlasbanx.bank_statements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES atlasbanx.bank_accounts(id) ON DELETE SET NULL,
  bank_code         TEXT NOT NULL,
  bank_name         TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL CHECK (file_type IN ('csv', 'excel', 'pdf')),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'imported'
                    CHECK (status IN ('imported', 'analyzed', 'archived')),
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_statements_client_id ON atlasbanx.bank_statements(client_id, imported_at DESC);
CREATE INDEX idx_statements_user_id ON atlasbanx.bank_statements(user_id);

ALTER TABLE atlasbanx.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_statements_select" ON atlasbanx.bank_statements
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_statements_insert" ON atlasbanx.bank_statements
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_statements_update" ON atlasbanx.bank_statements
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_statements_delete" ON atlasbanx.bank_statements
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================

CREATE TABLE atlasbanx.transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE CASCADE,
  account_id     UUID REFERENCES atlasbanx.bank_accounts(id) ON DELETE SET NULL,
  account_number TEXT,
  bank_code      TEXT NOT NULL,
  bank_name      TEXT,
  date           DATE NOT NULL,
  value_date     DATE,
  amount         NUMERIC NOT NULL,
  balance        NUMERIC,
  description    TEXT NOT NULL,
  reference      TEXT,
  type           TEXT NOT NULL,
  category       TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common access patterns
CREATE INDEX idx_transactions_client_date ON atlasbanx.transactions(client_id, date DESC);
CREATE INDEX idx_transactions_user_id ON atlasbanx.transactions(user_id);
CREATE INDEX idx_transactions_account_id ON atlasbanx.transactions(account_id);
CREATE INDEX idx_transactions_bank_code ON atlasbanx.transactions(client_id, bank_code);

ALTER TABLE atlasbanx.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_transactions_select" ON atlasbanx.transactions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_transactions_insert" ON atlasbanx.transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_transactions_update" ON atlasbanx.transactions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_transactions_delete" ON atlasbanx.transactions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- Reuses public.update_updated_at() created in 001_initial_schema.sql
-- ============================================================================

CREATE TRIGGER update_atlasbanx_clients_updated_at
  BEFORE UPDATE ON atlasbanx.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_atlasbanx_transactions_updated_at
  BEFORE UPDATE ON atlasbanx.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- GRANTS (RLS still enforces per-row ownership)
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA atlasbanx TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA atlasbanx TO service_role;
