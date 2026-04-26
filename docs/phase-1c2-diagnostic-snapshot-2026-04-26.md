# Phase 1c.2 — Diagnostic Snapshot

**Date:** 2026-04-26
**Clip:** `slant-route-reference-v1.mp4` (`athlete-videos/test-clips/slant-route-reference-v1.mp4`)
**Window:** start_seconds=0, end_seconds=3, sideline angle, athlete_height=74"
**Upload ID:** `a164c815-0fa7-4705-8970-910fe93ef859`
**Result ID:** `a120daa7-8643-4fcb-b055-92374d246fff`
**Node:** Slant (`75ed4b18-8a22-440e-9a23-b86204956056`), node_version 6
**Status at write time:** Slice C shipped, Slice D applied (preview), Slice E not yet started
**Purpose:** pure observation snapshot — no comparison against expected values, no fix attempts.

---

## 1. Calibration audit (full object)

```json
{
  "node_id": "75ed4b18-8a22-440e-9a23-b86204956056",
  "node_version": 6,
  "camera_angle": "sideline",
  "athlete_height_provided": true,
  "selected_source": "body_based",
  "selected_ppy": 201.7827255013638,
  "body_based_status": "used",
  "body_based_ppy": 201.7827255013638,
  "body_based_confidence": 0.7817768960473507,
  "static_status": "computed_but_not_selected",
  "static_ppy": 80,
  "dynamic_status": "failed",
  "dynamic_failure_reason": "dynamic_pixels_per_yard_out_of_range"
}
```

Calibration audit SHA-256: `26603f63a77266f3a2f7e2c0dc4ae0cb5e37126353f7e9b65a3cdf3398c4d032`

### 1a. Edge-function `calibration_details` (the body_based math, full)

```json
{
  "method": "multi_frame_body_proportions_hips_shoulders",
  "pixelsPerYard": 201.7827255013638,
  "dynamicFailureReason": "dynamic_pixels_per_yard_out_of_range",
  "hipWidthPixels": 75.63790798676385,
  "shoulderWidthPixels": 112.28717478327589,
  "framesUsed": 18,
  "expectedHipWidthYards": 0.3926111111111111,
  "expectedShoulderWidthYards": 0.5323888888888888
}
```

### 1b. Cloud-Run-reported calibration (separate from edge audit)

The Cloud Run `cloud_run_response_received` event reports its own ppy independent of the edge function's `calculateBodyBasedCalibration`:

```json
{
  "calibrationSource": "body_based",
  "pixelsPerYard": 235.321,
  "goodLinePairs": null,
  "calibration_confidence": "high",
  "calibration_details": {
    "frames_used": 90,
    "method": "body_based",
    "hip_frames": 90,
    "hip_median_px": 80.23,
    "hip_yards_assumed": 0.32,
    "shoulder_frames": 90,
    "shoulder_median_px": 100.35,
    "shoulder_yards_assumed": 0.45
  }
}
```

**Observation only:** the Cloud Run service ppy (`235.321`, computed across all 90 frames) and the edge function ppy (`201.78`, computed on a subset of 18 frames) diverge by ~14% on this run. Edge ppy is the value used for all metric scoring (visible in every per-metric `pixelsPerYard` field below). Same dual-path divergence first noted in F-SLICE-B-1; recorded here without action.

### 1c. analysis_context-selected calibration (preflight)

```json
{
  "cameraAngle": "sideline",
  "hasCalibration": true,
  "pixelsPerYard": 80
}
```

The static reference value (80) is selected at preflight when `analysis_context_selected` fires; the body_based path then overrides downstream when its confidence is sufficient.

---

## 2. Auto-zoom decisions

```json
{
  "auto_zoom_applied": true,
  "auto_zoom_factor": 1.75,
  "auto_zoom_final_fill_ratio": 0.0385,
  "auto_zoom_reason": "fill_ratio 0.04 < 0.3",
  "auto_zoom_crop_rect": { "x": 1755, "y": 562, "w": 2341, "h": 1317 },
  "auto_zoom_padding": { "top": 562, "right": 0, "bottom": 425, "left": 1755 },
  "safety_backoff_applied": false
}
```

Mean keypoint confidence:
- Before auto-zoom: `0.8364339660514485`
- After auto-zoom: `0.8252486318650872`
- Net delta: **−0.0112** (slight drop after zoom)

