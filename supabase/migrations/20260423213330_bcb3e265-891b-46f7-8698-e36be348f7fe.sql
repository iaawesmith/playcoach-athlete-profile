-- Simplify Slant node: deactivate 2 of 6 metrics, persist proportional segmentation,
-- and fold pro_mechanics content into matching phase descriptions. Fully reversible —
-- no records or fields are deleted; pro_mechanics JSONB is left intact.

DO $$
DECLARE
  slant_id uuid := '75ed4b18-8a22-440e-9a23-b86204956056';
  active_metrics jsonb;
  active_set jsonb := '["Break Angle","Release Speed","Hands Extension at Catch","Separation Distance"]'::jsonb;
  current_phases jsonb;
  current_mechanics jsonb;
  new_phases jsonb := '[]'::jsonb;
  phase jsonb;
  mech jsonb;
  appended_desc text;
  cues text;
  separator text := E'\n\n— Coaching cues —\n';
BEGIN
  -- 1) Tag each metric with active flag based on name membership in the active_set
  SELECT jsonb_agg(
    CASE
      WHEN active_set ? (m->>'name')
        THEN jsonb_set(m, '{active}', 'true'::jsonb, true)
      ELSE jsonb_set(m, '{active}', 'false'::jsonb, true)
    END
    ORDER BY ord
  )
  INTO active_metrics
  FROM (
    SELECT m, ord
    FROM athlete_lab_nodes,
         jsonb_array_elements(key_metrics) WITH ORDINALITY AS t(m, ord)
    WHERE id = slant_id
  ) sub;

  -- 2) Build new phase_breakdown by appending matching mechanics content into each phase description
  SELECT phase_breakdown, pro_mechanics
  INTO current_phases, current_mechanics
  FROM athlete_lab_nodes
  WHERE id = slant_id;

  FOR phase IN SELECT * FROM jsonb_array_elements(current_phases)
  LOOP
    -- Concat all mechanics sections for this phase_id (handles multiple sections per phase)
    SELECT string_agg(trim(both E' \n' from (m->>'content')), E'\n\n')
    INTO cues
    FROM jsonb_array_elements(COALESCE(current_mechanics, '[]'::jsonb)) AS m
    WHERE m->>'phase_id' = phase->>'id'
      AND COALESCE(m->>'content', '') <> '';

    IF cues IS NOT NULL AND cues <> '' THEN
      -- Only append if not already appended (idempotent guard)
      IF position('— Coaching cues —' in COALESCE(phase->>'description','')) = 0 THEN
        appended_desc := COALESCE(phase->>'description','') || separator || cues;
        phase := jsonb_set(phase, '{description}', to_jsonb(appended_desc), true);
      END IF;
    END IF;

    new_phases := new_phases || phase;
  END LOOP;

  -- 3) Persist all three changes
  UPDATE athlete_lab_nodes
  SET
    key_metrics = active_metrics,
    phase_breakdown = new_phases,
    segmentation_method = 'proportional',
    updated_at = now()
  WHERE id = slant_id;
END $$;