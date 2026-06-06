-- Audit / attribution foundation: an append-only activity_log plus per-record
-- created_by / updated_by / deleted_by stamps on the core content tables.
-- Additive only (new types, table, columns) — does not alter existing column types.

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE public.activity_action AS ENUM ('created','updated','deleted','restored');
CREATE TYPE public.activity_entity AS ENUM (
  'project','task','note','note_folder','vault_item','learning','gantt_task',
  'email_template','task_status','project_type','tag','task_priority',
  'member','invite','permission','workspace'
);

-- ── activity_log ─────────────────────────────────────────────────────────────
CREATE TABLE public.activity_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type    public.activity_entity NOT NULL,
  entity_id      uuid,
  entity_label   text NOT NULL DEFAULT '',
  action         public.activity_action NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_ws_created_idx ON public.activity_log (workstation_id, created_at DESC);
CREATE INDEX activity_log_entity_idx     ON public.activity_log (entity_type, entity_id);

-- RLS on, no policies: all access flows through SECURITY DEFINER functions.
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ── Writer helper ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_activity(
  p_workstation_id uuid,
  p_entity_type    public.activity_entity,
  p_entity_id      uuid,
  p_entity_label   text,
  p_action         public.activity_action,
  p_meta           jsonb DEFAULT '{}'::jsonb
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO activity_log (workstation_id, actor_id, entity_type, entity_id, entity_label, action, meta)
  VALUES (p_workstation_id, auth.uid(), p_entity_type, p_entity_id,
          COALESCE(p_entity_label, ''), p_action, COALESCE(p_meta, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never break the primary write.
  NULL;
END;
$function$;

-- ── Reader ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_activity(
  p_workstation_id uuid,
  p_limit          integer DEFAULT 50,
  p_entity_type    text DEFAULT NULL,
  p_entity_id      uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'createdAt') DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',             al.id,
      'action',         al.action,
      'entityType',     al.entity_type,
      'entityId',       al.entity_id,
      'entityLabel',    al.entity_label,
      'meta',           al.meta,
      'createdAt',      al.created_at,
      'actorId',        al.actor_id,
      'actorName',      COALESCE(p.name, p.email, 'Unknown'),
      'actorAvatar',    p.avatar,
      'actorAvatarUrl', p.avatar_url
    ) AS row
    FROM activity_log al
    LEFT JOIN profiles p ON p.id = al.actor_id
    WHERE al.workstation_id = p_workstation_id
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type::activity_entity)
      AND (p_entity_id   IS NULL OR al.entity_id   = p_entity_id)
    ORDER BY al.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  ) sub;

  RETURN v_result;
END;
$function$;

-- ── Stamp columns on the 7 core content tables ───────────────────────────────
ALTER TABLE public.projects        ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.tasks           ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.notes           ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.vault           ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.learning        ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.gantt_tasks     ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.email_templates ADD COLUMN created_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN updated_by uuid REFERENCES auth.users(id),
                                    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);

-- Backfill existing rows from the original owner (user_id).
UPDATE public.projects        SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.tasks           SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.notes           SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.vault           SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.learning        SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.gantt_tasks     SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
UPDATE public.email_templates SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
