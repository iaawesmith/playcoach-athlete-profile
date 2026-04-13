
CREATE TABLE public.pipeline_setup_checklist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id text NOT NULL UNIQUE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_setup_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to pipeline_setup_checklist"
ON public.pipeline_setup_checklist
FOR ALL
TO public
USING (true)
WITH CHECK (true);

INSERT INTO public.pipeline_setup_checklist (item_id, completed, completed_at)
VALUES ('athlete_uploads_created', true, now());
