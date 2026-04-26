# Phase 1c.2 — Baseline Slant Analysis

> **Status:** Reference. Captured pre-Slice-A as the baseline for the Slant route ground-truth clip. Numerical values cited here are the source for the determinism drift log baseline (becoming `docs/reference/determinism-drift-log.csv` in Pass 3c) and the calibration ground-truth YAML (Pass 3b). Do not edit; treat as immutable historical baseline.

**Captured:** 2026-04-25 (pre-Slice-A baseline)
**Purpose:** Frozen baseline of Slant analysis behavior immediately after Phase 1c.1 ship + Slant migration confirmed + `llm_prompt_template` rewired with `{{phase_context}}`, `{{scoring_rules}}`, `{{node_overview}}`. Used as the diff target after Slice B (theater-field removal + det_frequency collapse + body-based calibration deletion) to detect any regression.
**Source:** `athlete_lab_results` row for `upload_id = aea2109e-bbd0-476f-8004-4e7e9b338764`, the most recent `complete` analysis at time of capture.

## Upload Context

| Field | Value |
|---|---|
| upload_id | `aea2109e-bbd0-476f-8004-4e7e9b338764` |
| node_id | `75ed4b18-8a22-440e-9a23-b86204956056` (Slant) |
| node_version | 6 |
| analyzed_at | 2026-04-25 01:37:45 UTC |
| Clip duration | 3 seconds |
| Source FPS | 30 |
| Total frames | 85 |

## Aggregate

| Field | Value |
|---|---|
| `aggregate_score` | **27** |
| `overall_score` | null |
| `confidence_flags` | `[]` |
| `detected_errors` | 5 conditions evaluated; 5 triggered (3 auto-detectable, 2 narrative-only) |

## Phase Scores

| Phase | Score |
|---|---|
| Release | 0 |
| Stem | 0 |
| Break | 56.19 |
| Catch Window | 0 |
| YAC (After Catch) | 0 |

## Metric Values (4 metrics)

| Metric | Value | Unit | Elite Target | Tolerance | Raw Score | Weight | Phase |
|---|---|---|---|---|---|---|---|
| Plant Leg Extension | **103.37** | degrees | 140 | 15 | 27.89 | 50 | Break |
| Hip Stability | **0.09** | yards | 0.05 | 0.03 | 84.49 | 15 | Break |
| Release Speed | **158.94** | mph | 7 | 2 | 0 | 20 | Release |
| Hands Extension at Catch | **1.74** | yards | 0.4 | 0.15 | 0 | 15 | Catch Window |

**Note:** Release Speed of 158.94 mph is anomalous and known — captured here verbatim as pre-1c.2 baseline. Documented separately in `docs/release-speed-velocity-investigation.md`.

## Calibration

| Field | Value |
|---|---|
| `calibration_source` | **`body_based`** |
| `calibration_confidence` | **`high`** (numeric: 0.6708) |
| `method` | `multi_frame_body_proportions_hips_shoulders` |
| `pixels_per_yard` | 200.4205 (per-metric) / 277.785 (rtmlib root) |
| `expectedHipWidthYards` | 0.382 |
| `expectedShoulderWidthYards` | 0.518 |
| `hipWidthPixels` | 64.54 |
| `shoulderWidthPixels` | 120.12 |
| `framesUsed` | 17 (per-metric calibrationDetails) / 83 (rtmlib body_based summary) |
| `dynamicFailureReason` | `dynamic_pixels_per_yard_out_of_range` |

**Calibration architecture observation (relevant to Tab 8 Option A):**
- Dynamic calibration (field markings) **failed** with reason `dynamic_pixels_per_yard_out_of_range` — confirms dynamic path is not currently working for this clip.
- Body-based calibration **succeeded** with confidence 0.67 ("high" qualitative flag).
- Static calibration (the surviving fallback under Option A) was **not exercised** on this run — the body-based path won before static was needed.
- **Risk to validate in Slice B doc reads:** if `calibration-source-trace.md` or `calibration-ppy-investigation.md` reveals this is a clip where neither dynamic nor static would have produced a usable `pixels_per_yard`, then deleting body-based is a regression. **Halt Slice B and surface as Finding** if so.

## Claude / LLM Output

| Field | Value |
|---|---|
| Model | `claude-sonnet-4-5` |
| Status | COMPLETE |
| Truncated | true |
| Target words | 150 |
| Actual word count | 169 |
| `system_tokens` | 221 |
| `template_tokens` | 198 |
| `variable_tokens` | 108 |
| `prompt_tokens` (input total) | 503 |
| `response_tokens` (output) | 245 |
| `total_tokens` | 748 |
| `system_instructions_chars` | 881 |
| `system_instructions_present` | true |

### Variables Injected

