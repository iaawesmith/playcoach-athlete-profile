-- Step 1: expand CHECK constraint to allow 1c.3-F (F-OPS-4 sub-pattern 1 halt resolution)
ALTER TABLE athlete_lab_nodes_phase1c_backup
  DROP CONSTRAINT alb_phase1c_slice_chk;

ALTER TABLE athlete_lab_nodes_phase1c_backup
  ADD CONSTRAINT alb_phase1c_slice_chk
  CHECK (slice = ANY (ARRAY[
    'B'::text, 'C'::text, 'D'::text, 'E'::text,
    '1c.2-B'::text, '1c.2-C'::text, '1c.2-D'::text, '1c.2-E'::text,
    '1c.3-A'::text, '1c.3-B'::text, '1c.3-C'::text, '1c.3-D'::text, '1c.3-E'::text, '1c.3-F'::text
  ]));

-- Step 2: V-1c.3-08 merge (kb.overview -> kb.basics, with backup)
DO $$
DECLARE
  v_node_id uuid := '75ed4b18-8a22-440e-9a23-b86204956056';
  v_kb jsonb;
  v_overview jsonb;
  v_basics jsonb;
  v_new_basics jsonb;
  v_section jsonb;
  v_backup_count int;
  v_basics_len int;
  v_provenance text := '<p><em>Migrated from Overview tab (Phase 1c.3-F retrospective, 2026-04-30; Overview tab retired in 1c.3-D consolidation)</em></p>';
BEGIN
  SELECT knowledge_base INTO v_kb FROM athlete_lab_nodes WHERE id = v_node_id;
  v_overview := v_kb->'overview';
  v_basics := COALESCE(v_kb->'basics', '[]'::jsonb);

  IF v_overview IS NULL OR jsonb_array_length(v_overview) = 0 THEN
    RAISE EXCEPTION 'V-1c.3-08 precondition failed: kb.overview empty/missing on node %', v_node_id;
  END IF;
  IF jsonb_array_length(v_basics) <> 13 THEN
    RAISE EXCEPTION 'V-1c.3-08 precondition failed: expected basics length 13, got %', jsonb_array_length(v_basics);
  END IF;

  FOR v_section IN SELECT * FROM jsonb_array_elements(v_overview)
  LOOP
    INSERT INTO athlete_lab_nodes_phase1c_backup (
      node_id, source_column, content, disposition, audit_pattern, audit_reason, original_intent, slice
    ) VALUES (
      v_node_id,
      'knowledge_base.overview[' || COALESCE(v_section->>'sectionTitle', '<untitled>') || ']',
      v_section->>'content',
      'relocated',
      NULL,
      NULL,
      'Phase 1c.3-F V-1c.3-08: knowledge_base.overview merged into knowledge_base.basics; Overview tab retired in 1c.3-D consolidation',
      '1c.3-F'
    );
  END LOOP;

  v_new_basics := v_basics;
  FOR v_section IN SELECT * FROM jsonb_array_elements(v_overview)
  LOOP
    v_new_basics := v_new_basics || jsonb_build_array(
      jsonb_build_object(
        'id', COALESCE(v_section->>'id', gen_random_uuid()::text),
        'sectionTitle', COALESCE(v_section->>'sectionTitle', 'Overview') || ' (migrated)',
        'content', v_provenance || (v_section->>'content')
      )
    );
  END LOOP;

  UPDATE athlete_lab_nodes
  SET knowledge_base = (knowledge_base - 'overview') || jsonb_build_object('basics', v_new_basics)
  WHERE id = v_node_id;

  SELECT COUNT(*) INTO v_backup_count
  FROM athlete_lab_nodes_phase1c_backup
  WHERE node_id = v_node_id AND slice = '1c.3-F';
  IF v_backup_count <> 2 THEN
    RAISE EXCEPTION 'V-1c.3-08 post-condition failed: expected 2 backup rows, got %', v_backup_count;
  END IF;

  SELECT jsonb_array_length(knowledge_base->'basics') INTO v_basics_len
  FROM athlete_lab_nodes WHERE id = v_node_id;
  IF v_basics_len <> 15 THEN
    RAISE EXCEPTION 'V-1c.3-08 post-condition failed: expected basics length 15, got %', v_basics_len;
  END IF;

  IF EXISTS (SELECT 1 FROM athlete_lab_nodes WHERE id = v_node_id AND knowledge_base ? 'overview') THEN
    RAISE EXCEPTION 'V-1c.3-08 post-condition failed: kb.overview key still present';
  END IF;
END $$;