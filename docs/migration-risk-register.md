# Phase 1c Migration Risk Register

**Date:** 2026-04-25
**Phase:** 1c.0 — Foundation
**Sequence:** Document 3 of 3 (after `mediapipe-capability-inventory.md` and `athlete-lab-end-state-architecture.md`)
**Frame:** Enumerate every meaningful way the Phase 1c cleanup could go wrong, with severity, likelihood, mitigation, and a concrete trigger that should pause the rollout.
**Inputs:** the two sibling docs in this batch; the architecture audit (`docs/athlete-lab-architecture-audit.md`); per your Default B addition, backup-table retention is indefinite (rollback buffer is permanent until explicitly archived).

Severity scale: **Sev-1** (blocks production analyses) · **Sev-2** (silent correctness drift in admin output or Claude prompt) · **Sev-3** (admin UX confusion, no data loss) · **Sev-4** (cleanup hygiene only).

---

## §1 — Risk register

### R-01 — Mechanics → Phases content migration loses or duplicates coaching cues
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** Medium
- **What happens:** `pro_mechanics` (string of multi-section markdown) gets parsed into `phase_breakdown[].coaching_cues`. Parser misattributes sections to phases (e.g., "Break" coaching cues land on "Stem"), or content is double-stored because both old and new locations are written during transition.
- **Why it's likely:** The audit notes admins have already been duplicating cues across `pro_mechanics[].content` and the lower half of `phase_breakdown[].description` under a `— Coaching cues —` separator (audit Tab 3). Two existing storage sites means migration must reconcile.
- **Mitigation:**
  1. Migration is **read-only on `pro_mechanics`** during 1c.1; new field is additive.
  2. Side-by-side render in admin UI for one cycle: old + new visible, admin manually confirms phase attribution.
  3. Only after admin confirmation does 1c.2 delete `pro_mechanics`.
- **Trigger to pause:** Any node where the count of detected sections in `pro_mechanics` doesn't equal the count of phases in `phase_breakdown`.

### R-02 — System-parameter substitution fix changes Claude output for already-passing nodes
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** High
- **What happens:** Today `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` arrive at Claude as **literal** strings inside `system`. Fixing the bug substitutes real values — which means Claude's behavior changes immediately for every athlete, including nodes that look "fine" today.
- **Mitigation:**
  1. Land the fix behind a per-node feature flag (`llm_substitute_in_system: bool`) defaulting to `false` until a node's prompt is reviewed.
  2. For each node, run a fixture comparison (old prompt vs new) before flipping the flag.
- **Trigger to pause:** Any node where the substituted system prompt produces output that disagrees with the baseline on a labeled fixture.

