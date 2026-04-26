# Phase 1c.2 — 5-Run Determinism Experiment

**Date:** 2026-04-26
**Slice context:** B1 verification — answering "is Run #1 vs Run #2 metric divergence caused by MediaPipe nondeterminism, edge metric-math nondeterminism, or upstream pipeline state?"
**Test clip:** `slant-route-reference-v1.mp4`
**Window:** `start_seconds=0`, `end_seconds=3` (matches d1b3ab23 baseline)
**Node:** Slant `75ed4b18-8a22-440e-9a23-b86204956056` v1, camera_angle `sideline`

> **Important note on baseline:** The d1b3ab23 baseline (`athlete_lab_results.id 43931849-…`) used a **different uploaded video file** (`75ed4b18-…-1777081020066.mp4`), not `slant-route-reference-v1.mp4`. So this experiment establishes determinism on the *new* canonical reference clip — the absolute metric values here will not match the d1b3ab23 frozen baseline by design.

---

## Section A — Cloud Run determinism (5 parallel calls)

5 concurrent POSTs to `https://mediapipe-service-874407535869.us-central1.run.app/analyze` with the trimmed 4-key payload.

### Pairwise byte-equality

| Pair | keypoints SHA-256 | scores SHA-256 |
|---|---|---|
| 1↔2 | EQUAL | EQUAL |
| 1↔3 | EQUAL | EQUAL |
| 1↔4 | EQUAL | EQUAL |
| 1↔5 | EQUAL | EQUAL |
| 2↔3 | EQUAL | EQUAL |
| 2↔4 | EQUAL | EQUAL |
| 2↔5 | EQUAL | EQUAL |
| 3↔4 | EQUAL | EQUAL |
| 3↔5 | EQUAL | EQUAL |
| 4↔5 | EQUAL | EQUAL |

All 10 pairs: **bit-identical** keypoints AND scores. SHA-256 prefix `7c7ec4deed43…` across all 5 runs.

### Summary stats — identical across all 5 runs

| Field | Value (all 5) |
|---|---|
| `frame_count` | 90 |
| `fps` | 30 |
| `pixels_per_yard` | **233.896** |
| `calibration_source` | `body_based` |
| `calibration_confidence` | `high` |
| `auto_zoom_applied` | true |
| `auto_zoom_factor` | 1.75 |
| `auto_zoom_reason` | `fill_ratio 0.06 < 0.3` |
| `auto_zoom_crop_rect` | `{x: 1755, y: 525, w: 2341, h: 1317}` |
| `safety_backoff_applied` | false |
| `person_detection_confidence` | 1.0 |
| `movement_direction` | `stationary` (hard-coded) |
| `mean_kp_conf_before/after` | 0.7199 / 0.7425 |

`ppy` variance: **0.000% (range 0.000)**.

### Verdict A — Cloud Run is bit-perfect deterministic on this clip / window / payload.

Wall time: 32.9s for 5 parallel runs (per-run 29–33s, 1–2 keepalives each).

Raw responses written to `/tmp/cloudrun_run_{1..5}.json`.

---

## Section B — Full pipeline determinism (5 invocations)

Inserted 5 `athlete_uploads` rows pointing at the same signed URL with identical fields except `analysis_context.run_index`. The DB trigger `trigger_analysis_on_upload` fired `analyze-athlete-video` for each. All 5 completed.

### Per-run metric values (all 5 runs identical except Claude `feedback`)

| Metric | Value (×5) | Score (×5) | Calibration source | ppy used |
|---|---|---|---|---|
| Plant Leg Extension | 119.8° | 82.66 | n/a (angle, no calibration) | n/a |
| Hip Stability | 0.27 yd | 0 | **static** (`dynamic_pixels_per_yard_out_of_range`) | 80 |
| Release Speed | 3.37 mph | 59.27 | **static** (`dynamic_pixels_per_yard_out_of_range`) | 80 |
| Hands Extension at Catch | 0.37 yd | 100 | **static** (`dynamic_pixels_per_yard_out_of_range`) | 80 |

| Field | Value (×5) |
|---|---|
| `aggregate_score` | **68** |
| `phase_scores.Release` (b04…) | 100 |
| `phase_scores.Stem` (d07…) | 59.272 |
| `phase_scores.Break/Cut` (e63…) | 41.331 |

**Across-run variance per metric:** `max − min = 0` for **every** metric, every score, every phase score. 0.000% of mean.

**Claude `feedback` length:** 921 / 953 / 945 / 913 / 817 chars. Expected — Claude is sampled non-deterministically. Metric inputs to Claude are identical, only the prose varies.

### Phase-window stability

All 5 runs produced identical `phase_scores` keys + values. Phase boundary stability: confirmed.

### Calibration-path observation (cross-section signal)

- Cloud Run returned `body_based` ppy = **233.896** with `confidence: high`
- Pipeline rejected this and fell back to `static` ppy = **80** (`dynamic_failure_reason: dynamic_pixels_per_yard_out_of_range`)

This is the calibration flip already logged in F-SLICE-B-1. The `dynamic_pixels_per_yard_out_of_range` guard treated the high-confidence body_based result as out-of-range. That's a calibration-architecture issue (deferred to Slice B2), not a B1 issue.

### Verdict B — Full pipeline is bit-perfect deterministic on metrics, scores, phase scores, and aggregate. Only Claude prose varies.

---

## Section C — Decision matrix

| Cloud Run | Pipeline | This experiment | Verdict |
|---|---|---|---|
| Identical | Identical | ✅ | **Outcome 1** |
| Identical | Divergent | — | — |
| Divergent | Divergent | — | — |
| Divergent | Identical | — | — |

