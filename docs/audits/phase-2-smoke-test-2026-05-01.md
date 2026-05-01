# Phase 2 Smoke Test — Post-1c.3 Pipeline Inspection (2026-05-01)

> **Verdict:** **PASS WITH NOTES.**
> **Status:** Pipeline ran end-to-end. ADR-0014 `calibration_audit` contract honored. Two notes surfaced: (1) admin UI did not pass `athlete_height` into `analysis_context`, causing body-based calibration to fall through to static and aggregate score to collapse from 61 → 12 vs the pre-1c.3 baseline; (2) the `result_data` top-level still surfaces a non-canonical `pixels_per_yard` (217.088) and `calibration_source` ("body_based") that disagree with the canonical `calibration_audit.selected_ppy` (80) and `selected_source` ("static") that drove the metrics. Pattern is the same shape as F-SLICE-B-1 dead-data; ADR-0014 made the *consumed* path single-source but did not strip the service-side shadow value from the persisted record.

This doc supersedes the halt record in `phase-2-smoke-test-2026-05-01.md` v1 (re-written in place after Option A — fresh upload — completed).

## Context

Read-only inspection slice. Confirms the pipeline produces a clean `result_data` row after Phase 1c.3 consolidation (1c.3-A through 1c.3-F + PHASE-1C3-PREP + PHASE-1C3-POLISH). Dogfooding, not a Phase 2a step. Success criterion is *existence* of a clean post-1c.3 result row, not calibration accuracy.

A prior failed upload (2026-04-29 01:14) was halted on; user re-triggered through the Athlete Lab admin UI; this doc audits the resulting successful run.

## Test inputs

| Field | Value |
|---|---|
| `upload_id` | `a6c8bb37-2797-49af-a7c4-d98dcbaa5841` |
| `result_id` | `ec...` (resolved via FK; not surfaced in row dump) |
| `athlete_id` | `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b` (`FIXED_TEST_ATHLETE_ID`) |
| `node_id` | `75ed4b18-8a22-440e-9a23-b86204956056` (Slant) |
| `node_version` | 6 |
| `clip` | admin re-upload tagged `75ed4b18-...-1777603091842.mp4` (Slant reference content; not the original `slant-route-reference-v1.mp4` filename) |
| `start_seconds`, `end_seconds` | 0, 3 |
| `camera_angle` | `sideline` |
| `analysis_context` | `{athlete_level: high_school, camera_angle: sideline, catch_included: true, catch_status: yes, end_seconds: 3, focus_area: "", people_in_video: solo, performance_description: "", route_direction: left, start_seconds: 0}` |

**Note:** `analysis_context` has no `athlete_height` key. This is the root cause of the body-based fallthrough below.

## Pipeline status — COMPLETE

| Field | Value |
|---|---|
| `status` | `complete` |
| `error_message` | `null` |
| `progress_message` | `Analysis complete` |
| `upload_created_at` | 2026-05-01 02:38:15.561 UTC |
| `analyzed_at` | 2026-05-01 02:39:00.501 UTC |
| **wall time** | **~45 seconds** |

