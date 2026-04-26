---
id: ADR-0005
title: ±1% determinism tolerance with bimodal-mode awareness
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SLICE-E-2]
supersedes: []
superseded_by: []
---

# ADR-0005 — ±1% determinism tolerance with bimodal-mode awareness

## Context

During Slice E verification, identical inputs to the analysis pipeline produced two distinct `calibration_audit` outputs on the canonical Slant clip:

- **Group A:** `body_based_ppy = 200.21353797…` (baseline hash `34a87126…`)
- **Group B:** `body_based_ppy = 201.78272550…` (alt hash `26603f63…` / `884b740b…`)

The Group B value is **bit-identical** between the two Group B observations (`a164c815` historical and `1a5996b0` post-migration). This rules out continuous floating-point drift; the noise is a discrete bimodal mode (likely Cloud Run cold/warm start, GPU/CPU model fallback, or replica-served-different-weights — see F-SLICE-E-2).

Drift magnitude: **+0.7838%** between modes. The pipeline is not byte-deterministic, but it is not *random* either. Verification scripts that demand exact hash match would halt on every Group B run.

## Decision

Adopt **±1% tolerance** as the determinism pass criterion for `calibration_audit` numeric fields:

| Condition | Outcome |
|---|---|
| Hash exact match | Pass |
| Categoricals exact + numeric drift ≤ ±1% | Pass + log to drift CSV |
| Numeric drift > ±1% and ≤ ±2% | Halt for investigation |
| Numeric drift > ±2% | Halt — regression |
| Any categorical mismatch | Halt |

Tolerance applies per-field to: `body_based_ppy`, `body_based_confidence`, `selected_ppy`. Categorical fields (`source`, `selection_reason`, `static_ppy`) must match exactly.

**Bimodal-mode handling:** every drift run is logged to `docs/reference/determinism-drift.csv`. If a third mode appears (a new hash that is neither the Group A nor known Group B hash), this ADR is invalidated and the noise floor must be re-characterized before the next pipeline change.

## Consequences

- **Positive:** verification can proceed without false halts on the established noise floor.
- **Positive:** the drift envelope is observable over time — drift expansion past ±1% becomes a visible signal, not noise hidden by exact-match failures.
- **Negative:** real regressions ≤ ±1% on numeric fields are hidden until they trigger a categorical mismatch or grow past ±1%.
- **Negative:** the tolerance is empirically derived from one clip; future clips may have different noise floors. If a new clip's noise floor exceeds ±1%, ADR needs amendment.

## Cross-links

- F-SLICE-E-2 — root finding (status: open, root cause not yet investigated).
- `docs/reference/determinism-drift.csv` — append-only log of all observations.
- `docs/reference/_schema-determinism-drift.md` — decision matrix and append workflow.
- `docs/process/phase-1c2-determinism-experiment.md` — original investigation writeup.
