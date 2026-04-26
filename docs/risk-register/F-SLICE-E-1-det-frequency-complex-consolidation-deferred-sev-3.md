---
id: F-SLICE-E-1
title: `det_frequency` complex consolidation deferred (Sev-3)
status: open
severity: Sev-3
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: []
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-E-1 — `det_frequency` complex consolidation deferred (Sev-3)

- **Logged:** 2026-04-26, Slice E pre-flight (E.0)
- **Finding:** The originally-proposed Slice E drop list included all three `det_frequency` columns (root, `_defender`, `_multiple`). Pre-flight code audit of `analyze-athlete-video/index.ts` showed `det_frequency_defender` is the authoritative runtime read for the `with_defender` scenario (line 1155) and `det_frequency_multiple` for `multiple` (line 1160). Per Slice B1's collapsed resolver design (lines 1141–1147), the per-scenario columns are authoritative; the root `det_frequency` is no longer consulted at runtime.
- **Action taken in Slice E:** Drop list reduced from 10 to 8 columns. Root `det_frequency` dropped (with paired SELECT-list edit at line 914); `det_frequency_defender` and `det_frequency_multiple` retained.
- **Deferred:** Per-scenario column architecture cleanup (consolidating the three-column shape into a single JSONB or an enum-keyed table) is deferred to Phase 2 metric-quality work or a dedicated calibration/scenario architecture cleanup work item. Dropping `_defender` / `_multiple` without that cleanup would silently degrade analysis to fallback defaults (1, 1) for non-solo scenarios.
- **Severity:** Sev-3 (institutional-memory / cleanup debt; no user-facing impact).
