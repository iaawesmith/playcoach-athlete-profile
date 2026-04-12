
ALTER TABLE public.athlete_lab_nodes
ADD COLUMN solution_class text NOT NULL DEFAULT '',
ADD COLUMN reference_calibrations jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN reference_filming_instructions text NOT NULL DEFAULT '',
ADD COLUMN reference_fallback_behavior text NOT NULL DEFAULT 'pixel_warning';
