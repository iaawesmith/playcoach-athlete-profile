---
id: R-12
title: Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics"
status: closed
severity: Sev-3
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: [ADR-0015]
related_entries: [F-OPS-3, F-OPS-4, R-05]
opened: 2026-04-25
last_updated: 2026-04-29
closed: 2026-04-29
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

## Status — closed in 1c.3-B; broader pattern completed in 1c.3-D

R-12 was **closed in PHASE-1C3-SLICE-B** (2026-04-29) when the Mechanics-only `knowledge_base` merge migration shipped. Three Mechanics sections from the Slant node were merged into `knowledge_base.phases` with `(migrated)` title suffix and HTML provenance prefix, then `knowledge_base.mechanics` was dropped.

## Cross-link to PHASE-1C3-SLICE-D

PHASE-1C3-SLICE-D (2026-04-29) **completes the broader knowledge_base consolidation pattern** R-12 originally named. The mitigation (2) clause above enumerated additional source keys (`reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint`) that R-12 anticipated but didn't itself migrate.

1c.3-D extended the same merge pattern to **5 additional source keys**:
- `scoring` → `metrics` (8 sections merged)
- `errors` → `metrics` (9 sections merged)
- `camera` → `reference` (sections merged with provenance headers)
- `checkpoints` → `phases` (sections merged with provenance headers)
- `training_status` → `basics` (sections merged with provenance headers)

Final consolidated key lengths verified: `basics` (13), `phases` (19), `metrics` (30), `reference` (16). Source keys dropped.

The 1c.3-D merge surfaced **F-OPS-4 sub-pattern 6** (transactional correctness on multi-source merges) when the first iteration's in-loop UPDATE-then-reread pattern produced a stale-read defect (expected 30 sections in `metrics`, got 25). Recovered via accumulator pattern + length assertion. Detail in F-OPS-4 fourth annotation.

R-12 status remains **closed**. The broader pattern is now complete.

## Cross-links

- [R-05](R-05-tab-consolidation-hides-existing-draft-state-content-from-admins.md) — sibling consolidation risk; mitigated in 1c.3-D alongside this broader-pattern completion.
- [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) — sub-pattern 6 (transactional correctness) surfaced during the 1c.3-D extension of this merge pattern.
- [docs/process/phase-1c3-slice-b-outcome.md](../process/phase-1c3-slice-b-outcome.md) — slice that closed R-12.
- [docs/process/phase-1c3-slice-d-outcome.md](../process/phase-1c3-slice-d-outcome.md) — slice that completed the broader pattern.
