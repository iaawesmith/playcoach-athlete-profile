---
id: R-07
title: Earmarked-but-deleted athlete-UI fields lose institutional memory
status: mitigated
severity: Sev-3
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: [ADR-0007, ADR-0012]
related_entries: [F-OPS-4]
opened: 2026-04-25
last_updated: 2026-04-30
---

# R-07 — Earmarked-but-deleted athlete-UI fields lose institutional memory
- **Phase:** 1c.2 → future
- **Severity:** Sev-3
- **Likelihood:** High over long horizon
- **What happens:** Backup table preserves text content, but the *intent* ("this was meant for athlete UI per Phase 1c End-State Architecture §2.9") lives only in this doc. A future engineer restoring the table thinks the rows are dead.
- **Mitigation:**
  1. Backup table includes a `disposition` column populated at insert with the End-State doc's earmark label (e.g., `'earmark_athlete_ui'`, `'earmark_claude_prompt'`).
  2. Reference this register and the End-State doc from the migration's description text so the link is in git history.
  3. **PHASE-1C3-SLICE-E (2026-04-30):** Periodic backup audit pattern established. All 9 in-scope rows (slices B/C/D) verified for `disposition` honesty, `original_intent` non-boilerplate, `source_column` accuracy, and `node_id` referent existence. Audit also normalized slice tags from ambiguous single-letter form (`B`, `D`) to durable phase-slice form (`1c.3-B`, `1c.2-D`, `1c.3-D`) — taxonomy drift across slices over time being a new sub-pattern of F-OPS-4 (sub-pattern 7). See `docs/process/phase-1c3-slice-e-outcome.md`.
- **Trigger to pause:** N/A — preventive only.
- **Status note:** mitigated, not closed. R-07 stays mitigated until either (a) the audit-pattern + durable-tag convention is broadly internalized across multiple post-1c.3 slices, or (b) the backup table itself is retired.
