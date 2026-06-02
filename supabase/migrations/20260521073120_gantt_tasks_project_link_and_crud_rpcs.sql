-- 1. Link gantt tasks to projects
ALTER TABLE public.gantt_tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 2. create_gantt_task
CREATE OR REPLACE FUNCTION public.create_gantt_task(
  p_workstation_id uuid,
  p_project_id     uuid,
  p_name           text,
  p_sub            text DEFAULT '',
  p_start_week     int  DEFAULT 1,
  p_end_week       int  DEFAULT 2,
  p_status         text DEFAULT 'planning'
) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_sort int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort
  FROM gantt_tasks
  WHERE workstation_id = p_workstation_id AND project_id = p_project_id;

  INSERT INTO gantt_tasks (workstation_id, project_id, user_id, name, sub, start_week, end_week, status, sort_order)
  VALUES (p_workstation_id, p_project_id, auth.uid(), p_name, p_sub, p_start_week, p_end_week, p_status, v_sort)
  RETURNING id INTO v_id;

  RETURN (SELECT row_to_json(r)::jsonb FROM (SELECT * FROM gantt_tasks WHERE id = v_id) r);
END;
$$;

-- 3. update_gantt_task
CREATE OR REPLACE FUNCTION public.update_gantt_task(
  p_id         uuid,
  p_name       text,
  p_sub        text,
  p_start_week int,
  p_end_week   int,
  p_status     text
) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  UPDATE gantt_tasks
  SET name = p_name, sub = p_sub, start_week = p_start_week,
      end_week = p_end_week, status = p_status
  WHERE id = p_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN (SELECT row_to_json(r)::jsonb FROM (SELECT * FROM gantt_tasks WHERE id = p_id) r);
END;
$$;

-- 4. delete_gantt_task
CREATE OR REPLACE FUNCTION public.delete_gantt_task(p_id uuid)
RETURNS void
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM gantt_tasks
  WHERE id = p_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;