Person detection: `person_detected=true`, `person_detection_confidence=1`, `targetPersonIndex=0`, `peopleInVideo="unknown"`, `firstFramePersonCount=1`, `maxFramePersonCount=1`.

Movement: `movement_direction="stationary"`, `movement_confidence=0`.

Reliable frame percentage: `73.3%` of 90 frames.

---

## 3. Phase windows

| Phase | start_frame | end_frame | frame_count | percent |
|---|---|---|---|---|
| Release | 0 | 16 | 17 | 19% |
| Stem | 11 | 40 | 30 | 33% |
| Break | 33 | 49 | 17 | 19% |
| Catch Window | 42 | 79 | 38 | 42% |
| YAC (After Catch) | 74 | 89 | 16 | 18% |

Total frames: **90**. Source FPS: **30**. (Phase windows overlap intentionally — Stem overlaps Release, Break overlaps Stem, etc.)

---

## 4. Per-keypoint confidence (33 keypoints)

| index | mean | min | min_frame | frames_below_threshold | percent_below | status |
|---|---|---|---|---|---|---|
| 0 | 0.997 | 0.996 | 10 | 0 | 0% | RELIABLE |
| 1 | 0.997 | 0.996 | 6 | 0 | 0% | RELIABLE |
| 2 | 0.998 | 0.996 | 6 | 0 | 0% | RELIABLE |
| 3 | 0.998 | 0.996 | 6 | 0 | 0% | RELIABLE |
| 4 | 0.998 | 0.997 | 32 | 0 | 0% | RELIABLE |
| 5 | 0.997 | 0.996 | 60 | 0 | 0% | RELIABLE |
| 6 | 0.998 | 0.997 | 60 | 0 | 0% | RELIABLE |
| 7 | 0.997 | 0.996 | 6 | 0 | 0% | RELIABLE |
| 8 | 0.997 | 0.996 | 78 | 0 | 0% | RELIABLE |
| 9 | 0.996 | 0.994 | 6 | 0 | 0% | RELIABLE |
| 10 | 0.996 | 0.994 | 6 | 0 | 0% | RELIABLE |
| 11 | 0.999 | 0.998 | 6 | 0 | 0% | RELIABLE |
| 12 | 0.998 | 0.997 | 0 | 0 | 0% | RELIABLE |
| 13 | 0.775 | 0.578 | 8 | 22 | 24.4% | MARGINAL |
| 14 | 0.244 | 0.102 | 64 | 90 | 100% | UNRELIABLE |
| 15 | 0.586 | 0.448 | 50 | 72 | 80% | UNRELIABLE |
| 16 | 0.237 | 0.106 | 52 | 90 | 100% | UNRELIABLE |
| 17 | 0.556 | 0.421 | 50 | 76 | 84.4% | UNRELIABLE |
| 18 | 0.235 | 0.120 | 52 | 90 | 100% | UNRELIABLE |
| 19 | 0.551 | 0.416 | 50 | 76 | 84.4% | UNRELIABLE |
| 20 | 0.236 | 0.120 | 52 | 90 | 100% | UNRELIABLE |
| 21 | 0.513 | 0.385 | 50 | 82 | 91.1% | UNRELIABLE |
| 22 | 0.239 | 0.123 | 52 | 90 | 100% | UNRELIABLE |
| 23 | 0.999 | 0.998 | 6 | 0 | 0% | RELIABLE |
| 24 | 0.999 | 0.999 | 2 | 0 | 0% | RELIABLE |
| 25 | 0.951 | 0.851 | 0 | 0 | 0% | RELIABLE |
| 26 | 0.767 | 0.643 | 50 | 14 | 15.6% | MARGINAL |
| 27 | 0.950 | 0.832 | 0 | 0 | 0% | RELIABLE |
| 28 | 0.852 | 0.769 | 30 | 0 | 0% | RELIABLE |
| 29 | 0.935 | 0.810 | 0 | 0 | 0% | RELIABLE |
| 30 | 0.862 | 0.790 | 0 | 0 | 0% | RELIABLE |
| 31 | 0.942 | 0.832 | 0 | 0 | 0% | RELIABLE |
| 32 | 0.854 | 0.787 | 30 | 0 | 0% | RELIABLE |

`most_common_issue`: `"Body not fully visible"`.

---

## 5. Metrics — full per-metric detail

### 5.1 Plant Leg Extension (angle, phase: Break)

