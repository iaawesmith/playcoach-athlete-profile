---
id: F-CALIB-1
title: Top-level result_data shadow values disagree with calibration_audit
status: deferred
severity: Sev-3
origin_slice: post-1c
origin_doc: docs/audits/phase-2-smoke-test-2026-05-01.md
related_adrs: [ADR-0014, ADR-0004]
related_entries: [F-SLICE-B-1]
opened: 2026-05-01
last_updated: 2026-05-01
---

# F-CALIB-1 — Top-level `result_data` shadow values disagree with `calibration_audit` (Sev-3, deferred)

## Observation

Every `athlete_lab_results.result_data` row carries calibration information at **two surfaces** that disagree with each other:

| Surface | Source | Read by |
|---|---|---|
| Top-level `result_data.pixels_per_yard` + `result_data.calibration_source` (+ `calibration_details`, `calibration_confidence`) | MediaPipe Cloud Run service-side computation (`mediapipe-service/app/calibration.py`) | **No current consumer.** Surfaces only as a persisted shadow value. |
| `result_data.calibration_audit.selected_ppy` + `selected_source` | Edge-function resolver `resolveCalibration()` per [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md) | The metric runner (canonical), and any future calibration consumer per ADR-0014 |

In the post-1c.3 smoke test (upload `a6c8bb37-2797-49af-a7c4-d98dcbaa5841`):

- Top-level: `pixels_per_yard: 217.088`, `calibration_source: "body_based"`
- Audit: `selected_ppy: 80`, `selected_source: "static"`, `body_based_status: "not_attempted_no_athlete_height"`

The metric runner correctly consumed `80` (audit). The top-level `217.088` was computed by the service for diagnostic/internal purposes but never became canonical. The two surfaces disagree by ~2.7×.

The pre-1c.3 baseline (upload `23936560-1284-4d13-bb68-9894afd2865c`, 2026-04-26) showed the same shape (top-level `235.321` vs audit `201.78`). **This is a pre-existing pattern, not a 1c.3 regression** — but it remains a contract leak that ADR-0014 was designed to prevent at the *consumed* surface and did not address at the *persisted* surface.

## Impact

The metric runner reads the audit, so current pipeline correctness is unaffected. The risk is **future consumers**:

- The athlete-facing UI built in Phase 3 will consume `result_data` for display. A consumer reading `calibration_source` to show "calibrated by body proportions" would be lying when the audit's `selected_source` was actually `static`.
- Any third-party export, CSV pull, or analytics query targeting `result_data->>'pixels_per_yard'` will read a value the metric runner did not use, producing audit-trail divergence between "what we said calibrated this clip" and "what calibrated this clip in fact."
- The `calibration-audit-rollup.csv` ground-truth reconciliation work (Phase 2a) will be muddied if any future contributor reads the wrong surface.

Severity Sev-3 — silent correctness drift in admin/diagnostic output, not in the analyses themselves. Promotes to Sev-2 if any Phase 3 athlete-facing surface ships consuming the top-level shadow values.

## Origin

Documented in [`docs/audits/phase-2-smoke-test-2026-05-01.md`](../audits/phase-2-smoke-test-2026-05-01.md) Anomaly #1. Identified during PHASE-2-SMOKE inspection on 2026-05-01. Pre-existing pattern visible in the 2026-04-26 pre-1c.3 baseline.

ADR-0014 explicitly stated as a non-goal: "the service-side computation, while internally interesting, is no longer surfaced; if a future investigation wants service-side ppy it must re-add the diagnostic with explicit 'non-canonical' framing." The persisted top-level value is exactly what ADR-0014 said should not exist — but the persistence path was not closed when the consumer path was unified. F-CALIB-1 captures that gap.

## Remediation candidates

### (a) Strip shadow values on result write — recommended

In `writeResults()` (`analyze-athlete-video/index.ts:3595+`), spread `cloudRunMetadata` selectively rather than wholesale: omit `pixels_per_yard`, `calibration_source`, `calibration_details`, `calibration_confidence` from the `result_data` payload. The `calibration_audit` surface remains the single source of truth. Single-file edit. Matches ADR-0014's stated design intent. Backward-incompatible only for consumers that don't yet exist.

### (b) Harden shadow as canonical, deprecate `calibration_audit` — not recommended

Reverses ADR-0014's design. Would require re-introducing the F-SLICE-B-1 path-disagreement risk that ADR-0014 was opened to structurally resolve. Listed for completeness only.

### (c) Keep both, document precedence in canonical reference — status quo with explicit warning

Add a section to `docs/architecture/pipeline-trace.md` step 9 and to `docs/reference/_schema-calibration-audit-rollup.md` documenting that the top-level fields are non-canonical service-side diagnostics retained for archaeological purposes; the audit is canonical. Cheapest. Does not fix the leak; relies on every future consumer reading the docs.

## Recommended remediation

**(a)** is structurally correct per ADR-0014's stated design intent. Decision deferred to **Phase 2a calibration architecture decision** (the deferred B2 decision tracked in [ADR-0004](../adr/0004-calibration-defer-b2-decision.md)). When 2a's calibration redesign lands, it should explicitly address shadow-value disposition as part of the same change set rather than as a separate slice — they share the same persistence-shape contract.

Until 2a, status remains `deferred`. Promote to `open` if any Phase 3 surface attempts to consume top-level `pixels_per_yard` or `calibration_source` before 2a closes.

## Cross-references

- [F-SLICE-B-1](F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) — structural sibling: original path-disagreement finding that ADR-0014 was opened to resolve at the *consumed* surface. F-CALIB-1 is the same shape at the *persisted* surface, surfacing because ADR-0014 did not close the persistence path.
- [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md) — the decision that made the consumed path single-source; F-CALIB-1 is the un-addressed half of that decision's intent.
- [ADR-0004](../adr/0004-calibration-defer-b2-decision.md) — Phase 2a calibration architecture; resolution of F-CALIB-1 should ride with this decision.
- [`docs/audits/phase-2-smoke-test-2026-05-01.md`](../audits/phase-2-smoke-test-2026-05-01.md) — Anomaly #1; origin record with concrete value evidence (217.088 vs 80 in current run; 235.321 vs 201.78 in pre-1c.3 baseline).
- [`supabase/functions/analyze-athlete-video/index.ts:3595+`](../../supabase/functions/analyze-athlete-video/index.ts) — `writeResults()` implementation surface for remediation (a).
