
-- Add knowledge_base JSONB column
ALTER TABLE public.athlete_lab_nodes
ADD COLUMN knowledge_base jsonb NOT NULL DEFAULT '{}';

-- Migrate existing admin_tab_guidance content into every node's knowledge_base
-- Structure per tab: array of { id, sectionTitle, content }
DO $$
DECLARE
  guidance RECORD;
  node_rec RECORD;
  kb jsonb;
  section_id uuid;
BEGIN
  FOR node_rec IN SELECT id, knowledge_base FROM public.athlete_lab_nodes LOOP
    kb := '{}';
    FOR guidance IN SELECT tab_key, content FROM public.admin_tab_guidance WHERE content IS NOT NULL AND content != '' LOOP
      section_id := gen_random_uuid();
      kb := kb || jsonb_build_object(
        guidance.tab_key,
        jsonb_build_array(
          jsonb_build_object(
            'id', section_id::text,
            'sectionTitle', 'Overview',
            'content', guidance.content
          )
        )
      );
    END LOOP;
    UPDATE public.athlete_lab_nodes SET knowledge_base = kb WHERE id = node_rec.id;
  END LOOP;
END $$;
