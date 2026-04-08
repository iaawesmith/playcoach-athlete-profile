
## AthleteLab — AI Training Node Admin Portal

### 1. Database Migration
Create `athlete_lab_nodes` table with JSONB fields for complex nested data:
- `id` UUID PK
- `name` text (route/skill name)
- `icon_url` text nullable
- `overview` text
- `pro_mechanics` text
- `key_metrics` JSONB (array of {name, description, eliteTarget, unit, weight})
- `scoring_rules` text
- `common_errors` JSONB (array of {error, correction})
- `phase_breakdown` JSONB (array of {phase, notes})
- `reference_object` text
- `camera_guidelines` text
- `form_checkpoints` JSONB (array of strings)
- `llm_prompt_template` text
- `badges` JSONB (array of {name, condition})
- `elite_videos` JSONB (array of {url, label})
- `created_at`, `updated_at` timestamps
- No RLS needed since this is admin-only and no auth yet (Session 1-2 per AGENTS.md)

Insert default "Slant Route" node with realistic sample data.

### 2. New Route & Layout
- Add `/athlete-lab` route in App.tsx
- Create `src/features/athlete-lab/AthleteLab.tsx` — main layout with sidebar + editor
- Sidebar: list of nodes + "Add New Node" button
- Editor: tabbed sections for all 13 field groups
- Testing panel at bottom

### 3. Components
- `NodeSidebar.tsx` — node list + add button
- `NodeEditor.tsx` — tabbed editor with all sections
- `TestingPanel.tsx` — upload video, run analysis, show results

### 4. AI Testing Panel
- Uses Lovable AI via edge function to simulate analysis
- Edge function `athlete-lab-analyze` accepts node config + video description
- Returns mock score, phase breakdown, feedback, confidence scores

### 5. Files
- `supabase/functions/athlete-lab-analyze/index.ts`
- `src/features/athlete-lab/AthleteLab.tsx`
- `src/features/athlete-lab/components/NodeSidebar.tsx`
- `src/features/athlete-lab/components/NodeEditor.tsx`
- `src/features/athlete-lab/components/TestingPanel.tsx`
- `src/features/athlete-lab/components/SectionTooltip.tsx`
- `src/features/athlete-lab/types.ts`
- `src/features/athlete-lab/defaultNode.ts`
- Update `src/App.tsx` with new route
