
CREATE TABLE public.admin_reference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_reference_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admin_reference_cache"
ON public.admin_reference_cache
FOR ALL
TO public
USING (true)
WITH CHECK (true);
