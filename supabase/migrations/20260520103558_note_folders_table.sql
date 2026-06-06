-- 1. Create note_folders table
CREATE TABLE IF NOT EXISTS note_folders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  name           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workstation_id, name)
);

-- 2. Add folder_id FK to notes (nullable so migration can fill it)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES note_folders(id) ON DELETE SET NULL;

-- 3. Seed note_folders from distinct folder values in notes
INSERT INTO note_folders (workstation_id, name)
SELECT DISTINCT workstation_id, COALESCE(NULLIF(folder, ''), 'Other')
FROM notes
WHERE workstation_id IS NOT NULL
ON CONFLICT (workstation_id, name) DO NOTHING;

-- 4. Back-fill folder_id on all notes (including soft-deleted)
UPDATE notes n
SET folder_id = nf.id
FROM note_folders nf
WHERE nf.workstation_id = n.workstation_id
  AND nf.name = COALESCE(NULLIF(n.folder, ''), 'Other');

-- 5. Drop the old text column — folder_id is now the source of truth
ALTER TABLE notes DROP COLUMN IF EXISTS folder;
