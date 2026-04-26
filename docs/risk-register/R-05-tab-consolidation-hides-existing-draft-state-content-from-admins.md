---
id: R-05
title: Tab consolidation hides existing draft-state content from admins
status: open
severity: Sev-3
origin_slice: 1c.3
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-05 — Tab consolidation hides existing draft-state content from admins
- **Phase:** 1c.3
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Collapsing 12 → 8 tabs reroutes editors. An admin who was mid-edit on, say, the Filming Guidance tab returns and can't find the field they were editing.
- **Mitigation:**
  1. 1c.3 ships a one-time "what moved" banner with a tab-by-tab redirect map.
  2. Old tab anchors (`#filming-guidance`) auto-redirect to the new tab + scroll to the moved section.
- **Trigger to pause:** Admin support thread reports >1 "I lost my X field" within 48h.
