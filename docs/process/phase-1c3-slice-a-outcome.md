---
slice_id: PHASE-1C3-SLICE-A
title: R2 stub sweep + V-1c.3-01 orphan verification
date_shipped: 2026-04-29
status: shipped
related_risks: []
related_findings: []
related_adrs: [ADR-0013]
---

# PHASE-1C3-SLICE-A — R2 stub sweep + V-1c.3-01 orphan verification

## Goal

Success criterion (from Phase 1c.3 plan v2): **All 7 R2 stubs removed unless `rg` shows live in-repo references; `reference_object` and `llm_tone` orphan status confirmed (or real consumers patched).**

## What shipped

- **Removed 7 R2 redirect stubs** (all stub-removal-trigger queries returned zero hits):
  - `AGENTS.md` (root) — superseded by `PRODUCT-SPEC.md` (Pass 1).
  - `docs/run-analysis-observability-audit-v2.md` — superseded by `docs/reference/run-analysis-observability-audit.md` (Pass 1).
  - `docs/repo-architecture-audit.md` — superseded by `docs/architecture/repo-architecture-audit.md` (Pass 3a).
  - `docs/athlete-lab-architecture-audit.md` — superseded by `docs/architecture/athlete-lab-architecture-audit.md` (Pass 3a).
  - `docs/calibration-ground-truth-dataset.md` — superseded by `docs/reference/calibration-ground-truth-dataset.md` (prose) and `docs/reference/calibration/ground-truth.yaml` (structured) (Passes 3a/3b).
  - `docs/phase-1c2-determinism-drift-log.md` — superseded by `docs/reference/phase-1c2-determinism-drift-log.md` (prose) and `docs/reference/determinism-drift.csv` (structured) (Passes 3a/3c).
  - `docs/migration-risk-register.md` — superseded by `docs/risk-register/INDEX.md` + per-entry files (Pass 4).
- **V-1c.3-01 resolved as confirmed orphan.** Project-wide search for `\b(reference_object|llm_tone)\b` outside the documented sites returned zero hits. No real consumers exist outside `src/integrations/supabase/types.ts`, `docs/`, `supabase/migrations/`, and `.lovable/` — all of which are auto-generated, documentation, or historical migration text and not active consumers.
- **Updated `docs/process/phase-1c3-prep-backlog.md`:** marked V-1c.3-01 resolved with the process learning, marked all 7 stub queue rows retired with execution date.
- **CHANGELOG entry** for slice ship.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Recipe path adjustments needed post-Pass-3a | Manual review of recipe excludes vs. current dir layout (`docs/investigations/`, `docs/process/`, `docs/reference/`, `docs/risk-register/`, `docs/adr/`, `docs/agents/`, `docs/architecture/`) | ✅ — `docs/**` exclusion already covers all post-cleanup subdirs; no recipe update needed. |
| Stub removal triggers (7×) | `rg -l "<pattern>" --glob '!<stub-path>'` for each stub per prep-backlog table | ✅ — all 7 returned zero hits. |
| V-1c.3-01 search | `rg -l '\b(reference_object|llm_tone)\b'` with documented exclusions | ✅ — zero hits, orphan status confirmed. |
| Stubs gone | `ls` on all 7 paths post-`rm` | ✅ — all 7 paths return "No such file or directory". |

## Findings surfaced

None. No new `R-*` or `F-*` entries opened. The slice's halt-and-decide branches did not trigger.

## Process learning (V-1c.3-01 outcome)

**Captured for the Phase 1c retrospective (Slice 1c.3-F):**

`reference_object` and `llm_tone` are confirmed truly orphaned — they were authored into the schema for capabilities that were planned and then dropped or pivoted away from before any consumer code shipped. Migration `20260426025918` dropped them with no functional impact across `src/`, `supabase/functions/`, `scripts/`, or `mediapipe-service/`.

**Methodology lesson:** The Slice E.5 §1.2 audit scoped the consumer search to `src/features/`. That scope was insufficient by construction — a column can have consumers in `src/services/`, `src/store/`, `src/utils/`, `src/lib/`, edge functions outside `analyze-athlete-video/`, the MediaPipe service, scripts, or test files. The V-1c.3-01 backlog item caught this scope gap and proved no consumers existed in this case, but **future data-shape-changing slices must scope consumer audits project-wide, not feature-wide.** This is the same root-cause class as F-SLICE-E-4 / F-SLICE-E-5 (read paths audited but write paths and form-state bindings missed) — the fix is the same: enumerate all consumer surface types up front, not just the obvious one.

This learning belongs alongside the F-SLICE-E-4/E-5 read-and-write-path methodology rule in the Phase 1c retrospective.

## Decisions deferred

None. Slice scope fully discharged.

## Cross-links

- Phase 1c.3 plan (v2 — clarifications approved 2026-04-29).
- [`docs/process/phase-1c3-prep-backlog.md`](phase-1c3-prep-backlog.md) — stub queue and V-1c.3-01 entry, both marked resolved.
- [`docs/risk-register/INDEX.md`](../risk-register/INDEX.md) — no new entries opened this slice.
- ADR-0013 (prose-to-structured policy) — drove the prose→structured stub creations being retired here.
