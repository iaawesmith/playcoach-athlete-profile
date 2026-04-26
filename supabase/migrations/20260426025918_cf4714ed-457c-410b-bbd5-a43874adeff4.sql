DO $$
DECLARE
  expected_hash TEXT := 'ad8bb95c7d6292b73905efe657df911ecbad04a5d5253a94742eb802788a3201';
  actual_hash TEXT;
  drop_cols TEXT[] := ARRAY['pro_mechanics','llm_tone','det_frequency','solution_class','performance_mode','tracking_enabled','reference_object','reference_filming_instructions'];
  col TEXT;
  cov_count INT;
BEGIN
  -- Guard 1: backup integrity (hash must match pre-migration baseline)
  SELECT encode(sha256(convert_to(
    string_agg(
      node_id::text || '|' ||
      source_column || '|' ||
      COALESCE(content, '') || '|' ||
      COALESCE(audit_pattern, '') || '|' ||
      COALESCE(disposition, '') || '|' ||
      COALESCE(audit_reason, '') || '|' ||
      COALESCE(original_intent, '') || '|' ||
      COALESCE(slice, ''),
      E'\n' ORDER BY node_id, source_column
    ), 'UTF8')
  ), 'hex')
  INTO actual_hash
  FROM athlete_lab_nodes_phase1c_backup;

  IF actual_hash IS DISTINCT FROM expected_hash THEN
    RAISE EXCEPTION 'Slice E.2 ABORT — backup integrity hash mismatch. Expected %, got %', expected_hash, actual_hash;
  END IF;

  -- Guard 2: every column to be dropped has backup coverage
  FOREACH col IN ARRAY drop_cols LOOP
    SELECT COUNT(*) INTO cov_count FROM athlete_lab_nodes_phase1c_backup WHERE source_column = col;
    IF cov_count = 0 THEN
      RAISE EXCEPTION 'Slice E.2 ABORT — no backup coverage for column %', col;
    END IF;
  END LOOP;

  RAISE NOTICE 'Slice E.2 guards passed (backup hash %, all 8 columns covered). Proceeding with drops.', actual_hash;
END $$;

ALTER TABLE public.athlete_lab_nodes
  DROP COLUMN pro_mechanics,
  DROP COLUMN llm_tone,
  DROP COLUMN det_frequency,
  DROP COLUMN solution_class,
  DROP COLUMN performance_mode,
  DROP COLUMN tracking_enabled,
  DROP COLUMN reference_object,
  DROP COLUMN reference_filming_instructions;