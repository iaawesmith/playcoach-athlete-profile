CREATE TABLE public.coaching_model_settings (
  id boolean PRIMARY KEY DEFAULT true,
  provider text NOT NULL,
  model text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coaching_model_settings_single_row CHECK (id = true)
);
GRANT ALL ON public.coaching_model_settings TO service_role;
ALTER TABLE public.coaching_model_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY coaching_model_settings_service_role ON public.coaching_model_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.coaching_model_settings (id, provider, model) VALUES (true, 'anthropic', 'claude-sonnet-4-5-20250929');
ALTER TABLE public.athlete_lab_nodes ADD COLUMN coaching_provider text, ADD COLUMN coaching_model text;
COMMENT ON COLUMN public.athlete_lab_nodes.coaching_model IS 'Optional per-node coaching model override; NULL uses coaching_model_settings.';