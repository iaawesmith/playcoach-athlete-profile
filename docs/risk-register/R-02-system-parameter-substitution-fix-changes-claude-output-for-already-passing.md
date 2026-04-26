---
id: R-02
title: System-parameter substitution fix changes Claude output for already-passing nodes
status: open
severity: Sev-2
origin_slice: 1c.1
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---

# R-02 — System-parameter substitution fix changes Claude output for already-passing nodes
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** High
- **What happens:** Today `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` arrive at Claude as **literal** strings inside `system`. Fixing the bug substitutes real values — which means Claude's behavior changes immediately for every athlete, including nodes that look "fine" today.
- **Mitigation:**
  1. Land the fix behind a per-node feature flag (`llm_substitute_in_system: bool`) defaulting to `false` until a node's prompt is reviewed.
  2. For each node, run a fixture comparison (old prompt vs new) before flipping the flag.
- **Trigger to pause:** Any node where the substituted system prompt produces output that disagrees with the baseline on a labeled fixture.
