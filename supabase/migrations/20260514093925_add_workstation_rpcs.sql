-- ═══════════════════════════════════════════════════════════════════
-- WORKSTATION RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── get_my_workstations ─────────────────────────────────────────
-- Returns all workstations the calling user belongs to.
CREATE OR REPLACE FUNCTION get_my_workstations()
RETURNS TABLE(
  id         uuid,
  name       text,
  color      text,
  owner_id   uuid,
  role       text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT w.id, w.name, w.color, w.owner_id, wm.role, w.created_at
    FROM   workstations w
    JOIN   workstation_members wm ON wm.workstation_id = w.id
    WHERE  wm.user_id = auth.uid()
    ORDER  BY wm.joined_at;
END;
$$;

-- ─── create_my_workstation ────────────────────────────────────────
-- Creates a workstation, adds caller as owner, updates profile.
-- Atomic — all three writes happen or none do.
CREATE OR REPLACE FUNCTION create_my_workstation(p_name text, p_color text DEFAULT '#0099ff')
RETURNS TABLE(
  id         uuid,
  name       text,
  color      text,
  owner_id   uuid,
  role       text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  INSERT INTO workstations(owner_id, name, color)
  VALUES (auth.uid(), trim(p_name), p_color)
  RETURNING id INTO v_ws_id;

  INSERT INTO workstation_members(workstation_id, user_id, role)
  VALUES (v_ws_id, auth.uid(), 'owner');

  UPDATE profiles SET active_workstation_id = v_ws_id WHERE id = auth.uid();

  RETURN QUERY
    SELECT w.id, w.name, w.color, w.owner_id, wm.role, w.created_at
    FROM   workstations w
    JOIN   workstation_members wm ON wm.workstation_id = w.id
    WHERE  w.id = v_ws_id;
END;
$$;

-- ─── switch_active_workstation ────────────────────────────────────
-- Validates membership then updates profile's active_workstation_id.
CREATE OR REPLACE FUNCTION switch_active_workstation(p_workstation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE  workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'access_denied: not a member of this workstation';
  END IF;
  UPDATE profiles SET active_workstation_id = p_workstation_id WHERE id = auth.uid();
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- DATA RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── load_workstation_data ────────────────────────────────────────
-- Single round-trip: returns all 8 entity collections as one jsonb.
CREATE OR REPLACE FUNCTION load_workstation_data(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE  workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN jsonb_build_object(
    'projects', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM projects
            WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'tasks', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tasks
            WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'notes', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM notes WHERE workstation_id = p_workstation_id
            ORDER BY pinned DESC, updated_at DESC) r
    ),
    'vault', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM vault
            WHERE workstation_id = p_workstation_id ORDER BY updated_at DESC) r
    ),
    'learning', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM learning
            WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'email_templates', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM email_templates
            WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'gantt_tasks', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM gantt_tasks
            WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'timer_sessions', (
      SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM timer_sessions
            WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    )
  );
END;
$$;

