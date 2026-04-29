# Phase 1c.3 — Prep Backlog

**Purpose:** Verification tasks and questions surfaced during Phase 1c.2 that are not risks (so they don't belong in `migration-risk-register.md`) but do need answering before or during Phase 1c.3 execution. Distinct from the risk register: these are open questions / verification tasks, not enumerated failure modes.

**Status:** Open. To be consumed at 1c.3 kickoff and either resolved inline or promoted to risk-register entries if a risk surfaces.

---

## V-1c.3-01 — Verify orphan status of `reference_object` and `llm_tone`

> **Status:** ✅ **Resolved 2026-04-29** in `PHASE-1C3-SLICE-A`. Project-wide search returned zero hits outside the documented sites (`src/integrations/supabase/types.ts`, `docs/`, `supabase/migrations/`, `.lovable/`). Confirmed truly orphaned. Process learning captured in [`phase-1c3-slice-a-outcome.md`](phase-1c3-slice-a-outcome.md) and queued for the Phase 1c retrospective (Slice 1c.3-F).

- **Logged:** 2026-04-26 (Slice E.5 re-run report §1.2 audit observation)
- **Origin:** During the Slice E.5 §1.2 frontend audit (consumer scan for the 8 dropped columns), `reference_object` and `llm_tone` showed **zero consumers in `src/features/`**. The migration `20260426025918` dropped them with no functional impact detected on any kept tab during the re-run smoke.

### Why this needs verification

The audit was scoped to `src/features/`. Three plausible explanations for the zero-consumer finding:

1. **Authored but never shipped.** The columns were added to the schema for features that were planned and then dropped or pivoted away from. Default state with no functional consumer ever existing.
2. **Consumers removed in earlier cleanup, columns left behind.** A prior phase (1b? earlier 1c slice?) deleted the consuming code but did not include the column in its drop list, leaving an orphan.
3. **ripgrep scope missed consumers in unexpected locations.** `src/features/` is the dominant location for consuming code, but references could exist in:
   - `src/services/` (API call construction)
   - `src/store/` (Zustand store fields)
   - `src/utils/` or `src/lib/`
   - `supabase/functions/**/*.ts` (edge functions — only `analyze-athlete-video/index.ts` was audited in Slice E.0; other edge functions were not)
   - Test files, scripts, migration files
   - Type definition files outside `src/integrations/supabase/types.ts`

### Verification task

Run a project-wide search for `reference_object` and `llm_tone` references **outside `src/features/`**:

```bash
rg -l '\b(reference_object|llm_tone)\b' \
  --glob '!src/integrations/supabase/types.ts' \
  --glob '!docs/**' \
  --glob '!supabase/migrations/**' \
  --glob '!.lovable/**'
```

Then narrow with `rg -n` on each hit to determine whether the reference is a real consumer (read or write of column data) or incidental (e.g., a string literal in unrelated logging).

### Decision tree

- **All hits incidental / no consumers found anywhere:** confirm "truly orphaned" status. Capture the orphan history as a **process learning** in the Phase 1c retrospective: columns can outlive their consumers, and dropped-column audits should always check edge functions and shared utilities, not just feature code. No further code action.
- **Real consumers found outside `src/features/`:** investigate why they survived migration `20260426025918`. If consumers reference the dropped column for read/write, they are now broken or silently no-op-ing. Patch as part of 1c.3 with proper null-handling or removal. If the failure mode is silent (e.g., always-undefined read with no UI surface), promote to a risk-register entry.

### Owner

1c.3 audit phase, before any consolidation work begins.

---

## Stub cleanup queue

> **Status:** ✅ **All 7 stubs retired 2026-04-29** in `PHASE-1C3-SLICE-A`. All removal-trigger queries returned zero hits. Table preserved below for historical reference.

R2 redirect stubs created during Phase 1c.2 cleanup. Per the R2 stub policy ([`../agents/conventions.md`](../agents/conventions.md)), heavy-traffic doc moves get one phase boundary of redirect grace.

| Stub path | Created in pass | Replacement | Status |
|---|---|---|---|
| `AGENTS.md` (root) | 1 | `PRODUCT-SPEC.md` | ✅ Removed 2026-04-29 |
| `docs/run-analysis-observability-audit-v2.md` | 1 | `docs/reference/run-analysis-observability-audit.md` | ✅ Removed 2026-04-29 |
| `docs/repo-architecture-audit.md` | 3a | `docs/architecture/repo-architecture-audit.md` | ✅ Removed 2026-04-29 |
| `docs/athlete-lab-architecture-audit.md` | 3a | `docs/architecture/athlete-lab-architecture-audit.md` | ✅ Removed 2026-04-29 |
| `docs/calibration-ground-truth-dataset.md` | 3a | `docs/reference/calibration-ground-truth-dataset.md` (prose); `docs/reference/calibration/ground-truth.yaml` (structured, Pass 3b) | ✅ Removed 2026-04-29 |
| `docs/phase-1c2-determinism-drift-log.md` | 3a | `docs/reference/phase-1c2-determinism-drift-log.md` (prose); `docs/reference/determinism-drift.csv` (structured, Pass 3c) | ✅ Removed 2026-04-29 |
| `docs/migration-risk-register.md` | 4 | `docs/risk-register/INDEX.md` (aggregated view) + `docs/risk-register/<ID>-<slug>.md` (one file per R-/F- entry) | ✅ Removed 2026-04-29 |

**Outcome:** 7 of 7 stubs retired with zero live references at removal-trigger time. R2 stub policy worked as designed — one phase boundary of grace, then clean removal.

---

## V-1c.3-06 — Retire CoachingCues migration subsystem

- **Logged:** 2026-04-29 (discovered during `PHASE-1C3-SLICE-B` execution as cascade scope from inline `MechanicsEditor` cleanup)
- **Origin:** Slice 1c.3-B's stated goal was Mechanics tab + `MechanicsEditor` deletion + `knowledge_base.mechanics` merge. During execution, removing the inline `MechanicsEditor` function in `NodeEditor.tsx` revealed that the `pro_mechanics` field on `TrainingNode` is consumed by an active migration subsystem (the Phase 1c.1 Slice 2 coaching-cues migration tooling). The DB column `pro_mechanics` was dropped in Slice E.4 (migration `20260426025918`) but the field/type/UI surface remains because admins use it to migrate any unmigrated nodes.
- **Surface to retire (6 sites):**
  - `src/features/athlete-lab/utils/migrateCoachingCues.ts` — entire module (~200 LOC)
  - `src/features/athlete-lab/components/MigrateCoachingCuesModal.tsx` — accepts `pro_mechanics` prop, calls `reconcileNode(phase_breakdown, pro_mechanics)`
  - `src/features/athlete-lab/components/CoachingCuesMigrationBanner.tsx` — banner triggering the migration modal
  - `src/features/athlete-lab/utils/nodeExport.ts` — `parseMechanics(node.pro_mechanics)` for markdown export
  - `src/features/athlete-lab/components/NodeEditor.tsx` — line 1160 prop pass to `MigrateCoachingCuesModal`
  - `src/features/athlete-lab/types.ts` — `pro_mechanics: string` field on `TrainingNode`, `MechanicsSection` interface

### Why this needs verification before retirement

Premature retirement risks losing access to the migration tool for any node where admins have not yet completed the `pro_mechanics → phase_breakdown.coaching_cues` migration. The DB column is gone, so for production nodes the field is now always empty string — but the read path is still wired for defense-in-depth.

### Verification task

Confirm migration completion before retirement:

```sql
-- All nodes should be 'confirmed' before retirement
SELECT id, name, coaching_cues_migration_status
FROM athlete_lab_nodes
WHERE coaching_cues_migration_status <> 'confirmed';
```

If any rows return, either:
1. Run the migration UI for those nodes (admin task), then retry, OR
2. Force-set status to 'confirmed' if the migration is no longer relevant (decision: confirm with admin).

### Decision tree

- **All nodes `confirmed`:** retire the 6-site surface in a dedicated slice. Likely 1c.3-D if it touches `NodeEditor.tsx` anyway, or a standalone slice.
- **Some nodes not yet `confirmed`:** keep subsystem alive until admin completion; defer retirement decision to next plan-mode pass.

### Owner

Decision deferred to next plan-mode pass after 1c.3-B closes. Candidate slice: 1c.3-D or dedicated future slice.

### Cross-links

- `docs/risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md` — methodological finding that surfaced this work
- `docs/process/phase-1c3-slice-b-outcome.md` — slice that discovered the cascade scope
- ADR-0015 — Mechanics tab delete-not-patch decision

---

## (future entries)

Add additional verification tasks here as they surface. Format: `V-1c.3-NN — <short title>`, with origin / why-it-matters / verification task / decision tree / owner.
