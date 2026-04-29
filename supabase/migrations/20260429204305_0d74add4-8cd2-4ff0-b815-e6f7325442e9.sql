DO $$
DECLARE
  v_node RECORD;
  v_pair RECORD;
  v_kb jsonb;
  v_source jsonb;
  v_target jsonb;
  v_merged jsonb;
  v_label text;
  v_header text;
  v_section jsonb;
  v_new_section jsonb;
  v_source_ids text[];
  v_merged_ids text[];
  v_missing text[];
  v_pairs CONSTANT jsonb := '[
    {"src":"checkpoints","dst":"phases","label":"Checkpoints"},
    {"src":"scoring","dst":"metrics","label":"Scoring"},
    {"src":"errors","dst":"metrics","label":"Errors"},
    {"src":"camera","dst":"reference","label":"Filming Guidance"},
    {"src":"training_status","dst":"basics","label":"Training Status"}
  ]'::jsonb;
BEGIN
  -- 1. Restore each node from its slice='D' backup snapshot
  FOR v_node IN
    SELECT DISTINCT ON (node_id) node_id, content
    FROM public.athlete_lab_nodes_phase1c_backup
    WHERE slice = 'D' AND source_column = 'knowledge_base'
    ORDER BY node_id, captured_at DESC
  LOOP
    UPDATE public.athlete_lab_nodes
    SET knowledge_base = v_node.content::jsonb
    WHERE id = v_node.node_id;
  END LOOP;

  -- 2. Re-run consolidation with local accumulator carried across pair iterations
  FOR v_node IN SELECT id, name, knowledge_base FROM public.athlete_lab_nodes LOOP
    v_kb := v_node.knowledge_base;

    FOR v_pair IN SELECT * FROM jsonb_array_elements(v_pairs) AS p LOOP
      v_source := COALESCE(v_kb -> (v_pair.value ->> 'src'), '[]'::jsonb);
      IF jsonb_typeof(v_source) <> 'array' OR jsonb_array_length(v_source) = 0 THEN
        CONTINUE;
      END IF;
      v_target := COALESCE(v_kb -> (v_pair.value ->> 'dst'), '[]'::jsonb);
      IF jsonb_typeof(v_target) <> 'array' THEN
        v_target := '[]'::jsonb;
      END IF;
      v_label := v_pair.value ->> 'label';
      v_header := '<p><em>(Originally from "' || v_label || '" tab)</em></p>';

      v_merged := v_target;
      FOR v_section IN SELECT * FROM jsonb_array_elements(v_source) LOOP
        v_new_section := jsonb_set(
          v_section,
          '{content}',
          to_jsonb(v_header || COALESCE(v_section ->> 'content', ''))
        );
        v_merged := v_merged || jsonb_build_array(v_new_section);
      END LOOP;

      SELECT array_agg(elem ->> 'id') INTO v_source_ids
        FROM jsonb_array_elements(v_source) AS elem;
      SELECT array_agg(elem ->> 'id') INTO v_merged_ids
        FROM jsonb_array_elements(v_merged) AS elem;
      SELECT array_agg(x) INTO v_missing
        FROM unnest(v_source_ids) AS x
        WHERE NOT (x = ANY(v_merged_ids));
      IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'KB merge assertion failed for node % key %->%: missing ids %',
          v_node.id, v_pair.value ->> 'src', v_pair.value ->> 'dst', v_missing;
      END IF;

      -- Update local accumulator (carries forward across iterations)
      v_kb := jsonb_set(v_kb, ARRAY[v_pair.value ->> 'dst'], v_merged, true);
    END LOOP;

    -- Drop the 5 source keys from accumulator and write once
    v_kb := v_kb - 'checkpoints' - 'scoring' - 'errors' - 'camera' - 'training_status';
    UPDATE public.athlete_lab_nodes SET knowledge_base = v_kb WHERE id = v_node.id;
  END LOOP;

  -- 3. Add a post-restore backup row marking the corrected merge
  INSERT INTO public.athlete_lab_nodes_phase1c_backup
    (node_id, source_column, content, node_name, disposition, slice, audit_reason, original_intent)
  SELECT id, 'knowledge_base.post_merge', knowledge_base::text, name,
         'relocated', 'D',
         'Phase 1c.3-D — post-merge corrected snapshot (after stale-read defect repair)',
         'Final consolidated KB shape after 5-key merge'
  FROM public.athlete_lab_nodes;
END $$;