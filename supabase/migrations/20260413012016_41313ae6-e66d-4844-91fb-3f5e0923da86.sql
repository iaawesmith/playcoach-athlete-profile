
-- Create athlete_uploads table
CREATE TABLE public.athlete_uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid NOT NULL,
  node_id uuid REFERENCES public.athlete_lab_nodes(id),
  node_version int,
  video_url text,
  start_seconds float,
  end_seconds float,
  camera_angle text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.athlete_uploads ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own rows
CREATE POLICY "Users can insert their own uploads"
ON public.athlete_uploads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = athlete_id);

-- Authenticated users can view their own uploads
CREATE POLICY "Users can view their own uploads"
ON public.athlete_uploads
FOR SELECT
TO authenticated
USING (auth.uid() = athlete_id);

-- Service role can select all rows (for Edge Functions)
CREATE POLICY "Service role can select all uploads"
ON public.athlete_uploads
FOR SELECT
TO service_role
USING (true);

-- Service role can update all rows (for Edge Functions)
CREATE POLICY "Service role can update all uploads"
ON public.athlete_uploads
FOR UPDATE
TO service_role
USING (true);
