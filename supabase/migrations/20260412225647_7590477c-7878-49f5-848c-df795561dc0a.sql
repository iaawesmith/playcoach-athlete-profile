ALTER TABLE public.athlete_lab_nodes
  ADD COLUMN llm_tone text NOT NULL DEFAULT 'direct',
  ADD COLUMN llm_max_words integer NOT NULL DEFAULT 150,
  ADD COLUMN llm_system_instructions text NOT NULL DEFAULT '';