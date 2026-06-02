-- Pending invitations
CREATE TABLE IF NOT EXISTS workspace_invites (
  id              BIGSERIAL PRIMARY KEY,
  workstation_id  UUID NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','member','viewer')),
  token           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','cancelled','expired')),
  workspace_name  TEXT NOT NULL DEFAULT '',
  inviter_name    TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Dynamic permission overrides per role per workstation
CREATE TABLE IF NOT EXISTS workspace_role_permissions (
  id              BIGSERIAL PRIMARY KEY,
  workstation_id  UUID NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('admin','member','viewer')),
  permission_key  TEXT NOT NULL,
  allowed         BOOLEAN NOT NULL,
  UNIQUE(workstation_id, role, permission_key)
);

-- Add assignee to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
