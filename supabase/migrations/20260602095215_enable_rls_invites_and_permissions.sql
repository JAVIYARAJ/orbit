-- Close the anon-key exposure: these tables are only ever reached through
-- SECURITY DEFINER RPCs (which bypass RLS), so enabling RLS with no policies
-- blocks direct anon/authenticated table access without breaking any flow.
ALTER TABLE public.workspace_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_role_permissions ENABLE ROW LEVEL SECURITY;