| Field | Value |
|---|---|
| Raw value | `119.7988606593056°` (rounded `119.8°`) |
| Elite target | `140°` |
| Tolerance | `15°` |
| Deviation | `20.20°` |
| Score | **`82.662868864352` / 100** |
| Weight | 50 |
| Weighted contribution | `41.33` |
| Status | SCORED |
| Frame range | 33–49 (17 frames) |
| Mid frame | 8 (within window) |
| Keypoint indices | [23, 25, 27] (left side) |
| Bilateral source | `confidence_auto` (left avg `0.976` > right avg `0.853`) |
| Confidence pass ratio | `1.0` (51/51 checks passed at threshold 0.4) |
| Per-KP avg confidence | 23: `0.999`, 25: `0.962`, 27: `0.966` |
| Confidence flag | none |

### 5.2 Hip Stability (distance_variance, phase: Break)

| Field | Value |
|---|---|
| Raw value | `0.10551035590711444 yd` (rounded `0.11 yd`) |
| Elite target | `0.05 yd` |
| Tolerance | `0.03 yd` |
| Deviation | `0.06 yd` |
| Score | **`57.48274015480927` / 100** |
| Weight | 15 |
| Weighted contribution | `8.62` |
| Status | SCORED |
| Frame range | 33–49 (17 frames; 10 frames actually used in calc) |
| Keypoint indices | [23, 24] (override → left side) |
| Pixel statistics | mean `121.172`, std dev `21.29`, min `94.372`, max `155.223` |
| Yards statistics | mean `0.6005`, std dev `0.1055`, min `0.4677`, max `0.7693`, range `0.3016` |
| ppy applied | `201.7827255013638` (body_based) |
| Confidence pass ratio | `1.0` (34/34 at threshold 0.4) |
| Per-KP avg confidence | 23: `0.999`, 24: `0.9995` |
| Confidence flag | none |

### 5.3 Release Speed (velocity, phase: Release)

| Field | Value |
|---|---|
| Raw value | `1.3364341120952823 mph` (rounded `1.34 mph`) |
| Elite target | `7 mph` |
| Tolerance | `2 mph` |
| Deviation | `5.66 mph` |
| Score | **`8.410852802382053` / 100** |
| Weight | 20 |
| Weighted contribution | `1.68` |
| Status | SCORED |
| Frame range | 0–16 (17 frames in window; 3-frame velocity window actually used) |
| Keypoint indices | [23, 24] (override → left side) |
| Method | `net_phase_displacement` |
| FPS | 30 |
| Window: first frame | 0, last frame 2, elapsed 2 frames, elapsed `0.0667 s` |
| Net displacement (px) | `8.79117579760656` |
| Raw px/sec | `131.86763696409838` |
| ppy applied | `201.7827255013638` (body_based) |
| Confidence pass ratio | `1.0` (34/34 at threshold 0.4) |
| Per-KP avg confidence | 23: `0.998`, 24: `0.999` |
| Confidence flag | none |

### 5.4 Hands Extension at Catch (distance, phase: Catch Window)

| Field | Value |
|---|---|
| Raw value | `0.14720089916895163 yd` (rounded `0.15 yd`) |
| Elite target | `0.4 yd` |
| Tolerance | `0.15 yd` |
| Deviation | `0.25 yd` |
| Score | **`65.73363305631719` / 100** |
| Weight | 15 |
| Weighted contribution | `9.86` |
| Status | SCORED |
| Frame range | 42–79 (38 frames) |
| Mid frame | 19 (within window, indices [19,20]) |
| Keypoint indices | [19, 20] (override → left side; **note: keypoints 19+20 are in UNRELIABLE band per §4**) |
| ppy applied | `201.7827255013638` (body_based) |
| Confidence pass ratio | `0.6053` (46/76 at threshold **0.35**) |
| Per-KP avg confidence | 19: `0.549`, 20: `0.208` |
| Lowest-confidence keypoint | 20 |
| Confidence flag | none (passed at the relaxed 0.35 threshold) |

---

## 6. Phase scores (per-phase aggregate inputs)

| Phase ID | Phase | Score |
|---|---|---|
| `d07d6365-1e25-47ec-b788-fca3be452820` | Release | `8.41` |
| `e63c5444-0799-4b6a-8f67-e706e59f5d85` | Break | `70.07` (Plant Leg Extension + Hip Stability) |
| `b0484d0c-bda3-4bc0-a221-0734ea641c43` | Catch Window | `65.73` |

