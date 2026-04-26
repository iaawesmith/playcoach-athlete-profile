---
id: ADR-0014
title: C.5 unified body_based calibration on the edge-function path
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SLICE-B-1]
supersedes: []
superseded_by: []
---

# ADR-0014 — Unified `body_based` calibration on the edge-function path (Slice C.5)

## Context

Pre-C.5, two parallel `body_based` calibrations existed on every analysis
run, computed independently and disagreeing on the same input:

- **MediaPipe service-side** (`mediapipe-service/app/calibration.py`, L17–18) computed its own `body_based` ppy using fixed anthropometric constants (`SHOULDER_YARDS = 0.45`, `HIP_YARDS = 0.32`) and percentile (median) statistics. The result was persisted in `result_data.pixels_per_yard` at the top level.
- **Edge function** (`calculate_body_based_calibration` inside the analysis edge function) computed an independent `body_based` ppy via its own arithmetic on the same MediaPipe landmarks. The result drove every downstream metric.

The MediaPipe-service value was **dead data** — silently rejected by the
edge function's range gate (`40 ≤ ppy ≤ 120`, `isDynamicCalibrationTrusted`
at line 1303). On the d1b3ab23 baseline clip the service emitted
`ppy = 277.785` while the edge function consumed `ppy = 167.87`. Two
sources of truth, no surfaced disagreement, only one consumed.

`docs/investigations/calibration-source-trace.md` (now stub-redirected
into `docs/migration-risk-register.md` under `F-SLICE-B-1`) traced the
divergence. `docs/process/phase-1c2-slice-b1-outcome.md` (lines 89–95)
defined Slice C.5 as the unification step plus structured
`calibration_audit` logging, with a 5-run byte-identical determinism
verification gate.

## Decision

Collapse the two parallel `body_based` paths into a single edge-function
path:

1. **Edge function is the only `body_based` consumer.** `calculateBodyBasedCalibration` in the analysis edge function is the canonical path for `body_based` ppy used by metric calculations.
2. **MediaPipe service no longer emits `body_based`.** The service-side calibration computation is removed from the response payload. (Until B2 lands, the service may still compute it internally for diagnostic logging only — but it MUST NOT be persisted into `result_data` where downstream code could read it.)
3. **Structured `calibration_audit` payload** logged on every analysis, containing `body_based_ppy`, `static_ppy`, and explicit status enums regardless of which path is selected. Determinism-preserving (no timestamps, no random IDs). This is the structured artifact future ground-truth measurements join (per ADR-0013).
4. **Selection priority unchanged in C.5.** C.5 is the unification + audit step; the calibration *selection* policy (when to prefer body_based vs static vs dynamic) is a separate B2 decision, currently deferred per ADR-0004.
5. **Verification gate.** 5-run byte-identical determinism check on `result_data.calibration_audit` — matches Slice A R-04 rigor.

Explicitly **not** doing in C.5: changing `body_based` math, changing
`static` calibration values, changing selection priority, deleting
`calculateBodyBasedCalibration` (Option A withdrawn — see Slice B1
outcome line 81).

## Consequences

- **Positive:** one source of truth for `body_based` ppy. Path disagreement (F-SLICE-B-1) is structurally impossible post-C.5.
- **Positive:** structured `calibration_audit` makes future ppy investigations a SELECT, not a diff between two opaque code paths.
- **Positive:** determinism is preserved — verified by a byte-identical 5-run gate.
- **Negative:** the service-side computation, while internally interesting, is no longer surfaced; if a future investigation wants service-side ppy it must re-add the diagnostic with explicit "non-canonical" framing.
- **Operational:** any new calibration path (e.g., true dynamic line-pair detection) MUST land via the same audit payload contract — never as a parallel value persisted at the top level of `result_data`.

## Cross-links

- F-SLICE-B-1 — the path-disagreement finding this decision structurally resolves (`docs/migration-risk-register.md`).
- `docs/process/phase-1c2-slice-b1-outcome.md` — Slice C.5 scope definition (lines 89–95).
- `docs/investigations/calibration-ppy-investigation.md` (stub) and `docs/investigations/calibration-source-trace.md` — original divergence trace.
- ADR-0004 — B2 calibration architecture decision (selection policy) deferred separately.
- ADR-0009 — MediaPipe runs on Cloud Run; this ADR narrows what its output payload is allowed to contain.
- ADR-0013 — structured-data policy that the `calibration_audit` payload exemplifies.
- Implementation surfaces: `mediapipe-service/app/calibration.py`, analysis edge function (`calculateBodyBasedCalibration`, `result_data.calibration_audit`).
