---
id: R-12
title: Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics"
status: open
severity: Sev-3
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-12 — Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics"
- **Phase:** 1c.2
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** `athlete_lab_nodes.knowledge_base` is `Record<string, KnowledgeSection[]>` keyed by tab name. Deleting the Mechanics tab leaves `knowledge_base.mechanics` orphaned.
- **Mitigation:**
  1. Migration script copies `knowledge_base.mechanics` into `knowledge_base.phases` (with a separator note) before deleting the key.
  2. Same logic for `reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint` keys → their new home tabs.
- **Trigger to pause:** Any node where merged Phases knowledge_base content > UI display limit (truncation risk).
