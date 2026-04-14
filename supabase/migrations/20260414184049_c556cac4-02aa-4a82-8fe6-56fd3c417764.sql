CREATE TABLE public.admin_implementation_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_implementation_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admin_implementation_docs"
ON public.admin_implementation_docs
FOR ALL
USING (true)
WITH CHECK (true);