The Stem and YAC phases received `0/100` in the Claude-prompt phase-score line (no metrics defined for those phases on this node version).

---

## 7. Aggregate score

- **Aggregate score: `61` / 100**
- `mastery_score` (log_data.aggregate): `61`
- `confidence_adjusted`: `false`
- `metrics_total`: 4
- `metrics_skipped`: 0

---

## 8. Scoring config applied

```json
{
  "confidence_handling": "skip",
  "min_metrics_threshold": 50,
  "renormalize_on_skip": true,
  "total_metrics": 4,
  "scored_count": 4,
  "flagged_count": 0,
  "skipped_count": 0,
  "skipped_percent": 0
}
```

`metric_calculation_complete` log: `totalMetrics:4, scored:4, flagged:0, skipped:0, failed:0`.

---

## 9. Error detection (5 rules evaluated)

| Rule | Auto-detectable | Condition | Metric value | Triggered |
|---|---|---|---|---|
| Rounding the break | yes | `Plant Leg Extension < 125` | `119.80` | **true** |
| Tipping the route with eyes | no | `Head Snap Timing < 1` | N/A | true (manual) |
| Slowing down before the break | yes | `Release Speed < 5` | `1.34` | **true** |
| Body catch | no | `Catch Efficiency < 70` | N/A | true (manual) |
| Drifting after the catch | no | `Post-Catch YAC Burst < 3.0` | N/A | true (manual) |

`results_written` log reports `detectedErrors:2` (the two auto-detectable triggered rules).

---

## 10. Claude prompt observability

### 10.1 Token breakdown

| Category | Tokens |
|---|---|
| `system_tokens` | 221 |
| `template_tokens` | 198 |
| `variable_tokens` | 115 |
| `prompt_tokens` (Anthropic-reported input) | 515 |
| `response_tokens` (Anthropic-reported output) | 206 |
| `total_tokens` | 721 |
| `target_words` | 150 |
| `word_count` (actual output) | 140 |

`system_instructions_present`: true. `system_instructions_chars`: 881. `truncated`: false.

### 10.2 Variables substituted

| Variable | Present | Value summary (truncated) |
|---|---|---|
| `mastery_score` | ✅ | `61` |
| `phase_scores` | ✅ | `Release: 8/100, Stem: 0/100, Break: 70/100, Catch Window: 66/100, YAC (After Catch): 0/100` |
| `metric_results` | ✅ | `Plant Leg Extension: 119.8degrees (target 140degrees, score 82.662868864352/100)\nHip Stability: 0.11ya…` |
| `confidence_flags` | ❌ | (empty — listed in missing_variables) |
| `detected_errors` | ✅ | `Confirmed errors observed: , ` |
| `athlete_name` | ✅ | `Athlete` |
| `node_name` | ✅ | `Slant ` |
| `position` | ✅ | `WR` |
| `athlete_level` | ✅ | `high_school` |
| `focus_area` | ❌ | (empty — listed in missing_variables) |
| `skipped_metrics` | ❌ | (empty — listed in missing_variables) |

### 10.3 Missing variables (unresolved at substitution time)

```json
["confidence_flags", "focus_area", "skipped_metrics"]
```

Per `claude_api.missing_variables`. These three reach Claude as empty strings. (R-09 baseline observation; no action.)

### 10.4 Phase context content delivered

The `compact` `phase_context_mode` produced this `phase_scores` line in the prompt:

```
Release: 8/100, Stem: 0/100, Break: 70/100, Catch Window: 66/100, YAC (After Catch): 0/100
```

All 5 phase names enumerated with rounded scores. Per-phase coaching cue annotations (the slice 1+2 work) are not visible in the captured `promptPreview` — that preview is the leading 512 chars only. The full prompt is `promptLength: 1070` chars; the preview ends mid-sentence at `"Confirmed errors observed"` so cue annotations beyond that point would not be visible in the preview but may be present in the full prompt.

### 10.5 Prompt preview (leading 512 chars, verbatim from edge log)

```
Hey Athlete, here's your Slant  breakdown.

SCORE: 61/100
Release: 8/100, Stem: 0/100, Break: 70/100, Catch Window: 66/100, YAC (After Catch): 0/100

WHAT THE DATA SHOWS:
Plant Leg Extension: 119.8degrees (target 140degrees, score 82.662868864352/100)
Hip Stability: 0.11yards (target 0.05yards, score 57.48274015480927/100)
Release Speed: 1.34mph (target 7mph, score 8.410852802382053/100)
Hands Extension at Catch: 0.15yards (target 0.4yards, score 65.73363305631719/100)

Confirmed errors observed
```

