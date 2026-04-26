
-- =====================================================================
-- Phase 1c.2 — Slice D bundled migration
-- Internal order per Refinement 5: D.2 (CHECK) → D.3 (ref_cal strip) → D.4 (cam_guidelines strip)
-- All wrapped in a single transaction (Postgres DDL is transactional).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- D.2 — phase_context_mode CHECK constraint (smallest blast radius first)
-- Pre-flight confirmed Slant = 'compact' (in allowlist).
-- ---------------------------------------------------------------------
ALTER TABLE public.athlete_lab_nodes
  ADD CONSTRAINT athlete_lab_nodes_phase_context_mode_check
  CHECK (phase_context_mode IN ('full', 'compact', 'names_only'));

-- ---------------------------------------------------------------------
-- D.3 — reference_calibrations[] sub-field strip
-- Strip 6 sub-fields per element; keep camera_angle + pixels_per_yard.
-- Idempotent: if a sub-field is already absent, jsonb - 'key' is a no-op.
-- ---------------------------------------------------------------------
UPDATE public.athlete_lab_nodes
SET reference_calibrations = (
  SELECT jsonb_agg(
    (elem
      - 'reference_object_name'
      - 'known_size_yards'
      - 'known_size_unit'
      - 'placement_instructions'
      - 'filming_instructions'
      - 'calibration_notes'
    )
    ORDER BY ord
  )
  FROM jsonb_array_elements(reference_calibrations) WITH ORDINALITY AS t(elem, ord)
)
WHERE jsonb_typeof(reference_calibrations) = 'array'
  AND jsonb_array_length(reference_calibrations) > 0;

-- ---------------------------------------------------------------------
-- D.4 — camera_guidelines.skill_specific_filming_notes strip
-- Pre-flight confirmed all existing nodes are json_shaped (no plain_text branch).
-- Guard: only apply when value parses as a JSON object (forward-compat per
-- camera-guidelines-preflight doc §40-41).
-- camera_guidelines is declared `text` in the table; cast for the operation.
-- ---------------------------------------------------------------------
UPDATE public.athlete_lab_nodes
SET camera_guidelines = (camera_guidelines::jsonb - 'skill_specific_filming_notes')::text
WHERE camera_guidelines IS NOT NULL
  AND camera_guidelines <> ''
  AND left(ltrim(camera_guidelines), 1) = '{'
  AND jsonb_typeof(camera_guidelines::jsonb) = 'object';

COMMIT;
