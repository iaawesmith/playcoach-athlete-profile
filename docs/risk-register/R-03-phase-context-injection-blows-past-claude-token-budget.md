---
id: R-03
title: `{{phase_context}}` injection blows past Claude token budget
status: open
severity: Sev-3
origin_slice: 1c.1
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-03 — `{{phase_context}}` injection blows past Claude token budget
- **Phase:** 1c.1
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Wiring per-phase descriptions + coaching cues into the user prompt (audit P0 #3) inflates token count. Slant has 5 phases × ~5–7 sentence cues = a meaningful prompt-token jump. May truncate Claude responses or push above `llm_max_words` budget heuristic.
- **Mitigation:**
  1. Compute substituted prompt length pre-call; warn in `claude_api` log section when `prompt_tokens > 0.7 * model_context_window`.
  2. Provide a per-node `phase_context_mode: "full" | "compact" | "names_only"` toggle.
- **Trigger to pause:** Average `prompt_tokens` across last 10 runs increases >2× post-rollout.