### 10.6 Claude feedback (verbatim, full)

```
**Your release is killing this route before it even starts.**

You came off the line at **1.34 mph** when you need to be exploding at 7+. That's not a release — that's a jog. Against any press corner, you're getting jammed into next week. Your hips are also floating **0.11 yards** at the break when elite guys hold under 0.05. That wasted movement is costing you separation.

**The one fix:** Attack the cornerback's outside shoulder with violent hands in your first two steps. You need to threaten vertical immediately so your slant break has juice.

**Your next rep drill:** Set up 5 yards from a cone. Fire off with max intent for 3 steps, plant, and break at 45 degrees. Film it. If your release speed isn't above 5 mph, you didn't attack it hard enough. Reset and go again.
```

`feedbackLength: 779` chars. Anthropic API status: `200 ok`. Model: `claude-sonnet-4-5-20250929`. Service tier: `standard`. Cache creation/read tokens: 0/0.

---

## 11. Pipeline behavior trace

### 11.1 Calibration source selection (why body_based won)

From `calibration_audit`:
- `dynamic_status: "failed"` with `dynamic_failure_reason: "dynamic_pixels_per_yard_out_of_range"` → dynamic path eliminated.
- `body_based_status: "used"` with `body_based_confidence: 0.78` → body_based path computed and accepted.
- `static_status: "computed_but_not_selected"` → static (80) was computed in parallel per Slice C.5 logging, but body_based was selected ahead of it per the resolver priority `dynamic > body_based > static`.

Selected ppy `201.78` is what every per-metric scorer used (visible in each `pixelsPerYard` field above). The Cloud Run-reported `235.321` is in `result_data.rtmlib.pixels_per_yard` and `result_data.pixels_per_yard` but not used downstream.

### 11.2 Scoring rule applied

From `scoring_config`:
- `confidence_handling: "skip"` — but no metric was actually skipped (all 4 passed confidence checks at their respective thresholds).
- `min_metrics_threshold: 50` — passed (4/4 = 100% scored).
- `renormalize_on_skip: true` — not exercised this run (skipped_count = 0).

### 11.3 Confidence handling decisions

- All 4 metrics returned `status: "scored"` with `calibrationFlag: null`.
- `confidence_flags: []` in result.
- Hands Extension at Catch operated at the relaxed `confidence_threshold: 0.35` (vs default `0.4`) — keypoint 20 has mean confidence `0.21` (UNRELIABLE band), but per-frame pass ratio of `0.605` cleared the relaxed threshold.
- Bilateral selection: 3 of 4 metrics used `bilateralSource: "override"` (force left); Plant Leg Extension used `bilateralSource: "confidence_auto"` and selected left (avg `0.976`) over right (avg `0.853`).

### 11.4 Phase score → aggregate flow

Weighted contributions (per `log_data.metrics`):
- Plant Leg Extension: weight 50, score 82.66, contribution `41.33`
- Hip Stability: weight 15, score 57.48, contribution `8.62`
- Release Speed: weight 20, score 8.41, contribution `1.68`
- Hands Extension at Catch: weight 15, score 65.73, contribution `9.86`

Sum of contributions: `41.33 + 8.62 + 1.68 + 9.86 = 61.49` → rounded to **`61`** (matches `aggregate_score`).

### 11.5 Edge function log timeline

