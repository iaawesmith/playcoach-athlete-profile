---
slice_id: 1c.3-C
title: Training Status / Solution Class write-path resolution + four-column defect-class cleanup
date_shipped: 2026-04-29
status: shipped
related_risks: []
related_findings: [F-SLICE-E-5, F-SLICE-E-6, F-OPS-4]
related_adrs: []
---

# 1c.3-C — Training Status / Solution Class write-path resolution + four-column defect-class cleanup

## Goal

Per Phase 1c.3 plan v2 Clarification 2: resolve the F-SLICE-E-5 write path that mutates the dropped `solution_class` column. Verify the save-payload allow-list shape, remove the radio's controlled-input binding and write call, hide the Solution Class UI surface, and prune the read-side dependency in `NodeReadinessBar.tsx`. Success criterion: zero references to the dropped `solution_class` column in any active write path, controlled-input binding, or readiness gate.

The slice's actual scope expanded under F-OPS-4 discipline once a pre-execution write-path sweep was run — see "Pre-execution sweep" below.

## Pre-execution sweep results

A project-wide write-path sweep for all 8 columns dropped in migration `20260426025918` (`pro_mechanics`, `llm_tone`, `det_frequency`, `solution_class`, `performance_mode`, `tracking_enabled`, `reference_object`, `reference_filming_instructions`) surfaced four active write paths in `NodeEditor.tsx`, all routing through the same `updateWithCriticalTrack` helper:

| Column | UI surface | Status pre-slice |
|---|---|---|
| `solution_class` | Solution Class radio | live write path (the F-SLICE-E-5 case) |
| `performance_mode` | Performance Mode toggle | live write path (same defect, undiscovered) |
| `det_frequency` | Legacy single-field Detection Frequency input | live write path (same defect, undiscovered) |
| `tracking_enabled` | Tracking toggle | live write path (same defect, undiscovered) |

Save-payload allow-list verification (`NodeEditor.tsx` ~L600): **confirmed allow-list shape**, not spread-based. Dropped columns already filtered. F-SLICE-E-5 severity stayed at Sev-3 (graceful save failure, not 4xx storm); no escalation needed.

Read-side dependencies surfaced in the sweep: `NodeReadinessBar.tsx` (Reference Calibration category and Training Status category) and a second readiness gate in `NodeEditor.tsx` `checkCompleteness()` (L167) — both gating Set-Live on `solution_class`.

The 4-column write-path defect class was captured as **F-SLICE-E-6** (opened and closed same slice). Three consecutive slices (1c.3-A, 1c.3-B, 1c.3-C) have now had stated scope < actual scope — annotated in F-OPS-4 as the **pre-execution decision-cluster** sub-pattern.

## Q1–Q4 decisions made before execution

A second halt surfaced four sub-decisions the slice plan hadn't specified. Resolved before any code edits:

- **Q1 — `det_frequency` scope:** Remove only the legacy single-field control. Keep the three per-context controls (`det_frequency_solo` / `_defender` / `_multiple`) — they write to active columns in the allow-list.
- **Q2 — Second readiness gate:** Prune both `NodeReadinessBar.tsx` AND `checkCompleteness`. Splitting creates inconsistent intermediate state.
- **Q3 — Dead helper cleanup:** **3a** — delete all dead helpers AND remove the Training Status section from `nodeExport.ts` entirely. If the columns are gone, the export should not pretend they exist.
- **Q4 — `TrainingNode` type cleanup:** Remove `solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency`, `reference_object`, `reference_filming_instructions` from the interface this slice. Keep `pro_mechanics` (pinned by V-1c.3-06 — CoachingCues migration subsystem retirement remains deferred).

## What shipped

### Code (`src/features/athlete-lab/`)

- **`components/NodeEditor.tsx`**:
  - `checkCompleteness` (L167-187): `solution_class` gate removed.
  - `wholebody3d` short-circuit removed from reference-calibration completeness check.
  - All 4 write-path handlers removed from `TrainingStatusEditor` call site (`solution_class`, `performance_mode`, `det_frequency`, `tracking_enabled`).
  - `TrainingStatusEditor` inline component refactored ~270 LOC → ~125 LOC: Solution Class radio, Performance Mode toggle, legacy single-field Detection Frequency input, Tracking toggle, legacy `pipelineCode` template, dead helpers (`getSolutionClassWarnings`, `SOLUTION_CLASSES`, `SOLUTION_CLASS_MAP`) all deleted.
  - `ReferenceCalibrationEditor`: `genericFallbackInstructions` UI removed; props cleaned.
