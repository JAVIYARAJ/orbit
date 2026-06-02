ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_folders_ws ON note_folders
  FOR ALL
  USING (
    workstation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workstation_members wm
      WHERE wm.workstation_id = note_folders.workstation_id
        AND wm.user_id = (SELECT auth.uid())
    )
  );