Cloud Run + Claude breakdown is not separable from `log_data` (no `pipelineTimingMs` key present — see Anomalies #4). 45s end-to-end is well within expected envelope; no zombie pattern, no Cloud Run cold-start spike (would be 5-15s additional), no Claude latency spike (Claude returned `status:COMPLETE` with `truncated:true` at the 745-token cap).

## `result_data` shape verification — PASS

All ADR-0014-required keys present at the top level of `result_data`:

| Key | Present | Notes |
|---|---|---|
| `log_data` | ✓ | sub-keys: `aggregate`, `claude_api`, `error_detection`, `metrics`, `preflight`, `rtmlib`, `scoring_config`, `timestamp` |
| `calibration_audit` | ✓ | full ADR-0014 field set — see next section |
| `pixels_per_yard` | ✓ | **217.088** — but see Anomaly #1, this is non-canonical |
| `calibration_source` | ✓ | **"body_based"** — but see Anomaly #1, disagrees with audit |
| `calibration_confidence` | ✓ | "high" |
| `calibration_details` | ✓ | service-side shadow computation; `method:body_based` |
| `auto_zoom_*` (factor, applied, padding, reason, crop_rect, final_fill_ratio) | ✓ all six | crop applied at 1.75x; final fill ratio 0.0688 (low) |
| `movement_direction`, `movement_confidence` | ✓ | `stationary`, `0` |
| `safety_backoff_applied` | ✓ | `false` |
| `person_detection_confidence` | ✓ | `1` |
| `mean_keypoint_confidence_before_auto_zoom` | ✓ | 0.7304 |
| `mean_keypoint_confidence_after_auto_zoom` | ✓ | 0.7603 |

`feedback` column populated cleanly (see §Claude). `confidence_flags` empty array. `detected_errors` array length 1 with single null entry (see Anomaly #5).

## `calibration_audit` — ADR-0014 field-by-field

| Field | Value | Notes |
|---|---|---|
| `node_id` | `75ed4b18-8a22-440e-9a23-b86204956056` | matches |
| `node_version` | 6 | matches |
| `camera_angle` | `sideline` | matches context |
| `athlete_height_provided` | **`false`** | drives `body_based_status` |
| `body_based_ppy` | `null` | not computed (no athlete height) |
| `body_based_status` | `not_attempted_no_athlete_height` | explicit, well-formed enum |
| `body_based_confidence` | `null` | consistent with not-attempted |
| `static_ppy` | `80` | from node `reference_calibrations` |
| `static_status` | `used` | |
| `dynamic_status` | `failed` | |
| `dynamic_failure_reason` | `dynamic_pixels_per_yard_out_of_range` | well-formed enum |
| `selected_source` | **`static`** | per priority `dynamic→body_based→static→none`, dynamic failed and body_based not attempted, so static |
| `selected_ppy` | **`80`** | matches `static_ppy` |

Full ADR-0014 contract present. No missing fields. Selection priority matches `pipeline-trace.md` step 6: dynamic failed → body_based not attempted → static used. **Audit record is internally consistent.** What is *not* consistent is the audit record vs the top-level `result_data.pixels_per_yard` / `calibration_source` — see Anomaly #1.

## Metric results — 4 metrics, all scored, no NaN/Inf/null

| Metric | Value | Unit | Target | Score / 100 | Status | Calibration source consumed |
|---|---|---|---|---|---|---|
| Plant Leg Extension | 101.95 | degrees | 140 | 23.15 | scored | n/a (angle, no ppy) |
| Hip Stability | 0.31 | yards | 0.05 | 0 | scored | static (ppy=80) |
| Release Speed | 23.5 | mph | 7 | 0 | scored | static (ppy=80) |
| Hands Extension at Catch | 0.60 | yards | 0.4 | 0 | scored | static (ppy=80) |

All distance/velocity metrics consumed `pixelsPerYard: 80` from `calibrationDetails.matchedCalibration` (static, ADR-0014-canonical), confirming the metric runner reads `calibration_audit.selected_ppy` rather than the top-level shadow value. Good — the dead-data shadow at the top level is *persisted but not consumed*.

`Hands Extension at Catch` consumed keypoints (19, 20) with confidence 0.52/0.15 — both flagged UNRELIABLE in `rtmlib.keypoint_confidence` (percent_below: 100). The metric ran but the underlying keypoints are noise. Not a pipeline bug; a known sideline-camera limitation for hand keypoints.

### `phase_scores`

| Phase ID | Phase Name (from variables_injected) | Score |
|---|---|---|
| `b0484d0c...` | Catch Window | 0 |
| `d07d6365...` | Release | 0 |
| `e63c5444...` | Break | 11.58 |

(Stem and YAC have no metrics assigned, hence absent from the `phase_scores` map but present in the Claude prompt summary as 0/100.)

`aggregate_score` = **12** (= mastery_score per `log_data.aggregate`).

## Claude prompt + response — PASS

| Field | Value |
|---|---|
| `model` | `claude-sonnet-4-5` |
| `status` | `COMPLETE` |
| `prompt_tokens` | 495 |
| `response_tokens` | 250 |
| `total_tokens` | 745 |
| `target_words` | 150 |
| `word_count` | 154 |
| `truncated` | `true` (hit target word cap, not a Claude failure) |
| `system_instructions_present` | `true` (881 chars) |

Feedback paragraph rendered cleanly. No `{{phase_context}}` or other template variables bled through to the user-visible text. Sample (first paragraph):

> Listen up — **your release speed came in at 23.5 mph when we need 7 mph max**. You're telegraphing this route before you even get into your stem. Defenders are reading you a mile away.

`variables_injected` confirms post-1c.3 prompt template wiring is correct: `mastery_score`, `phase_scores`, `metric_results`, `detected_errors`, `athlete_name`, `node_name`, `position`, `athlete_level` all present and populated. Three variables marked `present:false`: `confidence_flags`, `focus_area`, `skipped_metrics` — all three are surfaced in `claude_api.missing_variables`. None are required for the prompt to render coherently; they are template optional-fills. **No knowledge_base bleed-through observed**, confirming the 1c.3-B kb.mechanics → kb.phases merge and 1c.3-D 5-key kb merge produced consistent runtime behavior.

## Pipeline timing

| Stage | Duration | Notes |
|---|---|---|
| Upload INSERT → analyzed_at | ~45s | end-to-end wall time |
| Cloud Run portion | unknown | `log_data.pipelineTimingMs` not present |
| Claude API portion | unknown | not separated in `log_data.claude_api` |
| Edge function portion | unknown | not separated |

45s end-to-end is healthy. No anomalies. The lack of per-stage timing breakdown is Anomaly #4 below.

## Anomalies

| # | Severity | Finding |
|---|---|---|
| 1 | **Warning (regression-shape)** | `result_data.pixels_per_yard` (217.088) and `result_data.calibration_source` ("body_based") at the top level **disagree with** the canonical `calibration_audit.selected_ppy` (80) and `selected_source` ("static") that the metric runner consumed. Metrics are unaffected (they read the audit), but the persisted top-level fields surface a service-side shadow value that no consumer reads. Same shape as F-SLICE-B-1 (dead-data divergence); ADR-0014 made the *consumed* path single-source but did not strip the service-side shadow from the record. Pre-1c.3 baseline (04-26) showed the same pattern (top-level 235.321 vs audit 201.78), so this is **pre-existing, not a 1c.3 regression** — but it remains a contract leak worth surfacing for Phase 2 calibration work. |
| 2 | **Warning (admin UI)** | `analysis_context` lacks `athlete_height`, causing `body_based_status: not_attempted_no_athlete_height` and forcing fallthrough to `static_ppy=80`. Aggregate score collapsed 61 → 12 vs pre-1c.3 baseline. Not a pipeline regression — the pipeline correctly handled the missing input — but the admin UI evidently dropped the `athlete_height: {value: 74, unit: inches}` shape that 1c.2-era admin uploads carried. Worth a separate fix in admin UI surface (out of scope for this slice). |
| 3 | **Info** | `Hands Extension at Catch` metric consumed keypoints 19/20 with confidence 0.47/0.13 (both UNRELIABLE per rtmlib's own scoring). Metric ran without surfacing a `confidenceFlag`. This is a known sideline-camera limitation for hand keypoints; flagging only because it could explain why `confidence_flags` array is empty when at least one metric arguably should have flagged. Possible future tightening of the per-metric confidence-flag emission. |
| 4 | **Info** | `log_data` has no `pipelineTimingMs` key. Per-stage timing (Cloud Run vs Claude vs edge) cannot be derived from the persisted record. Not a regression (pre-1c.3 baseline also lacks it), but worth a Phase 2 observability slice. |
| 5 | **Info** | `detected_errors` is `[null]` (array length 1, single null element) instead of `[]`. Cosmetic shape issue; downstream code that filters `.filter(Boolean)` is unaffected, but a `WHERE detected_errors @> '[null]'` query would surface unexpectedly. |
| 6 | **Info** | `claude_api.truncated: true` because `target_words=150` was hit at `word_count=154`. This is the intended cap, not a failure. Surfaced for clarity. |

No critical or regression-class anomalies. No null/NaN/Infinity in metric values. `result_data` carries every top-level key the prior baseline did.

## Pre-1c.3 baseline comparison

Baseline run: upload `23936560-1284-4d13-bb68-9894afd2865c`, 2026-04-26 03:00:51 UTC (1c-slice-e-e36-post-migration, pre-1c.3-A).

| Field | Baseline (04-26) | Current (05-01) | Delta |
|---|---|---|---|
| `aggregate_score` | 61 | 12 | **-49** (explained by missing `athlete_height` in current run, not pipeline regression) |
| `calibration_audit.athlete_height_provided` | `true` | `false` | input difference |
| `calibration_audit.body_based_status` | `used` | `not_attempted_no_athlete_height` | downstream of input difference |
| `calibration_audit.body_based_ppy` | 201.78 | `null` | downstream of input difference |
| `calibration_audit.selected_source` | `body_based` | `static` | downstream of input difference |
| `calibration_audit.selected_ppy` | 201.78 | 80 | downstream of input difference |
| `calibration_audit.static_ppy` | 80 | 80 | identical (per ADR-0005 ±1% tolerance, this is exact) |
| `calibration_audit.dynamic_status` | `failed` | `failed` | identical |
| `result_data.pixels_per_yard` (top-level shadow) | 235.321 | 217.088 | both differ from audit selected_ppy in both runs (Anomaly #1 is pre-existing) |
| `result_data` top-level key set | 18 keys | 18 keys (same set) | identical shape |

**Verdict on baseline comparison:** the score delta is fully explained by the input difference (missing `athlete_height`); the pipeline shape and ADR-0014 contract are stable across the 1c.3 cleanup. No measurable regression attributable to 1c.3 work.

## Cross-links

- [`docs/architecture/pipeline-trace.md`](../architecture/pipeline-trace.md) — step-by-step trace; `calibration_audit` shape per step 6
- [`docs/adr/0014-c5-unified-edge-function-body-based-path.md`](../adr/0014-c5-unified-edge-function-body-based-path.md) — `calibration_audit` contract this run was verified against
- [`docs/adr/0005-determinism-tolerance-1pct.md`](../adr/0005-determinism-tolerance-1pct.md) — ±1% tolerance applied to baseline comparison
- [`docs/risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md`](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) — original path-disagreement finding; Anomaly #1 is structurally similar (shadow value persists at top level)
- [`docs/reference/calibration-audit-rollup.csv`](../reference/calibration-audit-rollup.csv) — historical calibration_audit dataset; this run extends it
- Prior halt-outcome version of this doc was overwritten in place

## Phase 2 prep backlog — bonus surface (queued, not opened)

**Operational gotcha — F-OPS-5 candidate (Sev-3):** Admin-test uploads triggered while a target node is in `draft` fail with the misleading error `Node not found or not live: <node_id>` from `fetchNodeConfig` (`supabase/functions/analyze-athlete-video/index.ts:928-932`). The error surfaces the node ID but does not disclose that the actual cause is the hard `status='live'` filter on the lookup. This breaks dogfooding any time a node is mid-edit during a phase, and was the root cause of the failed 2026-04-29 upload that blocked the first attempt at this smoke test. Three candidate remediations: (a) workflow doc note in `docs/agents/workflows.md` reminding agents to publish before triggering admin tests; (b) edge-function diagnostic split — return "node exists but in draft" separately from "node ID does not exist"; (c) admin-test bypass — when `athlete_id === FIXED_TEST_ATHLETE_ID`, allow analyzer to read draft nodes (with `result_data.node_status_at_run` tagging for traceability). Sev-3, operational hygiene, structural sibling of F-OPS-1 zombie pattern. **Not opened in this slice;** queued for Phase 2 prep triage to decide between workflow-doc-only, error-message-fix, or analyzer-side bypass.

## Summary verdict

**PASS WITH NOTES.**

- Pipeline ran end-to-end, 45s wall time, no failures.
- ADR-0014 `calibration_audit` contract fully present and internally consistent.
- All 4 metrics scored, no null/NaN/Inf.
- Claude prompt + response well-formed, no template bleed-through.
- `result_data` shape stable vs pre-1c.3 baseline.
- Aggregate score regression (61 → 12) is **fully explained by missing `athlete_height` in `analysis_context`**, not by 1c.3 pipeline changes.
- Two pre-existing warnings worth Phase 2 attention: top-level `pixels_per_yard`/`calibration_source` shadow drift (Anomaly #1) and admin UI dropping `athlete_height` (Anomaly #2).
- One operational gotcha queued for Phase 2 prep backlog (F-OPS-5 candidate, Sev-3).

Phase 2a is unblocked from a smoke-test perspective. Recommend resolving Anomaly #2 (admin UI `athlete_height` injection) before any further dogfood runs to avoid score-collapse confusion in subsequent inspections.