- **`types.ts`**: Removed 6 dropped columns from `TrainingNode` interface (`solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency`, `reference_object`, `reference_filming_instructions`). `pro_mechanics` retained per V-1c.3-06.
- **`components/NodeReadinessBar.tsx`**:
  - Reference Calibration category: `solution_class === "wholebody3d"` short-circuit dropped — per-angle calibration check now always runs.
  - Training Status category: solution-class-specific checks replaced with a deferred-to-Phase-1 placeholder.
- **`utils/nodeExport.ts`**:
  - `generateTrainingStatus()` deleted in full.
  - `training_status` removed from `TabKey` union, `TAB_GENERATORS`, `TAB_LABELS`, and `tabOrder` in `generateFullNodeMarkdown`.
  - `# Solution Class:` header line removed from `generateFullNodeMarkdown` output.
  - `reference_filming_instructions` reference dropped from `generateReference`.
  - Orphan import `getActiveMetrics` removed.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Save-payload allow-list shape | Manual read of `NodeEditor.tsx` ~L600-625 | ✅ allow-list confirmed (not spread-based) |
| Write-path sweep clean for 8 dropped columns | `rg` for each dropped column name across `src/` | ✅ no live write paths remain |
| `solution_class` references purged from active code | `rg "solution_class" src/features/athlete-lab/` | ✅ remaining hits are explanatory comments only |
| TypeScript build | `npx tsc --noEmit` | ✅ exit 0, no output |
| F-SLICE-E-5 closed | Status flipped open → resolved with pointer to F-SLICE-E-6 | ✅ |
| F-SLICE-E-6 closed | Same-slice open/close per 1c.3-B precedent | ✅ |

## Findings closed

- **[F-SLICE-E-5](../risk-register/F-SLICE-E-5-solution-class-radio-control-writes-to-dropped-column.md)** — resolved. Pointer added to F-SLICE-E-6.
- **[F-SLICE-E-6](../risk-register/F-SLICE-E-6-training-status-write-paths-class-defect.md)** — opened and closed same slice. Captures the four-column defect class, save-payload verification, Q1–Q4 decisions, and resolution.

## Findings annotated

- **[F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md)** — added the **pre-execution decision-cluster** sub-pattern annotation. F-OPS-4 has now evolved through three explicit annotations across three slices (constraint+shape+location discovery → "stated scope < actual scope" structural pattern → pre-execution decision cluster). The evolution itself is evidence the methodological lesson is generalizable rather than slice-specific.

## Decisions deferred

- **V-1c.3-06 — CoachingCues migration subsystem retirement** still pinned. `pro_mechanics` field on `TrainingNode` is the only dropped-column-adjacent field intentionally retained. Deferral reason unchanged: cannot retire until `coaching_cues_migration_status = 'confirmed'` for all nodes.
- No other deferrals from this slice.

## Process observation

This slice produced more methodological evolution than any other slice in this Phase 1c.3 work. F-OPS-4 has now evolved through three explicit annotations:

1. **1c.3-B origin** — three concrete examples (constraint+shape+location) establishing the root-cause family.
2. **1c.3-A retroactive** — "stated scope < actual scope" named as the structural default planning assumption for cleanup slices.
3. **1c.3-C (this slice)** — pre-execution decision-cluster identified as a distinct halt category alongside pre-execution sweep. Sweep can be thorough yet still surface decisions the plan didn't specify.

Three consecutive slices have shipped under this pattern. The remediation posture for any future cleanup-shaped slice should now plan for **both** halt types (sweep + decision cluster) as standard, not exceptional.

The slice also followed the same-slice open-and-close finding pattern established by 1c.3-B (where R-12 was closed in the slice that opened F-OPS-3 and F-OPS-4). When discovery and resolution share an execution window, splitting them across slice boundaries adds bureaucratic framing without informational value.

## Cross-links

- Slice plan: Clarification 2 in plan v2 (carried into 1c.3-C scope expansion approval).
- Predecessor slice: [1c.3-B outcome](phase-1c3-slice-b-outcome.md).
- Risk-register entries closed: [F-SLICE-E-5](../risk-register/F-SLICE-E-5-solution-class-radio-control-writes-to-dropped-column.md), [F-SLICE-E-6](../risk-register/F-SLICE-E-6-training-status-write-paths-class-defect.md).
- Risk-register entries annotated: [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md).
- Migration `20260426025918` — origin of the 8 dropped columns whose write paths this slice closed.
