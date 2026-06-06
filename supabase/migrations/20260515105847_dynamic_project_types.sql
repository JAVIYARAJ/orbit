-- ── Table ──────────────────────────────────────────────────────────
CREATE TABLE public.project_types (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid        NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  label          text        NOT NULL,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read project_types"
  ON public.project_types FOR SELECT
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "owners/admins can write project_types"
  ON public.project_types FOR ALL
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ── Seed defaults for every existing workstation ───────────────────
INSERT INTO public.project_types (workstation_id, label, sort_order)
SELECT id, label, sort_order FROM public.workstations
CROSS JOIN (VALUES
  ('Client / Freelance', 0),
  ('Indie Product',      1),
  ('Client / Retainer',  2),
  ('Tool / Internal',    3)
) AS defaults(label, sort_order)
ON CONFLICT DO NOTHING;

-- ── Update trigger function to also seed project types ─────────────
CREATE OR REPLACE FUNCTION public.seed_default_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.task_statuses (workstation_id, key, label, color, sort_order) VALUES
    (NEW.id, 'backlog',  'Backlog',     '#555555', 0),
    (NEW.id, 'todo',     'To Do',       '#888888', 1),
    (NEW.id, 'progress', 'In Progress', '#0099ff', 2),
    (NEW.id, 'review',   'Review',      '#f59e0b', 3),
    (NEW.id, 'done',     'Done',        '#22c55e', 4)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.project_types (workstation_id, label, sort_order) VALUES
    (NEW.id, 'Client / Freelance', 0),
    (NEW.id, 'Indie Product',      1),
    (NEW.id, 'Client / Retainer',  2),
    (NEW.id, 'Tool / Internal',    3)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── CRUD RPCs ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_project_type(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row project_types%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO project_types(workstation_id, label, sort_order)
  VALUES (
    p_workstation_id,
    p_data->>'label',
    coalesce((p_data->>'sort_order')::int, 0)
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_type(p_type_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row project_types%rowtype;
BEGIN
  UPDATE project_types SET
    label      = coalesce(p_data->>'label', label),
    sort_order = coalesce((p_data->>'sort_order')::int, sort_order)
  WHERE id = p_type_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_type(p_type_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM project_types
  WHERE id = p_type_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_project_types(p_workstation_id uuid, p_ordered_ids jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id  text;
  v_idx integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  FOR v_id IN SELECT jsonb_array_elements_text(p_ordered_ids) LOOP
    UPDATE project_types SET sort_order = v_idx
    WHERE id = v_id::uuid AND workstation_id = p_workstation_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

-- ── Include project_types in load_workstation_data ─────────────────
CREATE OR REPLACE FUNCTION public.load_workstation_data(p_workstation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN jsonb_build_object(
    'statuses', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM task_statuses WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'project_types', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM project_types WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM projects WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tasks WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'notes', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM notes WHERE workstation_id = p_workstation_id ORDER BY pinned DESC, updated_at DESC) r
    ),
    'vault', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM vault WHERE workstation_id = p_workstation_id ORDER BY updated_at DESC) r
    ),
    'learning', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM learning WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'email_templates', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM email_templates WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'gantt_tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM gantt_tasks WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'timer_sessions', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM timer_sessions WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    )
  );
END;
$$;
