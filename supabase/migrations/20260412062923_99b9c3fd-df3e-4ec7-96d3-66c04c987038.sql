
CREATE TABLE public.admin_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  tab text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',
  description text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  lovable_prompt text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_enhancements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admin_enhancements"
ON public.admin_enhancements
FOR ALL
TO public
USING (true)
WITH CHECK (true);
