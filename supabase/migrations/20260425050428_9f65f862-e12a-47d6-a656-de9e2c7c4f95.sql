-- Phase 1c.1 Slice 2 — Step 1
-- Add per-node lifecycle tracking for the Mechanics → Phases coaching cues migration.

ALTER TABLE public.athlete_lab_nodes
  ADD COLUMN coaching_cues_migration_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.athlete_lab_nodes
  ADD CONSTRAINT athlete_lab_nodes_coaching_cues_migration_status_check
  CHECK (coaching_cues_migration_status IN ('pending', 'in_progress', 'confirmed'));

COMMENT ON COLUMN public.athlete_lab_nodes.coaching_cues_migration_status IS
  'Phase 1c.1 Slice 2 lifecycle: pending → in_progress (>=1 phase confirmed) → confirmed (all phases). Post-confirmation edits stay confirmed.';