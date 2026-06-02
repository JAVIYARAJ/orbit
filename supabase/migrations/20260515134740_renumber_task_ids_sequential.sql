-- Step 1: Renumber parent tasks → PREFIX-N (e.g. POC-1, SNA-1)
WITH ranked AS (
  SELECT
    t.id,
    SUBSTRING(REGEXP_REPLACE(UPPER(COALESCE(p.name, t.project_short_id)), '[^A-Z0-9]', '', 'g'), 1, 3) AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY t.project_short_id, t.workstation_id
      ORDER BY t.created_at ASC, t.id ASC
    ) AS rn
  FROM tasks t
  LEFT JOIN projects p
    ON p.short_id = t.project_short_id
    AND p.workstation_id = t.workstation_id
  WHERE t.parent_task_id IS NULL
)
UPDATE tasks t
SET task_id = r.prefix || '-' || r.rn::text
FROM ranked r
WHERE t.id = r.id;

-- Step 2: Renumber subtasks → PARENT_TASK_ID-S1, S2… using the already-updated parent task_id
WITH ranked AS (
  SELECT
    t.id,
    parent.task_id AS parent_new_id,
    ROW_NUMBER() OVER (
      PARTITION BY t.parent_task_id
      ORDER BY t.created_at ASC, t.id ASC
    ) AS rn
  FROM tasks t
  JOIN tasks parent ON parent.id = t.parent_task_id
  WHERE t.parent_task_id IS NOT NULL
)
UPDATE tasks t
SET task_id = r.parent_new_id || '-S' || r.rn::text
FROM ranked r
WHERE t.id = r.id;
