-- Contact reply templates: one editable default reply per contact_submissions.type.
-- Global (not per-user). Read/written only by the service-role `admin` Edge Function.
-- Bodies must NOT include the greeting — renderReplyEmail() prepends "Hi {name},".
-- Placeholders {name} and {type} are substituted client-side when a template loads.

CREATE TABLE IF NOT EXISTS public.contact_reply_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL UNIQUE,            -- matches contact_submissions.type
  subject    text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.contact_reply_templates ENABLE ROW LEVEL SECURITY;
-- No policies: RLS denies all by default; the admin Edge Function uses the
-- service-role key (bypasses RLS) after verifying the caller is an admin.

CREATE INDEX IF NOT EXISTS idx_contact_reply_templates_updated_by
  ON public.contact_reply_templates(updated_by);

-- Seed the six contact types with sensible default templates.
INSERT INTO public.contact_reply_templates (type, subject, body) VALUES
  ('General query',  'Re: your {type} on Orbit',
   'Thanks for reaching out to Orbit! We''ve received your message and are happy to help. Let us know if there''s anything else we can do for you.'),
  ('Bug / Issue',    'Re: your {type} on Orbit',
   'Thanks for reporting this — sorry for the trouble it caused. Our team is looking into it and we''ll keep you posted as soon as there''s an update.'),
  ('Feature request','Re: your {type} on Orbit',
   'Thanks for the suggestion! We''ve noted your request and added it to our roadmap. We''ll let you know as it progresses.'),
  ('Feedback',       'Re: your {type} on Orbit',
   'Thank you for sharing your feedback — it genuinely helps us make Orbit better. We really appreciate you taking the time.'),
  ('Partnership',    'Re: your {type} on Orbit',
   'Thanks for your interest in partnering with Orbit! We''d love to learn more — could you share a few more details about what you have in mind?'),
  ('Other',          'Re: your {type} on Orbit',
   'Thanks for getting in touch with Orbit. We''ve received your message and will get back to you shortly.')
ON CONFLICT (type) DO NOTHING;
