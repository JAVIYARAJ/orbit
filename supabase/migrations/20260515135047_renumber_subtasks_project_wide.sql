-- Renumber ALL tasks (parents + subtasks) with a single project-wide counter.
-- Order by created_at so existing parents keep their numbers and subtasks continue from there.
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
)
UPDATE tasks t
SET task_id = r.prefix || '-' || r.rn::text
FROM ranked r
WHERE t.id = r.id;
