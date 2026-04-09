
ALTER TABLE public.athlete_lab_nodes
ADD COLUMN position text DEFAULT NULL;

UPDATE public.athlete_lab_nodes SET position = 'WR' WHERE position IS NULL;
