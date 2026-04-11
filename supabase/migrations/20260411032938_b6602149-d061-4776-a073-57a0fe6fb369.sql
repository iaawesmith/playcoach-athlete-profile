ALTER TABLE public.athlete_lab_nodes
ADD COLUMN clip_duration_min integer NOT NULL DEFAULT 5,
ADD COLUMN clip_duration_max integer NOT NULL DEFAULT 30;