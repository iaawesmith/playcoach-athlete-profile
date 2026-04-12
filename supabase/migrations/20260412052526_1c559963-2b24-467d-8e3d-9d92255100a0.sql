ALTER TABLE public.athlete_lab_nodes
ADD COLUMN confidence_handling text NOT NULL DEFAULT 'skip',
ADD COLUMN min_metrics_threshold integer NOT NULL DEFAULT 50,
ADD COLUMN score_bands jsonb NOT NULL DEFAULT '{"elite":"Elite","varsity":"Varsity Ready","developing":"Developing","needs_work":"Needs Work"}'::jsonb;