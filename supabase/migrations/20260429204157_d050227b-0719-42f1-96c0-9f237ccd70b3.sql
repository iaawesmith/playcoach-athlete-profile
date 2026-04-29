DO $$
DECLARE
  v_node RECORD;
  v_pair RECORD;
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
  FOR v_node IN SELECT id, name, knowledge_base FROM public.athlete_lab_nodes LOOP
    INSERT INTO public.athlete_lab_nodes_phase1c_backup
      (node_id, source_column, content, node_name, disposition, audit_pattern, slice, audit_reason, original_intent)
    VALUES
      (v_node.id, 'knowledge_base', v_node.knowledge_base::text, v_node.name,
       'relocated', NULL, 'D',
       'Phase 1c.3-D — pre-merge KB snapshot before 5-key consolidation',
       'Consolidate retired tab KB keys into surviving consolidated tabs');

    FOR v_pair IN SELECT * FROM jsonb_array_elements(v_pairs) AS p LOOP
      v_source := COALESCE(v_node.knowledge_base -> (v_pair.value ->> 'src'), '[]'::jsonb);
      IF jsonb_typeof(v_source) <> 'array' OR jsonb_array_length(v_source) = 0 THEN
        CONTINUE;
      END IF;
      v_target := COALESCE(v_node.knowledge_base -> (v_pair.value ->> 'dst'), '[]'::jsonb);
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

      UPDATE public.athlete_lab_nodes
      SET knowledge_base = jsonb_set(knowledge_base, ARRAY[v_pair.value ->> 'dst'], v_merged, true)
      WHERE id = v_node.id;
    END LOOP;

    UPDATE public.athlete_lab_nodes
    SET knowledge_base = knowledge_base - 'checkpoints' - 'scoring' - 'errors' - 'camera' - 'training_status'
    WHERE id = v_node.id;
  END LOOP;
END $$;