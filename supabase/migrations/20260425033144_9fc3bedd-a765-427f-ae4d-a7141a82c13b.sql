ALTER TABLE public.athlete_lab_nodes
ADD COLUMN IF NOT EXISTS phase_context_mode text NOT NULL DEFAULT 'compact';