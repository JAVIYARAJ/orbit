-- 1. Create task_statuses table
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid        NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  key            text        NOT NULL,
  label          text        NOT NULL,
  color          text        NOT NULL DEFAULT '#888888',
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workstation_id, key)
);

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_select" ON public.task_statuses FOR SELECT
  USING (workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid()));

CREATE POLICY "ts_insert" ON public.task_statuses FOR INSERT
  WITH CHECK (workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));

CREATE POLICY "ts_update" ON public.task_statuses FOR UPDATE
  USING (workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));

CREATE POLICY "ts_delete" ON public.task_statuses FOR DELETE
  USING (workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));

-- 2. Seed defaults for all existing workstations
INSERT INTO public.task_statuses (workstation_id, key, label, color, sort_order)
SELECT w.id, s.key, s.label, s.color, s.sort_order
FROM public.workstations w
CROSS JOIN (VALUES
  ('backlog',  'Backlog',      '#555555', 0),
  ('todo',     'To Do',        '#888888', 1),
  ('progress', 'In Progress',  '#0099ff', 2),
  ('review',   'Review',       '#f59e0b', 3),
  ('done',     'Done',         '#22c55e', 4)
) AS s(key, label, color, sort_order)
ON CONFLICT (workstation_id, key) DO NOTHING;

-- 3. Trigger: seed defaults on new workstation
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_statuses_on_ws_create ON public.workstations;
CREATE TRIGGER seed_statuses_on_ws_create
  AFTER INSERT ON public.workstations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_statuses();

-- 4. RPC: create status
CREATE OR REPLACE FUNCTION public.create_task_status(
  p_workstation_id uuid,
  p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row task_statuses%rowtype;
  v_max integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_max FROM task_statuses WHERE workstation_id = p_workstation_id;
  INSERT INTO task_statuses (workstation_id, key, label, color, sort_order)
  VALUES (p_workstation_id, p_data->>'key', p_data->>'label', COALESCE(p_data->>'color','#888888'), COALESCE((p_data->>'sort_order')::int, v_max))
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 5. RPC: update status (label + color only; key is immutable)
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_status_id uuid,
  p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row task_statuses%rowtype;
BEGIN
  UPDATE task_statuses SET
    label = COALESCE(p_data->>'label', label),
    color = COALESCE(p_data->>'color', color)
  WHERE id = p_status_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 6. RPC: delete status
CREATE OR REPLACE FUNCTION public.delete_task_status(
  p_status_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM task_statuses
  WHERE id = p_status_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role IN ('owner','admin'));
END;
$$;

-- 7. RPC: reorder statuses (jsonb array of uuid strings in new order)
CREATE OR REPLACE FUNCTION public.reorder_task_statuses(
  p_workstation_id uuid,
  p_ordered_ids    jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id  text;
  v_idx integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(p_ordered_ids) LOOP
    UPDATE task_statuses SET sort_order = v_idx WHERE id = v_id::uuid AND workstation_id = p_workstation_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

-- 8. Rebuild load_workstation_data to include statuses
CREATE OR REPLACE FUNCTION public.load_workstation_data(
  p_workstation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN jsonb_build_object(
    'statuses', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM task_statuses WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
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