-- ─── check_workstation_empty ──────────────────────────────────────
CREATE OR REPLACE FUNCTION check_workstation_empty(p_workstation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE  workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN NOT EXISTS (SELECT 1 FROM projects WHERE workstation_id = p_workstation_id);
END;
$$;

-- ─── seed_workstation_data ────────────────────────────────────────
-- Bulk-inserts demo data for a brand-new workstation.
-- Data arrives as a single jsonb object keyed by entity type.
CREATE OR REPLACE FUNCTION seed_workstation_data(p_workstation_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE  workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  -- Projects
  INSERT INTO projects(user_id, workstation_id, short_id, name, client, type,
    start_date, end_date, status, stack, progress, tasks_count, open_tasks,
    hours_logged, hours_est, repo, budget)
  SELECT auth.uid(), p_workstation_id,
    j.short_id, j.name, j.client, j.type,
    nullif(j.start_date,'')::date, nullif(j.end_date,'')::date,
    j.status, j.stack, j.progress, j.tasks_count, j.open_tasks,
    j.hours_logged, j.hours_est, j.repo, j.budget
  FROM jsonb_to_recordset(p_data->'projects') AS j(
    short_id text, name text, client text, type text,
    start_date text, end_date text, status text,
    stack text[], progress int, tasks_count int, open_tasks int,
    hours_logged numeric, hours_est numeric, repo text, budget text
  );

  -- Tasks
  INSERT INTO tasks(user_id, workstation_id, task_id, project_short_id, col,
    priority, title, due_date, est_hours, actual_hours, tags, subs_total, subs_done)
  SELECT auth.uid(), p_workstation_id,
    j.task_id, j.project_short_id, j.col,
    j.priority, j.title, nullif(j.due_date,'')::date,
    j.est_hours, j.actual_hours, j.tags, j.subs_total, j.subs_done
  FROM jsonb_to_recordset(p_data->'tasks') AS j(
    task_id text, project_short_id text, col text,
    priority int, title text, due_date text,
    est_hours numeric, actual_hours numeric,
    tags text[], subs_total int, subs_done int
  );

  -- Notes
  INSERT INTO notes(user_id, workstation_id, title, folder, tags, pinned, body)
  SELECT auth.uid(), p_workstation_id,
    j.title, j.folder, j.tags, j.pinned, j.body
  FROM jsonb_to_recordset(p_data->'notes') AS j(
    title text, folder text, tags text[], pinned boolean, body text
  );

  -- Vault
  INSERT INTO vault(user_id, workstation_id, cat, name, value)
  SELECT auth.uid(), p_workstation_id, j.cat, j.name, j.value
  FROM jsonb_to_recordset(p_data->'vault') AS j(cat text, name text, value text);

  -- Learning
  INSERT INTO learning(user_id, workstation_id, status, topic, cat,
    est_hours, actual_hours, link, note, needs_review, progress, last_reviewed)
  SELECT auth.uid(), p_workstation_id,
    j.status, j.topic, j.cat,
    j.est_hours, j.actual_hours, j.link, j.note,
    j.needs_review, j.progress, nullif(j.last_reviewed,'')::date
  FROM jsonb_to_recordset(p_data->'learning') AS j(
    status text, topic text, cat text,
    est_hours numeric, actual_hours numeric,
    link text, note text, needs_review boolean,
    progress int, last_reviewed text
  );

  -- Email templates
  INSERT INTO email_templates(user_id, workstation_id, template_id, cat, name, body)
  SELECT auth.uid(), p_workstation_id,
    j.template_id, j.cat, j.name, j.body
  FROM jsonb_to_recordset(p_data->'email_templates') AS j(
    template_id text, cat text, name text, body text
  );

  -- Gantt tasks
  INSERT INTO gantt_tasks(user_id, workstation_id, name, sub,
    start_week, end_week, status, sort_order)
  SELECT auth.uid(), p_workstation_id,
    j.name, j.sub, j.start_week, j.end_week, j.status, j.sort_order
  FROM jsonb_to_recordset(p_data->'gantt_tasks') AS j(
    name text, sub text, start_week numeric, end_week numeric,
    status text, sort_order int
  );

  -- Timer sessions
  INSERT INTO timer_sessions(user_id, workstation_id, project_name, task_name,
    start_time, end_time, duration, is_live)
  SELECT auth.uid(), p_workstation_id,
    j.project_name, j.task_name, j.start_time, j.end_time, j.duration, j.is_live
  FROM jsonb_to_recordset(p_data->'timer_sessions') AS j(
    project_name text, task_name text, start_time text,
    end_time text, duration text, is_live boolean
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- CRUD RPCs — Projects
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_project(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row projects%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO projects(user_id, workstation_id, short_id, name, client, type,
    start_date, end_date, status, stack, progress, tasks_count, open_tasks,
    hours_logged, hours_est, repo, budget)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'short_id', p_data->>'name',
    coalesce(p_data->>'client',''), coalesce(p_data->>'type',''),
    nullif(p_data->>'start_date','')::date, nullif(p_data->>'end_date','')::date,
    p_data->>'status',
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    (p_data->>'progress')::int, (p_data->>'tasks_count')::int, (p_data->>'open_tasks')::int,
    (p_data->>'hours_logged')::numeric, (p_data->>'hours_est')::numeric,
    coalesce(p_data->>'repo',''), coalesce(p_data->>'budget','')
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION update_project(p_short_id text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row projects%rowtype;
BEGIN
  UPDATE projects SET
    name         = p_data->>'name',
    client       = coalesce(p_data->>'client',''),
    type         = coalesce(p_data->>'type',''),
    start_date   = nullif(p_data->>'start_date','')::date,
    end_date     = nullif(p_data->>'end_date','')::date,
    status       = p_data->>'status',
    stack        = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    progress     = (p_data->>'progress')::int,
    tasks_count  = (p_data->>'tasks_count')::int,
    open_tasks   = (p_data->>'open_tasks')::int,
    hours_logged = (p_data->>'hours_logged')::numeric,
    hours_est    = (p_data->>'hours_est')::numeric,
    repo         = coalesce(p_data->>'repo',''),
    budget       = coalesce(p_data->>'budget','')
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION delete_project(p_short_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- CRUD RPCs — Tasks
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_task(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(user_id, workstation_id, task_id, project_short_id, col,
    priority, title, due_date, est_hours, actual_hours, tags, subs_total, subs_done)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id', p_data->>'project_short_id', coalesce(p_data->>'col','todo'),
    (p_data->>'priority')::int, p_data->>'title',
    nullif(p_data->>'due_date','')::date,
    coalesce((p_data->>'est_hours')::numeric, 0),
    coalesce((p_data->>'actual_hours')::numeric, 0),
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    coalesce((p_data->>'subs_total')::int, 0),
    coalesce((p_data->>'subs_done')::int, 0)
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION update_task(p_task_id text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  UPDATE tasks SET
    col          = coalesce(p_data->>'col', col),
    priority     = (p_data->>'priority')::int,
    title        = p_data->>'title',
    due_date     = nullif(p_data->>'due_date','')::date,
    est_hours    = coalesce((p_data->>'est_hours')::numeric, 0),
    actual_hours = coalesce((p_data->>'actual_hours')::numeric, 0),
    tags         = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    subs_total   = coalesce((p_data->>'subs_total')::int, 0),
    subs_done    = coalesce((p_data->>'subs_done')::int, 0)
  WHERE task_id = p_task_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION delete_task(p_task_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM tasks
  WHERE task_id = p_task_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- CRUD RPCs — Notes
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_note(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row notes%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO notes(user_id, workstation_id, title, folder, tags, pinned, body)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'title', coalesce(p_data->>'folder','General'),
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    coalesce((p_data->>'pinned')::boolean, false),
    coalesce(p_data->>'body','')
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION update_note(p_note_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row notes%rowtype;
BEGIN
  UPDATE notes SET
    title  = p_data->>'title',
    folder = coalesce(p_data->>'folder', folder),
    tags   = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    pinned = coalesce((p_data->>'pinned')::boolean, pinned),
    body   = coalesce(p_data->>'body', body)
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION delete_note(p_note_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM notes
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- CRUD RPCs — Vault
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_vault_item(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row vault%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO vault(user_id, workstation_id, cat, name, value)
  VALUES (auth.uid(), p_workstation_id, p_data->>'cat', p_data->>'name', p_data->>'value')
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION update_vault_item(p_item_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row vault%rowtype;
BEGIN
  UPDATE vault SET
    cat   = coalesce(p_data->>'cat', cat),
    name  = p_data->>'name',
    value = p_data->>'value',
    updated_at = current_date
  WHERE id = p_item_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION delete_vault_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM vault
  WHERE id = p_item_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- CRUD RPCs — Email Templates
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_email_template(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row email_templates%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO email_templates(user_id, workstation_id, template_id, cat, name, body)
  VALUES (
    auth.uid(), p_workstation_id,
    coalesce(p_data->>'template_id', 'tpl-' || extract(epoch from now())::text),
    p_data->>'cat', p_data->>'name', p_data->>'body'
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION update_email_template(p_template_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE email_templates SET
    cat  = coalesce(p_data->>'cat', cat),
    name = p_data->>'name',
    body = p_data->>'body'
  WHERE template_id = p_template_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION delete_email_template(p_template_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM email_templates
  WHERE template_id = p_template_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- GRANT EXECUTE to authenticated role
-- ═══════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION get_my_workstations()                          TO authenticated;
GRANT EXECUTE ON FUNCTION create_my_workstation(text, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION switch_active_workstation(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION load_workstation_data(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION check_workstation_empty(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workstation_data(uuid, jsonb)             TO authenticated;
GRANT EXECUTE ON FUNCTION create_project(uuid, jsonb)                    TO authenticated;
GRANT EXECUTE ON FUNCTION update_project(text, jsonb)                    TO authenticated;
GRANT EXECUTE ON FUNCTION delete_project(text)                           TO authenticated;
GRANT EXECUTE ON FUNCTION create_task(uuid, jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION update_task(text, jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION delete_task(text)                              TO authenticated;
GRANT EXECUTE ON FUNCTION create_note(uuid, jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION update_note(uuid, jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION delete_note(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION create_vault_item(uuid, jsonb)                 TO authenticated;
GRANT EXECUTE ON FUNCTION update_vault_item(uuid, jsonb)                 TO authenticated;
GRANT EXECUTE ON FUNCTION delete_vault_item(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION create_email_template(uuid, jsonb)             TO authenticated;
GRANT EXECUTE ON FUNCTION update_email_template(text, jsonb)             TO authenticated;
GRANT EXECUTE ON FUNCTION delete_email_template(text)                    TO authenticated;
