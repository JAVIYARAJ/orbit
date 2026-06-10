-- Contact replies: stores each email reply an admin sends to a contact_submissions row.
-- Written/read only by the service-role `admin` Edge Function — no public policies.

CREATE TABLE IF NOT EXISTS public.contact_replies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  to_email      text NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,            -- plain-text message the admin typed
  sent_by       uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_replies ENABLE ROW LEVEL SECURITY;
-- No policies: RLS denies all by default. The admin Edge Function uses the
-- service-role key (bypasses RLS) after verifying the caller is an admin.

CREATE INDEX IF NOT EXISTS idx_contact_replies_submission_id
  ON public.contact_replies(submission_id);
CREATE INDEX IF NOT EXISTS idx_contact_replies_sent_by
  ON public.contact_replies(sent_by);