### Outcome 1 → B1 PASSES

**The pipeline is deterministic.** Run #1 (`9d439b84`) vs Run #2 (`45656381`) variance reported earlier in the loop was **not** caused by pipeline nondeterminism. The likely causes (in order of probability):

1. **Different uploaded files.** Run #1 used a different `video_url`; Run #2 used another. The d1b3ab23 baseline used a third file (`75ed4b18-…-1777081020066.mp4`), not `slant-route-reference-v1.mp4`.
2. Different `start_seconds`/`end_seconds` (worth confirming by pulling those rows' upload contexts).
3. Different node-config snapshots over time if `athlete_lab_nodes` was edited between runs.

Action: do not investigate "edge function metric math nondeterminism" — there is none. If Run #1 vs Run #2 variance still needs explanation, pull both upload rows' `video_url` and `start_seconds`/`end_seconds` and compare.

### Recommendation

- **B1 PASSES.** Architectural verification (R-08 payload trim, dead-code deletion, det_frequency collapse) is now reinforced by determinism evidence: identical input → identical output, byte-for-byte.
- **Proceed to Slice C.**
- Defer calibration redesign to **Slice B2** as planned. The body_based vs static divergence (Section D below) is informative for B2 design but does not block B1.

---

## Section D — Empirical ground-truth ppy from soccer center circle

### Method

1. Extracted frame 60 (2.0s into clip) at full 4096×2304 resolution.
2. Thresholded image at >200 grayscale; isolated white field markings in the lower 60% of the frame.
3. Connected-component analysis → largest component (49,472 px) is the visible white arc.
4. Algebraic least-squares circle fit on arc points.
5. Computed ppy assuming FIFA spec (radius 9.15 m = 10.0066 yd, diameter 18.30 m = 20.0131 yd).

### Result

| Quantity | Value |
|---|---|
| Fitted circle center | (1257.9, 6772.8) px |
| Fitted radius | 4952.17 px |
| Fitted diameter | 9904.33 px |
| Residual mean / std / max\|res\| | −0.01 / 10.29 / 27.63 px |
| FIFA radius (yards) | 10.0066 yd |
| **Ground-truth ppy** | **494.892** (px / yd) |

Visual: see `slant_frame60_circle_fit.png` — fitted circle (magenta) traces the visible arc essentially perfectly. Residuals 10/4952 ≈ 0.2% confirm the fit.

### Comparison

| Source | ppy | Δ vs ground truth | % error |
|---|---|---|---|
| Ground truth (FIFA circle) | **494.89** | — | — |
| body_based (Cloud Run, conf=high) | 233.90 | −261.0 | **−52.7%** |
| static (Slant `reference_calibrations[0]`) | 80.00 | −414.9 | **−83.8%** |

### Caveat — marking identity not confirmed

The arc was assumed to be a FIFA-spec soccer center circle (10-yard radius). The venue is an indoor turf dome; if the marking is **not** a regulation FIFA circle (e.g., custom training facility marking, a different sport's circle, or partial penalty-area arc), the absolute ppy is wrong. However the **directional finding is robust**: the visible arc is plainly larger than the static calibration would imply, and the body_based estimate is also short by a wide margin.

### What this resolves about F-SLICE-B-1

F-SLICE-B-1's investigation said body_based was **inflating** the ppy. On *this* clip and camera setup, the empirical evidence is the **opposite**: body_based **under-reports** by ~53%, but it is still **3× closer to ground truth than static** (−53% vs −84%).

Implications:

1. The "body_based inflates" finding in the investigation doc is **clip-/setup-dependent**, not universal. On a high-resolution sideline clip with the athlete relatively far from camera, body_based underestimates instead of inflating.
2. **Deleting body_based and falling back to static would make calibration WORSE on this clip** (84% under vs 53% under), not better. F-SLICE-B-1's Sev-3 classification likely needs review for B2 — wholesale deletion of body_based is contraindicated by this evidence.
3. The calibration-architecture decision in B2 should not be "delete body_based, keep static." Better options:
   - Keep body_based as primary, raise the `dynamic_pixels_per_yard_out_of_range` upper bound (or remove it on `confidence=high` results).
   - Use scene-detection calibration (find field markings) where possible.
   - Use known reference markings explicitly in `reference_calibrations`.

This is a **B2 design input**, not a B1 blocker.

---

## Files

| Path | Purpose |
|---|---|
| `scripts/slice1c2_determinism_cloudrun.ts` | Section A harness (deno, throwaway) |
| `/tmp/cloudrun_run_{1..5}.json` | Raw Cloud Run captures |
| `/tmp/cloudrun_summary.json` | Section A parsed summary |
| `/tmp/ground_truth_ppy.json` | Section D fit details |
| `/mnt/documents/slant_frame60_centercircle.png` | Source frame 60 |
| `/mnt/documents/slant_frame60_circle_fit.png` | Fitted circle overlay (visual QA) |

## Pipeline upload IDs (Section B)

| Run | upload_id | result_id |
|---|---|---|
| 1 | `df625061-f104-493b-86fa-706bdb1b0528` | `c68791bd-01a5-48c3-a7c3-6005ea5de95d` |
| 2 | `3a2c6e98-8d28-434b-872b-3dcd74edb574` | `916e8d1c-1c9b-44b9-b46a-9b6789ff90ce` |
| 3 | `a7e8287d-dcc2-4c49-b5a8-2cd2c4284d9b` | (pulled in query) |
| 4 | `3b7b7b41-9059-4284-bc22-2b2f021bbd90` | (pulled in query) |
| 5 | `4eb11f6d-0a9f-4dca-9267-2c9c1cdc49e0` | (pulled in query) |
