---
id: R-11
title: `score_bands` field stays orphaned (kept but no consumer)
status: open
severity: Sev-4
origin_slice: 1c.0
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-11 — `score_bands` field stays orphaned (kept but no consumer)
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** High
- **What happens:** End-State keeps `score_bands` but earmarks it for athlete UI. Without a tracking item, the field sits unused indefinitely, recreating the "documentation describes intended behavior, code does something else" pattern (audit Pattern 1).
- **Mitigation:** Open a tracking task in the project backlog at 1c close: "score_bands has no consumer; either wire to athlete result page or revisit in next cleanup."
- **Trigger to pause:** N/A — preventive only.