### R-03 — `{{phase_context}}` injection blows past Claude token budget
- **Phase:** 1c.1
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Wiring per-phase descriptions + coaching cues into the user prompt (audit P0 #3) inflates token count. Slant has 5 phases × ~5–7 sentence cues = a meaningful prompt-token jump. May truncate Claude responses or push above `llm_max_words` budget heuristic.
- **Mitigation:**
  1. Compute substituted prompt length pre-call; warn in `claude_api` log section when `prompt_tokens > 0.7 * model_context_window`.
  2. Provide a per-node `phase_context_mode: "full" | "compact" | "names_only"` toggle.
- **Trigger to pause:** Average `prompt_tokens` across last 10 runs increases >2× post-rollout.

### R-04 — Backup table omits a text-bearing field, making rollback impossible
- **Phase:** 1c.2
- **Severity:** Sev-1
- **Likelihood:** Medium
- **What happens:** The `athlete_lab_nodes_phase1c_backup` table is meant to preserve every text-bearing field deleted in 1c.2 (per Default B + your addition: indefinite retention). If the migration script forgets a JSON sub-field (e.g., `reference_calibrations[].calibration_notes`), that admin-authored content is lost permanently.
- **Mitigation:**
  1. Backup table schema is **the union of all DELETE 1c.2 fields enumerated in End-State Architecture §2.9**, columns named `<source_column>` for root and `<source_column>__<sub_field>` for JSON sub-fields, plus `node_id` and `backed_up_at`.
  2. Pre-migration assertion: for every node, every listed field's text content exists in the backup row before any DROP runs.
  3. Backup table is RLS-locked to service_role only; no automatic delete; no TTL.
- **Trigger to pause:** Pre-migration assertion fails for any node.

### R-05 — Tab consolidation hides existing draft-state content from admins
- **Phase:** 1c.3
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Collapsing 12 → 8 tabs reroutes editors. An admin who was mid-edit on, say, the Filming Guidance tab returns and can't find the field they were editing.
- **Mitigation:**
  1. 1c.3 ships a one-time "what moved" banner with a tab-by-tab redirect map.
  2. Old tab anchors (`#filming-guidance`) auto-redirect to the new tab + scroll to the moved section.
- **Trigger to pause:** Admin support thread reports >1 "I lost my X field" within 48h.

### R-06 — `det_frequency_defender`/`_multiple` deletion breaks scenario resolution for nodes that never set `det_frequency_solo`
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low (nodes default to `det_frequency=7`, `det_frequency_solo=2`)
- **What happens:** `index.ts:1111-1141` resolves the active value with fallbacks. If we drop `_defender` and `_multiple` columns, the fallback chain shortens. Any node where `det_frequency_solo` is null but `_defender` was set as the de-facto active value would silently flip to the root `det_frequency` default.
- **Mitigation:**
  1. Pre-migration: for every node, compute the **currently-resolved** `det_frequency` and write it into a single new column / overwrite `det_frequency_solo` (since they collapse).
  2. Post-migration: re-resolve and assert equality for every node.
- **Trigger to pause:** Any node's resolved `det_frequency` changes value across the migration boundary.

### R-07 — Earmarked-but-deleted athlete-UI fields lose institutional memory
- **Phase:** 1c.2 → future
- **Severity:** Sev-3
- **Likelihood:** High over long horizon
- **What happens:** Backup table preserves text content, but the *intent* ("this was meant for athlete UI per Phase 1c End-State Architecture §2.9") lives only in this doc. A future engineer restoring the table thinks the rows are dead.
- **Mitigation:**
  1. Backup table includes a `disposition` column populated at insert with the End-State doc's earmark label (e.g., `'earmark_athlete_ui'`, `'earmark_claude_prompt'`).
  2. Reference this register and the End-State doc from the migration's description text so the link is in git history.
- **Trigger to pause:** N/A — preventive only.

### R-08 — Removing `solution_class`, `performance_mode`, `tracking_enabled` breaks the Cloud Run request shape
- **Phase:** 1c.2
- **Severity:** Sev-1 if uncoordinated, Sev-4 if sequenced correctly
- **Likelihood:** Medium
- **What happens:** `analyze-athlete-video/index.ts:651-660` posts these fields to the service. `mediapipe-service/app/schema.py` accepts-but-ignores them. If the edge function stops sending them before the service drops them from `AnalyzeRequest`, nothing breaks (Pydantic optional). If the service drops them first while edge keeps sending, also fine. But if anyone tightens `AnalyzeRequest` to forbid extras (`extra = "forbid"`), order matters.
- **Mitigation:**
  1. Service-side: explicitly leave `extra = "ignore"` (Pydantic default) on `AnalyzeRequest` for the duration of 1c.
  2. Edge-side: stop sending the three fields **before** removing them from the DB.
- **Trigger to pause:** Any 4xx from `/analyze` mentioning unexpected fields.

### R-09 — Claude prompt template references a deleted variable
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low
- **What happens:** A node's `llm_prompt_template` contains `{{filming_instructions}}` or similar. The substitution loop yields empty string → Claude gets a sentence with a dangling reference ("Remember: " followed by nothing).
- **Mitigation:**
  1. Pre-migration: scan all nodes' `llm_prompt_template` and `llm_system_instructions` for `{{...}}` references; cross-check against the post-1c.2 known-variable list.
  2. Block migration on any unresolved reference; require admin to update the template first.
- **Trigger to pause:** Any unresolved `{{var}}` in any active node's template.

### R-10 — Backup table grows unbounded over future migrations
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** Eventual
- **What happens:** Per your Default B addition, backup retention is indefinite. Future cleanups add more rows / more columns. Without naming convention, the table becomes a junk drawer.
- **Mitigation:**
  1. Name backup tables per phase: `athlete_lab_nodes_phase1c_backup`, `_phase1d_backup`, etc. Never reuse a name.
  2. Each backup table includes `archived_at` (NULL by default; set explicitly when the rollback buffer is intentionally retired).
- **Trigger to pause:** N/A — convention only.

### R-11 — `score_bands` field stays orphaned (kept but no consumer)
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** High
- **What happens:** End-State keeps `score_bands` but earmarks it for athlete UI. Without a tracking item, the field sits unused indefinitely, recreating the "documentation describes intended behavior, code does something else" pattern (audit Pattern 1).
- **Mitigation:** Open a tracking task in the project backlog at 1c close: "score_bands has no consumer; either wire to athlete result page or revisit in next cleanup."
- **Trigger to pause:** N/A — preventive only.

### R-12 — Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics"
- **Phase:** 1c.2
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** `athlete_lab_nodes.knowledge_base` is `Record<string, KnowledgeSection[]>` keyed by tab name. Deleting the Mechanics tab leaves `knowledge_base.mechanics` orphaned.
- **Mitigation:**
  1. Migration script copies `knowledge_base.mechanics` into `knowledge_base.phases` (with a separator note) before deleting the key.
  2. Same logic for `reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint` keys → their new home tabs.
- **Trigger to pause:** Any node where merged Phases knowledge_base content > UI display limit (truncation risk).

---

## §2 — Top 3 risks (heatmap)

Ranked by Severity × Likelihood × Reversibility:

1. **R-04 — Backup table omits a text-bearing field** — Sev-1, irreversible. The single risk where a mistake permanently loses admin-authored content. Pre-migration assertion is non-negotiable.
2. **R-02 — System-param substitution fix silently changes Claude output** — Sev-2, reversible (flag flip), but high likelihood and affects every athlete the moment it ships. Per-node feature flag is the right control.
3. **R-01 — Mechanics → Phases content migration misattributes coaching cues** — Sev-2, partially reversible (backup table preserves source), but the path of least surprise is the side-by-side admin confirmation cycle in 1c.1.

The risks that look scariest at first glance (R-08 service contract, R-06 det_frequency resolution) are actually controllable through ordering — they only become Sev-1 if the migration sequence is wrong, which is a planning problem, not an unknown.

---

## §3 — Recommended starting point for Phase 1c.1

Given the risk profile, the right first slice of 1c.1 is the **lowest-risk highest-value** capability to activate from the End-State plan:

> **Wire `{{phase_context}}` into the Claude prompt (audit P0 #3), gated behind a per-node opt-in flag.**

Reasoning:
- It's the first capability with **no DB schema change** and **no deletion** — pure additive code work in the edge function.
- It directly tests R-03 (token budget) on real data without committing to the rollout.
- It lays the groundwork for R-01 (Mechanics merge) by establishing where coaching cues belong end-to-end before we ask admins to confirm phase attribution.
- It avoids touching the system-prompt substitution path (R-02) until we've proven the new template-variable expansion works in the user-prompt path first.

The system-param substitution fix (R-02) is P0 by audit ranking but should be the **second** 1c.1 slice, after `{{phase_context}}` has shaken out the template-variable plumbing.

DB schema work (1c.2) starts only after both 1c.1 slices have one full week of clean runs in production.

---

## §4 — Closing summary

- **12 risks enumerated** across 1c.1 (functional), 1c.2 (deletion), 1c.3 (UI consolidation), and post-1c hygiene.
- **1 Sev-1 risk** (R-04, backup completeness) — controlled by a pre-migration assertion that must pass for every node before any DROP runs.
- **4 Sev-2 risks** — all controllable via sequencing, feature flags, or side-by-side admin confirmation.
- **Backup table** is named `athlete_lab_nodes_phase1c_backup`, includes a `disposition` column carrying the End-State earmark label, and is retained indefinitely until explicitly archived (per Default B addition).
- **Recommended 1c.1 starting point:** `{{phase_context}}` wiring with per-node opt-in. Lowest risk, highest information yield, sets up the harder migrations safely.

End of Phase 1c.0 foundation batch.
