-- Phase 1c.3-B retry — V-1c.3-04 fix: compare against extracted text, not JSON-serialized array
BEGIN;

INSERT INTO athlete_lab_nodes_phase1c_backup
  (node_id, source_column, content, node_name, disposition, slice, original_intent)
SELECT
  n.id,
  'knowledge_base.mechanics[' || (idx - 1)::text || '].' || (elem->>'sectionTitle'),
  elem->>'content',
  n.name,
  'relocated',
  'B',
  'Phase 1c.3-B: knowledge_base.mechanics merged into knowledge_base.phases per R-12 mitigation; Mechanics tab deleted per ADR-0015'
FROM athlete_lab_nodes n,
     jsonb_array_elements(n.knowledge_base->'mechanics') WITH ORDINALITY AS arr(elem, idx)
WHERE n.knowledge_base ? 'mechanics';

DO $$
DECLARE
  c int;
BEGIN
  SELECT COUNT(*) INTO c FROM athlete_lab_nodes_phase1c_backup
   WHERE original_intent LIKE 'Phase 1c.3-B:%' AND disposition = 'relocated';
  IF c <> 3 THEN RAISE EXCEPTION 'Backup count expected 3, got %', c; END IF;
END $$;

UPDATE athlete_lab_nodes
SET knowledge_base = jsonb_set(
  knowledge_base,
  '{phases}',
  (knowledge_base->'phases') || (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', elem->>'id',
        'sectionTitle', (elem->>'sectionTitle') || ' (migrated)',
        'content', '<p><em>Migrated from Mechanics tab (Phase 1c.3-B, ' || to_char(now(), 'YYYY-MM-DD') || ')</em></p>' || (elem->>'content')
      )
      ORDER BY idx
    )
    FROM jsonb_array_elements(knowledge_base->'mechanics') WITH ORDINALITY AS arr(elem, idx)
  )
)
WHERE knowledge_base ? 'mechanics';

-- Corrected substring assertion: extract each phases section's content and verify
-- the original backup content is a suffix of it (we prepended a provenance HTML prefix).
DO $$
DECLARE
  unmatched int;
BEGIN
  SELECT COUNT(*) INTO unmatched
  FROM athlete_lab_nodes_phase1c_backup b
  WHERE b.original_intent LIKE 'Phase 1c.3-B:%'
    AND b.disposition = 'relocated'
    AND NOT EXISTS (
      SELECT 1
      FROM athlete_lab_nodes n,
           jsonb_array_elements(n.knowledge_base->'phases') p
      WHERE n.id = b.node_id
        AND right(p->>'content', length(b.content)) = b.content
    );
  IF unmatched > 0 THEN
    RAISE EXCEPTION 'Substring assertion failed: % backup rows unmatched in phases', unmatched;
  END IF;
END $$;

UPDATE athlete_lab_nodes
SET knowledge_base = knowledge_base - 'mechanics'
WHERE knowledge_base ? 'mechanics';

DO $$
DECLARE
  remaining int;
  final_phases int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM athlete_lab_nodes WHERE knowledge_base ? 'mechanics';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Final invariant failed: % nodes still have knowledge_base.mechanics', remaining;
  END IF;
  SELECT jsonb_array_length(knowledge_base->'phases') INTO final_phases
  FROM athlete_lab_nodes WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';
  IF final_phases <> 9 THEN
    RAISE EXCEPTION 'Phases count expected 9, got %', final_phases;
  END IF;
END $$;

COMMIT;