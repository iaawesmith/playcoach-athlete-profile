---
id: R-09
title: Claude prompt template references a deleted variable
status: open
severity: Sev-2
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-09 — Claude prompt template references a deleted variable
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low
- **What happens:** A node's `llm_prompt_template` contains `{{filming_instructions}}` or similar. The substitution loop yields empty string → Claude gets a sentence with a dangling reference ("Remember: " followed by nothing).
- **Mitigation:**
  1. Pre-migration: scan all nodes' `llm_prompt_template` and `llm_system_instructions` for `{{...}}` references; cross-check against the post-1c.2 known-variable list.
  2. Block migration on any unresolved reference; require admin to update the template first.
- **Trigger to pause:** Any unresolved `{{var}}` in any active node's template.
