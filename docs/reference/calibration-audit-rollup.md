# Calibration audit rollup

> **Pass 5e deliverable.** Single entry point summarizing the state of athlete-lab calibration accuracy and determinism work across Phase 1c.2. Aggregates references to the canonical dataset, related findings, ADRs, and investigation docs. Intended as the doc a coach or new agent reads first when asking "where does calibration stand right now?"
>
> **Status as of 2026-04-26:** Slice B1 verification + Slice E.3.6 post-migration confirm deterministic-within-tolerance behaviour on `slant-route-reference-v1.mp4`. The architectural choice between calibration paths (Slice B2 — `static` vs `body_based` vs world-coordinate Option B) is **deferred** pending the ground-truth dataset growing past N=1.

## TL;DR

| Question | Current answer | Source |
|---|---|---|
| Is the pipeline deterministic on identical input? | Yes — bit-exact within Group A (5 runs) and Group B (2 runs); inter-group drift ~0.78%. | [`determinism-drift.csv`](../reference/determinism-drift.csv), [`phase-1c2-determinism-experiment.md`](../process/phase-1c2-determinism-experiment.md) |
| Is the calibration accurate? | No. All `body_based` values under-report vs. ground truth (~200 vs. ~495 ppy on the reference clip). `static` is worse than `body_based`. | [`calibration-ground-truth-dataset.md`](../reference/calibration-ground-truth-dataset.md), [`F-SLICE-B-1`](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) |
| Are the two calibration paths reconciled? | Yes — Slice C.5 collapsed parallel paths into one edge-function `body_based` path. | [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md) |
| What is the determinism tolerance? | ±1% on `body_based_ppy` between runs of the same upload. | [ADR-0005](../adr/0005-determinism-tolerance-1pct.md) |
| When is the architectural fix? | Deferred to Slice B2 (post-1c.2). Needs N≥3 ground-truth samples first. | [ADR-0004](../adr/0004-calibration-defer-b2-decision.md) |

## Canonical artefacts

- **Ground-truth dataset (prose + YAML):** [`docs/reference/calibration-ground-truth-dataset.md`](../reference/calibration-ground-truth-dataset.md), [`docs/reference/calibration/ground-truth.yaml`](../reference/calibration/ground-truth.yaml), [`docs/reference/calibration/_schema.md`](../reference/calibration/_schema.md).
- **Calibration audit rollup CSV (generated):** [`docs/reference/calibration-audit-rollup.csv`](../reference/calibration-audit-rollup.csv) + [`_schema-calibration-audit-rollup.md`](../reference/_schema-calibration-audit-rollup.md). Produced by [`scripts/aggregate-calibration-audit.ts`](../../scripts/aggregate-calibration-audit.ts) (Pass 5e-bis). Re-run after each new clip in `calibration/*.yaml`.
- **Determinism evidence (CSV + schema):** [`docs/reference/determinism-drift.csv`](../reference/determinism-drift.csv), [`docs/reference/_schema-determinism-drift.md`](../reference/_schema-determinism-drift.md). 9 canonical runs, DB-verified at Pass 5.5 (`SELECT count(*) FROM athlete_lab_results WHERE id::text LIKE ANY(...) → 9`). **Note:** the rollup CSV's full-SHA-256 `calibration_audit_hash` distinguishes two payloads (`26603f63…` vs `884b740b…`) that the determinism CSV's short-hash column conflates; see schema doc for detail.
- **Diagnostic snapshot:** [`docs/reference/phase-1c2-diagnostic-snapshot-2026-04-26.md`](../reference/phase-1c2-diagnostic-snapshot-2026-04-26.md).
- **Slant-route baseline analysis:** [`docs/reference/phase-1c2-baseline-slant-analysis.md`](../reference/phase-1c2-baseline-slant-analysis.md).
- **det_frequency resolution snapshot:** [`docs/reference/phase-1c2-detfreq-resolution-snapshot.md`](../reference/phase-1c2-detfreq-resolution-snapshot.md).
- **Drift log:** [`docs/reference/phase-1c2-determinism-drift-log.md`](../reference/phase-1c2-determinism-drift-log.md).

## Related findings

| ID | Title | Status |
|---|---|---|
| [F-SLICE-B-1](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) | Both calibration paths produce 2.6× distance errors | open / B2 deferred |
| [F-SLICE-B1-2](../risk-register/F-SLICE-B1-2-release-speed-metric-correctness-on-slant-route-reference-v1-mp4.md) | Release-speed metric correctness on reference clip | open |
| [F-SLICE-E-2](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) | 0.78% non-deterministic drift on identical input | open / within tolerance |

## Related ADRs

- [ADR-0004 — Defer Slice B2 calibration decision](../adr/0004-calibration-defer-b2-decision.md)
- [ADR-0005 — Determinism tolerance ±1%](../adr/0005-determinism-tolerance-1pct.md)
- [ADR-0014 — C.5 unified edge-function `body_based` path](../adr/0014-c5-unified-edge-function-body-based-path.md)

## Investigation trail

In rough chronological order:

1. [`investigations/calibration-source-trace.md`](../investigations/calibration-source-trace.md) — origin trace of where `static` and `body_based` ppy values come from.
2. [`investigations/calibration-ppy-investigation.md`](../investigations/calibration-ppy-investigation.md) — empirical comparison; identified the 2.6× under-report.
3. [`investigations/release-speed-velocity-investigation.md`](../investigations/release-speed-velocity-investigation.md) — downstream consequence of ppy error on release speed.
4. [`investigations/first-real-test-diagnostic.md`](../investigations/first-real-test-diagnostic.md) — single-clip end-to-end diagnostic.
5. [`investigations/phase-1c2-camera-guidelines-preflight.md`](../investigations/phase-1c2-camera-guidelines-preflight.md) — preflight for Option B (world-coordinate) feasibility.

## Open questions handed to Phase 1c.3 / B2

- Grow ground-truth dataset to N≥3 distinct clips with diverse camera angles before re-evaluating B2 architecture.
- Resolve the ~0.78% inter-group drift (currently within ADR-0005 tolerance, but worth root-causing if it ever exceeds 1%).
- Decide whether Option B (world coordinates) supersedes both `static` and `body_based`; do not pick between the two imperfect paths in isolation.

## Maintenance

This rollup is **append-only at the link level**: when a new calibration finding, ADR, or investigation lands, add a row/link here. Numerical TL;DR values in §"TL;DR" should be re-derived from the canonical artefacts (CSV, YAML) — never typed in by hand. If a TL;DR value diverges from its source, the source wins; correct this doc.
