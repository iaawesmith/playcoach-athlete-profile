---
id: R-06
title: `det_frequency_defender`/`_multiple` deletion breaks scenario resolution for nodes that never set `det_frequency_solo`
status: open
severity: Sev-2
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---

# R-06 — `det_frequency_defender`/`_multiple` deletion breaks scenario resolution for nodes that never set `det_frequency_solo`
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low (nodes default to `det_frequency=7`, `det_frequency_solo=2`)
- **What happens:** `index.ts:1111-1141` resolves the active value with fallbacks. If we drop `_defender` and `_multiple` columns, the fallback chain shortens. Any node where `det_frequency_solo` is null but `_defender` was set as the de-facto active value would silently flip to the root `det_frequency` default.
- **Mitigation:**
  1. Pre-migration: for every node, compute the **currently-resolved** `det_frequency` and write it into a single new column / overwrite `det_frequency_solo` (since they collapse).
  2. Post-migration: re-resolve and assert equality for every node.
- **Trigger to pause:** Any node's resolved `det_frequency` changes value across the migration boundary.
