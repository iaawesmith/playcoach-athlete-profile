-- PHASE-1C3-SLICE-E: R-07 backup disposition audit — slice-tag normalization

-- Step 1: Expand slice CHECK constraint to allow phase-slice form alongside legacy single letters.
-- Legacy single letters retained for 1c.2-E rows (deferred normalization tracked as V-1c.3-10).
ALTER TABLE public.athlete_lab_nodes_phase1c_backup
  DROP CONSTRAINT alb_phase1c_slice_chk;

ALTER TABLE public.athlete_lab_nodes_phase1c_backup
  ADD CONSTRAINT alb_phase1c_slice_chk CHECK (
    slice = ANY (ARRAY[
      -- Legacy single-letter form (1c.2 era; retained until V-1c.3-10 normalization)
      'B'::text, 'C'::text, 'D'::text, 'E'::text,
      -- Durable phase-slice form (1c.3 onward; F-OPS-4 sub-pattern 7 remediation)
      '1c.2-B'::text, '1c.2-C'::text, '1c.2-D'::text, '1c.2-E'::text,
      '1c.3-A'::text, '1c.3-B'::text, '1c.3-C'::text, '1c.3-D'::text, '1c.3-E'::text
    ])
  );

-- Step 2: Normalize slice tags for 1c.3-B, 1c.2-D, and 1c.3-D rows.
-- All three UPDATEs run in this single transaction; post-condition assertion at the end.
DO $$
DECLARE
  v_b_count INT;
  v_legacy_d_count INT;
  v_new_d_count INT;
BEGIN
  -- 1c.3-B rows (3 expected): mechanics merge captured 2026-04-29
  UPDATE public.athlete_lab_nodes_phase1c_backup
     SET slice = '1c.3-B'
   WHERE slice = 'B'
     AND captured_at >= '2026-04-29'::timestamptz
     AND captured_at <  '2026-04-30'::timestamptz;
  GET DIAGNOSTICS v_b_count = ROW_COUNT;

  -- 1c.2-D rows (4 expected): camera/calibration captured 2026-04-25
  UPDATE public.athlete_lab_nodes_phase1c_backup
     SET slice = '1c.2-D'
   WHERE slice = 'D'
     AND captured_at >= '2026-04-25'::timestamptz
     AND captured_at <  '2026-04-26'::timestamptz;
  GET DIAGNOSTICS v_legacy_d_count = ROW_COUNT;

  -- 1c.3-D rows (2 expected): KB merge captured 2026-04-29
  UPDATE public.athlete_lab_nodes_phase1c_backup
     SET slice = '1c.3-D'
   WHERE slice = 'D'
     AND captured_at >= '2026-04-29'::timestamptz
     AND captured_at <  '2026-04-30'::timestamptz;
  GET DIAGNOSTICS v_new_d_count = ROW_COUNT;

  -- Post-condition assertions (transactional correctness — F-OPS-4 sub-pattern 6)
  IF v_b_count <> 3 THEN
    RAISE EXCEPTION 'PHASE-1C3-SLICE-E assertion failed: expected 3 rows updated B → 1c.3-B, got %', v_b_count;
  END IF;
  IF v_legacy_d_count <> 4 THEN
    RAISE EXCEPTION 'PHASE-1C3-SLICE-E assertion failed: expected 4 rows updated D (legacy) → 1c.2-D, got %', v_legacy_d_count;
  END IF;
  IF v_new_d_count <> 2 THEN
    RAISE EXCEPTION 'PHASE-1C3-SLICE-E assertion failed: expected 2 rows updated D (new) → 1c.3-D, got %', v_new_d_count;
  END IF;

  -- Final invariant: no row in scope should still carry single-letter B or D
  PERFORM 1 FROM public.athlete_lab_nodes_phase1c_backup
   WHERE slice IN ('B', 'D')
     AND (
       (captured_at >= '2026-04-29'::timestamptz AND captured_at < '2026-04-30'::timestamptz)
       OR (slice = 'D' AND captured_at >= '2026-04-25'::timestamptz AND captured_at < '2026-04-26'::timestamptz)
     );
  IF FOUND THEN
    RAISE EXCEPTION 'PHASE-1C3-SLICE-E assertion failed: residual single-letter slice rows in normalized scope';
  END IF;

  RAISE NOTICE 'PHASE-1C3-SLICE-E slice-tag normalization complete: B→1c.3-B (3), D→1c.2-D (4), D→1c.3-D (2)';
END $$;