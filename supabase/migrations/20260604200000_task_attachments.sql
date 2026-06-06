-- Task attachments (Cloudinary-backed). Metadata lives here; the file lives in
-- Cloudinary. comment_id NULL = task-level attachment, else attached to a comment.

CREATE TABLE IF NOT EXISTS task_attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  task_id        uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id     uuid REFERENCES task_comments(id) ON DELETE CASCADE,
  provider       text NOT NULL DEFAULT 'cloudinary',
  public_id      text NOT NULL,
  resource_type  text NOT NULL DEFAULT 'image',
  secure_url     text NOT NULL,
  file_name      text NOT NULL,
  mime_type      text,
  format         text,
  size_bytes     bigint,
  width          int,
  height         int,
  uploaded_by    uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx    ON task_attachments (task_id);
CREATE INDEX IF NOT EXISTS task_attachments_comment_idx ON task_attachments (comment_id);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta_member ON task_attachments FOR ALL
  USING      (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = task_attachments.workstation_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = task_attachments.workstation_id AND wm.user_id = auth.uid()));

-- Record an uploaded attachment (any workspace member, like commenting).
CREATE OR REPLACE FUNCTION public.add_task_attachment(p_task_id uuid, p_comment_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_row task_attachments%rowtype;
BEGIN
  SELECT workstation_id INTO v_ws FROM tasks
   WHERE id = p_task_id AND deleted_at IS NULL
     AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO task_attachments(workstation_id, task_id, comment_id, provider, public_id, resource_type,
    secure_url, file_name, mime_type, format, size_bytes, width, height, uploaded_by)
  VALUES (v_ws, p_task_id, p_comment_id, coalesce(p_data->>'provider','cloudinary'),
    p_data->>'public_id', coalesce(p_data->>'resource_type','image'), p_data->>'secure_url',
    p_data->>'file_name', nullif(p_data->>'mime_type',''), nullif(p_data->>'format',''),
    nullif(p_data->>'size_bytes','')::bigint, nullif(p_data->>'width','')::int, nullif(p_data->>'height','')::int,
    auth.uid())
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_task_attachments(p_task_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'taskId', a.task_id, 'commentId', a.comment_id, 'provider', a.provider,
    'publicId', a.public_id, 'resourceType', a.resource_type, 'secureUrl', a.secure_url,
    'fileName', a.file_name, 'mimeType', a.mime_type, 'format', a.format, 'sizeBytes', a.size_bytes,
    'width', a.width, 'height', a.height, 'uploadedBy', a.uploaded_by,
    'uploaderName', coalesce(p.name, p.email, 'Unknown'), 'uploaderAvatarUrl', p.avatar_url,
    'createdAt', a.created_at
  ) ORDER BY a.created_at), '[]'::jsonb)
  FROM task_attachments a
  LEFT JOIN profiles p ON p.id = a.uploaded_by
  WHERE a.task_id = p_task_id
    AND a.workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
$function$;

GRANT EXECUTE ON FUNCTION public.add_task_attachment(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_attachments(uuid) TO authenticated;