| Time (UTC) | Event |
|---|---|
| 01:56:35 | `pipeline_started` — videoUrlPresent, start=0, end=3 |
| 01:56:35 | `node_config_loaded` — Slant, node_version 6, 6 metrics, 5 phases |
| 01:56:35 | `preflight_passed` |
| 01:56:35 | `analysis_context_selected` — sideline, hasCalibration=true, ppy=80 (preflight static) |
| 01:56:35 | `detection_frequency_selected` — solo scenario, det_frequency=2 |
| 01:56:35 | `mediapipe_request_payload` — 4 keys: video_url, start_seconds, end_seconds, det_frequency (R-08 contract verification, B1) |
| 01:56:50 | `cloud_run_response_received` — frameCount=90, fps=30, calibrationSource=body_based, ppy=235.321, goodLinePairs=null |
| 01:56:50 | `target_person_locked` — index 0 |
| 01:56:50 | `metric_window_selected` × 4 (Plant Leg Extension, Release Speed, Hip Stability, Hands Extension at Catch) |
| 01:56:50 | `metric_scored` × 4 |
| 01:56:50 | `metric_calculation_complete` — totalMetrics:4, scored:4, flagged:0, skipped:0, failed:0 |
| 01:56:50 | `claude_request_prepared` — promptLength=1070, model=claude-sonnet-4-5 |
| 01:56:59 | `claude_response_received` — status=200, ok=true, output_tokens=206 |
| 01:56:59 | `claude_feedback_received` — feedbackLength=779 |
| 01:56:59 | `results_written` — aggregateScore=61, detectedErrors=2 |
| 01:56:59 | `pipeline_completed` — status=complete |

End-to-end: ~24 seconds (insert → result_data written).

### 11.6 Warnings / anomalies surfaced (pure observation)

1. **Dual ppy in result_data.** Cloud Run service-side ppy (`235.321`, body_based, 90 frames) and edge function `calculateBodyBasedCalibration` ppy (`201.78`, body_based, 18 frames) coexist. Edge value drives all metric scoring. Same divergence noted in F-SLICE-B-1; recorded only.
2. **body_based_ppy run-to-run drift.** Slice C 5-run baseline reported `200.21` (5 identical runs). This run (a164c815): `201.78`. Delta ≈ `+1.57 ppy` (~0.78%). Whether this is determinism drift or a Cloud Run frame-sampling difference is not investigated here.
3. **No console errors during the run.** Browser console errors for `AnalysisLog` / `CollapsibleSection` ref forwarding (visible in client-side preview logs) are unrelated to this analysis run — they fire on tab mount, not on pipeline execution.
4. **Hands Extension at Catch operates on UNRELIABLE keypoints.** Keypoints 19 & 20 are in the UNRELIABLE confidence band (means 0.55 and 0.21, percent_below 84.4% and 100%). Metric still SCORED because the relaxed `confidence_threshold: 0.35` for this metric cleared the per-frame check at pass ratio 0.605. Score `65.73` is downstream of those keypoints. No flag raised.
5. **Three template variables resolve empty.** `confidence_flags`, `focus_area`, `skipped_metrics` arrive at Claude as empty strings (listed in `claude_api.missing_variables`). R-09 baseline behavior; no action this run.
6. **Auto-zoom slightly degraded mean keypoint confidence.** Before zoom `0.836`, after zoom `0.825` (Δ −0.011). Auto-zoom still applied because `auto_zoom_final_fill_ratio: 0.0385` is well below the `0.3` trigger threshold even after the 1.75× zoom. Safety backoff was not applied.
7. **`detected_errors` log_data list has empty trailing values.** `"Confirmed errors observed: , "` — the variable substitution renders to a string with two empty entries (length-2 trailing comma+space). This is the input to Claude; Claude's feedback does not echo the empty entries.

---

## 12. Quick numeric summary for cross-reference

| Field | Value |
|---|---|
| Upload ID | `a164c815-0fa7-4705-8970-910fe93ef859` |
| Result ID | `a120daa7-8643-4fcb-b055-92374d246fff` |
| Aggregate score | **61** / 100 |
| Calibration source selected | `body_based` |
| Calibration ppy used (edge) | `201.7827255013638` |
| Calibration ppy reported (Cloud Run) | `235.321` |
| Static reference ppy (computed, unused) | `80` |
| Total frames | 90 |
| Source FPS | 30 |
| Reliable frame % | 73.3% |
| Mean keypoint confidence (post-zoom) | 0.8252 |
| Person detection confidence | 1.0 |
| Auto-zoom factor | 1.75× |
| Auto-zoom final fill ratio | 0.0385 |
| Metrics scored / flagged / skipped / failed | 4 / 0 / 0 / 0 |
| Auto-triggered errors detected | 2 |
| Manual-only errors triggered | 3 |
| Claude prompt total tokens | 721 (515 in + 206 out) |
| Claude feedback length | 779 chars |
| Claude word count vs target | 140 / 150 |
| Pipeline wall time | ~24 s |
| Calibration audit SHA-256 | `26603f63a77266f3a2f7e2c0dc4ae0cb5e37126353f7e9b65a3cdf3398c4d032` |
