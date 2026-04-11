ALTER TABLE public.athlete_lab_nodes
ADD COLUMN status text NOT NULL DEFAULT 'draft'
CHECK (status IN ('draft', 'live'));