| Variable | Present | Summary |
|---|---|---|
| mastery_score | ✅ | 27 |
| phase_scores | ✅ | Release: 0/100, Stem: 0/100, Break: 56/100, Catch Window: 0/100, YAC: 0/100 |
| metric_results | ✅ | Plant Leg Extension: 103.37° (target 140°, score 27.89/100); Hip Stability: 0.09yd; Release Speed: 158.94mph; Hands Extension: 1.74yd |
| confidence_flags | ❌ | (empty array, not injected) |
| detected_errors | ✅ | "Confirmed errors observed: " (narrative seed only) |
| athlete_name | ✅ | "Athlete" |
| node_name | ✅ | "Slant" |
| position | ✅ | "WR" |
| athlete_level | ✅ | "high_school" |
| focus_area | ❌ | (empty / not injected) |
| skipped_metrics | ❌ | (empty / not injected) |

`missing_variables` reported by edge function: `[confidence_flags, focus_area, skipped_metrics]`

### Full Feedback Text (verbatim)

> **Your break is incomplete — you're not extending through the plant.**
>
> Your plant leg hit 103° extension when you need 140°+. That shallow knee angle means you're sitting into the cut instead of exploding out of it. On a slant, that costs you separation at the stem and kills your ability to accelerate into the throwing window. You're basically giving the DB a free step.
>
> **Fix the plant mechanic.** Drive your inside foot into the ground with a fully extended leg — think "stomp and spring," not "sit and pivot." That extension loads the posterior chain and fires you laterally. Right now you're absorbing force instead of redirecting it.
>
> **Next rep drill:** 3-step approach, plant with exaggerated leg lockout, and explode at 45° for 5 yards. Feel the difference between sitting (what you did) and stomping (what creates separation). Film it side-angle so you see that back leg straighten on contact.
>
> Your hip stayed tight (0.09yd drift) — that's solid. Now finish the plant and this route scores 60+.

## MediaPipe / Cloud Run Request Payload Shape (current contract)

Source: `supabase/functions/analyze-athlete-video/index.ts` lines 3373–3381 (and call site lines 651–660). Logs for this specific run had already rolled at capture time, so the payload is documented from source code as the authoritative pre-1c.2 contract.

Current `requestPayload` sent to MediaPipe service (7 keys):

```json
{
  "video_url": "<signed URL>",
  "start_seconds": 0,
  "end_seconds": 3,
  "solution_class": "wholebody",
  "performance_mode": "balanced",
  "det_frequency": 2,
  "tracking_enabled": true
}
```

**Slice B target:** drop `solution_class`, `performance_mode`, `tracking_enabled` → 4-key payload `{video_url, start_seconds, end_seconds, det_frequency}`. R-08 contract verification (via `logInfo('mediapipe_request_payload', { keys })`) must show exactly those 4 keys post-Slice-B.

## RTMLib / Cloud Run Response Summary

| Field | Value |
|---|---|
| backend | `cloud_run` |
| solution_class | `wholebody` (echoed in response) |
| total_frames | 85 |
| source_fps | 30 |
| average_keypoint_confidence | 0.89 |
| reliable_frame_percentage | 88.9 |
| auto_zoom_applied | true |
| auto_zoom_factor | 1.75 |
| auto_zoom_final_fill_ratio | 0.0279 |
| auto_zoom_reason | `fill_ratio 0.03 < 0.3` |
| safety_backoff_applied | false |
| person_detected | true |
| person_detection_confidence | 0.976 |
| movement_direction | stationary |

## Phase Windows (segmentation output)

| Phase | Start frame | End frame | Frame count | % of clip |
|---|---|---|---|---|
| Release | 0 | 15 | 16 | 19% |
| Stem | 10 | 37 | 28 | 33% |
| Break | 30 | 45 | 16 | 19% |
| Catch Window | 38 | 74 | 37 | 44% |
| YAC (After Catch) | 69 | 84 | 16 | 19% |

## Scoring Config Used

```
confidence_handling: skip
flagged_count: 0
min_metrics_threshold: 50
renormalize_on_skip: true
total_metrics: 4
scored_count: 4
skipped_count: 0
skipped_percent: 0
```

## Diff Targets for Slice B Verification

After Slice B ships, re-run a Slant analysis and compare:

1. **Identical:** 4 metric values (within ±0.01 numeric noise tolerance), phase_scores, aggregate_score, calibration_source, calibration_confidence, calibration_details (all body-based fields removed → expected to flip to `static` or `pixel_warning` source — this is the **expected** Slice B regression and is the entire point of Option A).
2. **Identical contract:** `mediapipe_request_payload` log line should show exactly 4 keys.
3. **Token counts:** `system_tokens`, `template_tokens`, `variable_tokens` may shift slightly due to template variable changes, but `total_tokens` should remain in the same order of magnitude (~700–900 range).
4. **Feedback quality:** narrative coherence, structural format (bold openers, fix → drill → tail), word count near target. Slice B should not change feedback quality — only mechanical pre-LLM data plumbing.
5. **R-09:** every `{{variable}}` referenced by Slant's `llm_prompt_template` must still resolve to non-error content; `missing_variables` should not grow beyond the current `[confidence_flags, focus_area, skipped_metrics]` set.
