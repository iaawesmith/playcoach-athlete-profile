---
id: R-07
title: Earmarked-but-deleted athlete-UI fields lose institutional memory
status: open
severity: Sev-3
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---

# R-07 — Earmarked-but-deleted athlete-UI fields lose institutional memory
- **Phase:** 1c.2 → future
- **Severity:** Sev-3
- **Likelihood:** High over long horizon
- **What happens:** Backup table preserves text content, but the *intent* ("this was meant for athlete UI per Phase 1c End-State Architecture §2.9") lives only in this doc. A future engineer restoring the table thinks the rows are dead.
- **Mitigation:**
  1. Backup table includes a `disposition` column populated at insert with the End-State doc's earmark label (e.g., `'earmark_athlete_ui'`, `'earmark_claude_prompt'`).
  2. Reference this register and the End-State doc from the migration's description text so the link is in git history.
- **Trigger to pause:** N/A — preventive only.
