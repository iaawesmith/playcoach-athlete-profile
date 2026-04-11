CREATE TABLE public.admin_reference_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_reference_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admin_reference_links"
  ON public.admin_reference_links
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);