---
id: F-SLICE-E-6
title: Training Status tab write paths form a four-column defect class against dropped columns
status: resolved
severity: Sev-3
origin_slice: 1c.3-C
origin_doc: docs/process/phase-1c3-slice-c-outcome.md
related_adrs: []
related_entries: [F-SLICE-E-5, F-OPS-4]
opened: 2026-04-29
last_updated: 2026-04-29
resolved: 2026-04-29
---

# F-SLICE-E-6 — Training Status tab write paths form a four-column defect class against dropped columns

- **Severity:** Sev-3 (graceful save failure, not render crash)
- **Status:** Opened and closed in same slice (1c.3-C). Same-slice open/close pattern follows the 1c.3-B precedent for findings whose discovery and resolution belong to the same execution window.
- **Logged:** 2026-04-29 (1c.3-C pre-execution sweep, expanding F-SLICE-E-5 scope)

## Finding

The pre-execution write-path sweep mandated by F-OPS-4 discipline found that the Solution Class write-path defect described in F-SLICE-E-5 was **one of four identical defects**, not a singleton. All four routed through the same `updateWithCriticalTrack` helper and all four targeted columns dropped in migration `20260426025918`:

| # | Column | UI surface | Write path |
|---|---|---|---|
| 1 | `solution_class` | Solution Class radio (Body / Body+Feet / Wholebody) | onClick → `updateWithCriticalTrack("solution_class", …)` |
| 2 | `performance_mode` | Performance Mode toggle | onChange → `updateWithCriticalTrack("performance_mode", …)` |
| 3 | `det_frequency` | Legacy single-field Detection Frequency input | onChange → `updateWithCriticalTrack("det_frequency", …)` |
| 4 | `tracking_enabled` | Tracking toggle | onChange → `updateWithCriticalTrack("tracking_enabled", …)` |

The save-payload allow-list at `NodeEditor.tsx:~600` already filters out all four (verified during the sweep — no Sev-2 escalation needed), so the surface failure mode would have been a silent persistence failure rather than a 4xx PostgREST error. But the form-state coupling, controlled-input bindings, and click handlers were live for all four.

A second-order consequence: `NodeReadinessBar.tsx` and a `checkCompleteness()` helper in `NodeEditor.tsx` (L167) both gated Set-Live readiness on `solution_class`. After column drop, both gates blocked nodes from reaching Live by referencing a dropped field.

## Decisions made before execution (Q1–Q4)

The pre-execution sweep surfaced four sub-decisions the slice plan didn't anticipate. Each was resolved before any code was edited:

- **Q1 — `det_frequency` scope:** The dropped column is the legacy single-field `det_frequency`, distinct from the active per-context columns `det_frequency_solo` / `det_frequency_defender` / `det_frequency_multiple`. Decision: remove only the legacy single-field control; keep the three per-context controls (they write to columns in the allow-list).
- **Q2 — Second readiness gate (`checkCompleteness`):** Slice plan named only `NodeReadinessBar.tsx` for readiness pruning. Decision: prune both gates. Splitting them would create inconsistent intermediate state where the top-of-editor bar passes but Set-Live blocks. Same-class defects fixed together is consistent with the slice's expanded scope.
- **Q3 — Dead helper cleanup approach:** Decision **3a** — delete all dead helpers (`getSolutionClassWarnings`, `SOLUTION_CLASSES`, `SOLUTION_CLASS_MAP`, the `pipelineCode` legacy template) AND remove the Training Status section from `nodeExport.ts` markdown export entirely. Honest framing: if the columns are gone, the export should not pretend they exist as placeholders or stale fields.
- **Q4 — `TrainingNode` type cleanup:** Decision: remove `solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency`, `reference_object`, `reference_filming_instructions` from the interface this slice. Keep `pro_mechanics` (pinned by V-1c.3-06 — CoachingCues migration subsystem retirement is deferred).

## Resolution applied

- All 4 write-path handlers removed from `NodeEditor.tsx` (`TrainingStatusEditor` call site).
- Solution Class radio, Performance Mode toggle, legacy single-field Detection Frequency input, and Tracking toggle UI controls deleted from `TrainingStatusEditor`.
- `NodeReadinessBar.tsx`: `solution_class === "wholebody3d"` short-circuit dropped from Reference Calibration category (always run per-angle calibration check now); category-specific Training Status checks replaced with a deferred-to-Phase-1 placeholder.
- `NodeEditor.tsx` `checkCompleteness` (L167-187): `solution_class` gate removed.
- `nodeExport.ts`: `generateTrainingStatus()` deleted; `training_status` removed from `TabKey` union, `TAB_GENERATORS`, `TAB_LABELS`, and `tabOrder`; the `# Solution Class:` header line in `generateFullNodeMarkdown` deleted; orphan import of `getActiveMetrics` removed.
- 6 fields removed from `TrainingNode` interface in `types.ts` (per Q4).
- `TrainingStatusEditor` refactored from ~270 LOC to ~125 LOC.
- Build green: `tsc --noEmit` exit 0, no output.

## Cross-references

- **F-SLICE-E-5** — same defect class, narrower (single-column) framing. F-SLICE-E-6 is the expanded class, resolved in the same execution. F-SLICE-E-5 is now resolved with a pointer to this entry.
- **F-OPS-4** — third consecutive slice where pre-execution sweep surfaced expanded scope; this slice also added the **pre-execution decision-cluster** sub-pattern to F-OPS-4 (sweep was thorough, but reality required scope decisions the plan didn't anticipate).
- Migration `20260426025918` — origin of the dropped columns.
- `docs/process/phase-1c3-slice-c-outcome.md` — slice outcome.
