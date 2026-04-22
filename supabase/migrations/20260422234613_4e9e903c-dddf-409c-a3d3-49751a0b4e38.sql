ALTER TABLE public.athlete_uploads
ADD COLUMN IF NOT EXISTS analysis_context jsonb NOT NULL DEFAULT '{}'::jsonb;