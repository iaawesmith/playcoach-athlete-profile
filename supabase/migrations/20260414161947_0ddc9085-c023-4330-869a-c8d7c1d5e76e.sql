ALTER TABLE public.athlete_lab_nodes ADD COLUMN det_frequency_solo integer NOT NULL DEFAULT 2;
ALTER TABLE public.athlete_lab_nodes ADD COLUMN det_frequency_defender integer NOT NULL DEFAULT 1;
ALTER TABLE public.athlete_lab_nodes ADD COLUMN det_frequency_multiple integer NOT NULL DEFAULT 1;