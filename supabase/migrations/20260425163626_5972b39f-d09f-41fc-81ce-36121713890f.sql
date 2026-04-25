-- Slice B1 pre-step: persist resolved det_frequency values into per-scenario columns.
-- 
-- Per pre-Slice-A snapshot (docs/phase-1c2-detfreq-resolution-snapshot.md), Slant
-- already has all three per-scenario columns populated, so this UPDATE is a no-op
-- for the only existing node. It is shipped defensively so that if a future node
-- is created with a NULL per-scenario column relying on the root det_frequency
-- fallback, that intent is captured in the per-scenario column before the
-- runtime resolver in `analyze-athlete-video` stops consulting the root.
--
-- R-06 invariant (byte-equal on resolved integer per scenario per node) holds
-- because COALESCE preserves the resolved value the runtime currently produces.

UPDATE public.athlete_lab_nodes
SET
  det_frequency_solo     = COALESCE(det_frequency_solo,     det_frequency, 7),
  det_frequency_defender = COALESCE(det_frequency_defender, det_frequency, 7),
  det_frequency_multiple = COALESCE(det_frequency_multiple, det_frequency, 7);