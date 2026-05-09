-- ============================================================================
-- ATLASBANX — Migration 021 — Cabinet roles + workspace + client assignments
-- ============================================================================
-- Foundation for the V3 4-level architecture:
--   Cabinet (DG) → Client (junior/senior assigned) → Compte → Relevé
--
-- Tables:
--   atlasbanx.workspaces          — 1 row per workspace, type=cabinet|entreprise
--   atlasbanx.cabinet_members     — (user, workspace, role)
--   atlasbanx.client_assignments  — (client, user, role) — explicit ownership
--
-- Workflow gating (TS-enforced; enum here for SQL queries):
--   junior        → qualify low/medium anomalies
--   senior        → validate high+, qualify
--   dg            → sign critical reports, validate, qualify
--   consultation  → read-only
--
-- Applied on prod via Supabase MCP on 2026-05-09.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cabinet_role') THEN
    CREATE TYPE atlasbanx.cabinet_role AS ENUM ('dg', 'senior', 'junior', 'consultation');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_type') THEN
    CREATE TYPE atlasbanx.workspace_type AS ENUM ('cabinet', 'entreprise');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS atlasbanx.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        atlasbanx.workspace_type NOT NULL,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlasbanx.cabinet_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES atlasbanx.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          atlasbanx.cabinet_role NOT NULL,
  invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS atlasbanx.client_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          atlasbanx.cabinet_role NOT NULL,
  assigned_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON atlasbanx.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_members_user ON atlasbanx.cabinet_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_members_workspace ON atlasbanx.cabinet_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON atlasbanx.client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_user   ON atlasbanx.client_assignments(user_id);

ALTER TABLE atlasbanx.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlasbanx.cabinet_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlasbanx.client_assignments ENABLE ROW LEVEL SECURITY;

-- Workspaces — visible to owner + members; manageable by owner
DROP POLICY IF EXISTS workspaces_member_visible ON atlasbanx.workspaces;
CREATE POLICY workspaces_member_visible ON atlasbanx.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM atlasbanx.cabinet_members cm
      WHERE cm.workspace_id = workspaces.id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspaces_owner_manage ON atlasbanx.workspaces;
CREATE POLICY workspaces_owner_manage ON atlasbanx.workspaces
  FOR ALL USING (owner_id = auth.uid());

-- Cabinet members — self-visible, DG-managed
DROP POLICY IF EXISTS cabinet_members_self_visible ON atlasbanx.cabinet_members;
CREATE POLICY cabinet_members_self_visible ON atlasbanx.cabinet_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS cabinet_members_dg_manage ON atlasbanx.cabinet_members;
CREATE POLICY cabinet_members_dg_manage ON atlasbanx.cabinet_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM atlasbanx.cabinet_members cm
      WHERE cm.workspace_id = cabinet_members.workspace_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'dg'
    )
  );

-- Client assignments — self-visible, DG-managed
DROP POLICY IF EXISTS client_assignments_self ON atlasbanx.client_assignments;
CREATE POLICY client_assignments_self ON atlasbanx.client_assignments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS client_assignments_dg_manage ON atlasbanx.client_assignments;
CREATE POLICY client_assignments_dg_manage ON atlasbanx.client_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM atlasbanx.cabinet_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'dg'
    )
  );

GRANT USAGE ON TYPE atlasbanx.cabinet_role TO authenticated;
GRANT USAGE ON TYPE atlasbanx.workspace_type TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.cabinet_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.client_assignments TO authenticated;

NOTIFY pgrst, 'reload schema';
