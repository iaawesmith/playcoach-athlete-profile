
ALTER TABLE public.athlete_lab_nodes
ADD COLUMN performance_mode text NOT NULL DEFAULT 'balanced',
ADD COLUMN det_frequency integer NOT NULL DEFAULT 7,
ADD COLUMN tracking_enabled boolean NOT NULL DEFAULT true;
