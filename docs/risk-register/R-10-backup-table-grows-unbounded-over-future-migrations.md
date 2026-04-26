---
id: R-10
title: Backup table grows unbounded over future migrations
status: open
severity: Sev-4
origin_slice: 1c.0
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: [ADR-0012]
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-10 — Backup table grows unbounded over future migrations
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** Eventual
- **What happens:** Per your Default B addition, backup retention is indefinite. Future cleanups add more rows / more columns. Without naming convention, the table becomes a junk drawer.
- **Mitigation:**
  1. Name backup tables per phase: `athlete_lab_nodes_phase1c_backup`, `_phase1d_backup`, etc. Never reuse a name.
  2. Each backup table includes `archived_at` (NULL by default; set explicitly when the rollback buffer is intentionally retired).
- **Trigger to pause:** N/A — convention only.
