-- Enable Realtime for collaboration tables so workspace owners see live updates
-- when a member accepts an invite or the invite list changes.
ALTER PUBLICATION supabase_realtime ADD TABLE workstation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_invites;
