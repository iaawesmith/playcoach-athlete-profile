-- Add version column to nodes
ALTER TABLE public.athlete_lab_nodes
ADD COLUMN node_version integer NOT NULL DEFAULT 1;

-- Create results table
CREATE TABLE public.athlete_lab_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES public.athlete_lab_nodes(id) ON DELETE CASCADE,
  node_version integer NOT NULL DEFAULT 1,
  video_description text NOT NULL DEFAULT '',
  overall_score integer,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to athlete_lab_results"
ON public.athlete_lab_results
FOR ALL
USING (true)
WITH CHECK (true);