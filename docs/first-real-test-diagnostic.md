# First Real Test — Diagnostic Investigation

**Date:** 2026-04-25
**Mode:** Read-only investigation. No code or schema changes.
**Source run:**
- Upload `e1a25bee-a586-4050-831c-91ebbbd9b252`
- Result `d1b3ab23-6289-4c07-b914-eb8474e5ca24`
- Node `75ed4b18-8a22-440e-9a23-b86204956056` (Slant)
- Aggregate score: 10/100. 4 active metrics scored, 0 skipped, 0 flagged.
- Claude correctly refused to coach on the implausible numbers and instructed the athlete to re-film.

---

## Snapshot of the failing run

| Metric | Value | Target | Score | Notes |
|---|---|---|---|---|
| Plant Leg Extension | 92.25° | 140° | 0 | Indices [24,26,28] high confidence (0.99/0.99/0.98). Geometry is real but unphysical for the configured target — likely a separate phase-window / calculation question, not a calibration issue. |
| Hip Stability | 0.10 yd variance | 0.05 | 69 | Variance metric — uses calibration. |
| Release Speed | 186.20 mph | 7 | 0 | **Physically impossible** — calibration scaling error. |
| Hands Extension | 2.26 yd | 0.4 | 0 | **Physically implausible** — calibration scaling error. |

Calibration as recorded on the metric rows:
- `pixelsPerYard: 167.87`
- `calibrationSource: "body_based"`
- `calibrationDetails.method: "multi_frame_body_proportions_hips_shoulders"`
- `calibrationDetails.shoulderWidthPixels: 4.34` ← anatomically impossible
- `calibrationDetails.hipWidthPixels: 125.05`
- `calibrationDetails.dynamicFailureReason: "dynamic_pixels_per_yard_out_of_range"`

Calibration as recorded on the rtmlib log block:
- `pixels_per_yard: 299.641` (different value!)
- `calibration_source: "body_based"`
- `calibration_details.shoulder_median_px: 164.6`
- `calibration_details.hip_median_px: 69.43`
- `calibration_details.method: "body_based"` (anthropometric constants, no athlete height)

Two separate body-based calibrations ran on the same data and produced two different values. The metric_results value (167.87) is the one that scaled the metrics. Neither matched the static reference calibration (Sideline = **80 px/yard**) configured on the node.

---

## Issue 1 — Body-based calibration produces impossible measurements

### Root cause

`calculateBodyBasedCalibration` in `supabase/functions/analyze-athlete-video/index.ts:1588-1714` reads keypoint indices `[5, 6, 11, 12]`:

```ts
// Lines 1621-1624
const leftShoulder = frameKeypoints[5]
const rightShoulder = frameKeypoints[6]
const leftHip = frameKeypoints[11]
const rightHip = frameKeypoints[12]
```

Those indices are **COCO-17**, not MediaPipe-33. The pose landmarker the pipeline now runs is MediaPipe (`mediapipe-service/app/pose.py:25`, `LANDMARK_COUNT = 33`), and MediaPipe's index assignment is:

| Edge function says | MediaPipe-33 actually is |
|---|---|
| `[5]` left_shoulder | right_eye_outer |
| `[6]` right_shoulder | left_eye_inner |
| `[11]` left_hip | left_shoulder |
| `[12]` right_hip | right_shoulder |

True hips in MediaPipe are `[23, 24]`. So the function:
- Measured **inter-eye distance** (4.34 px), thought it was shoulder width.
- Measured **actual shoulder width** (125.05 px), thought it was hip width.
- Divided each against `expectedShoulderWidthYards = height_yd * 0.259` and `expectedHipWidthYards = height_yd * 0.191` (lines 1594-1595).
- Averaged the two wildly mis-scaled per-frame estimates → ppy ≈ 167.87.
- Confidence calc (lines 1689-1700) returned 0.65, passing the `≥ 0.3` gate at line 1482.
- Result was adopted as the calibration of record and used to scale every distance/velocity metric.

### Calibration priority order today (`resolveCalibration`, lines 1425-1542)

1. **Cloud-run "dynamic"** (line 1449). Trust check at `isDynamicCalibrationTrusted` (1280-1385) requires `sourceLabel === 'dynamic'` AND ppy in [40,120] AND ≥8 line pairs. The mediapipe service hard-codes `calibration_source = "body_based"` (`mediapipe-service/app/main.py:175`). **This branch is currently unreachable** — the live service has no dynamic line-pair calibration.
2. **In-edge `calculateBodyBasedCalibration`** if `athlete_height` provided (lines 1474-1498). The buggy function above. Returned 167.87 with confidence 0.65.
3. **Static reference calibration** (lines 1515-1533). `selectCalibration` matches `reference_calibrations[camera_angle=sideline].pixels_per_yard = 80` for this node, but it's never reached because step 2 returned a non-null value above the 0.3 gate.

### Why "Sideline 80 px/yard" was never used

The static branch is only entered when (a) dynamic is rejected AND (b) body_based returned `null` or confidence < 0.3. The buggy body_based calc returns plausible-looking numbers with passing confidence, so static is never reached.

### Severity, scope, fix path

- **Severity:** DATA INTEGRITY (HIGH). Every distance- or velocity-derived metric is scaled by a ppy ~2× too high. Variance (Hip Stability), distance (Hands Extension), and velocity (Release Speed) all return garbage.
- **Fix scope:** SMALL patch — change indices from `[5,6,11,12]` to `[11,12,23,24]` in `calculateBodyBasedCalibration`. Verify the `0.259` / `0.191` ratios still hold for MediaPipe's keypoint convention before shipping (the constants come from anthropometry referenced to body landmark centers; should still apply, but worth a quick sanity pass).
- **Ship as patch?** Yes. Self-contained, no contract changes, no migrations.
- **Open question this fix doesn't resolve:** even with corrected indices, the in-edge body_based calc may still mis-estimate when auto-zoom is active (`auto_zoom_factor: 1.75` was applied this run), and the mediapipe service's separate body_based produced ppy=299.6 (~3.7× the static 80) using correct MediaPipe indices. Suggests body_based as a class is unreliable enough that Issue 2's deletion path should be the durable answer.

---

## Issue 2 — `athlete_height` and `athlete_wingspan` are MMPose-era inputs

### Where they live

- **Form:** `src/features/athlete-lab/components/TestingPanel.tsx:288-303` writes both into the upload's `analysis_context`. Form section header at line 641 reads "Body Calibration — Height and wingspan feed the body-based calibration fallback when dynamic calibration is unavailable."
- **Pipeline reads:**
  - `athlete_wingspan`: `rg "athlete_wingspan"` returns **only the form site**. Never read by any edge function, mediapipe service, or scoring code. Dead input.
  - `athlete_height`: read at `analyze-athlete-video/index.ts:1175` (`getAthleteHeightMeasurement`). Sole consumer is `calculateBodyBasedCalibration` (the buggy function from Issue 1), which uses it to derive expected hip/shoulder widths: `heightYards * 0.191` (hip), `heightYards * 0.259` (shoulder), then `pixelsPerYard = detectedPixels / expectedYards`.

### Did height inputs cause the impossible measurements?

Indirectly. The index bug from Issue 1 would produce wrong numbers regardless of whether height was supplied. But:
- Without `athlete_height`, `calculateBodyBasedCalibration` is never called (line 1474 gate). The pipeline falls through to static (80 px/yard from the Reference tab) and produces correct measurements.
- With `athlete_height` and the index bug, the function produces a "reasonable-looking" ppy that passes the confidence gate and silently overrides the static calibration.

So `athlete_height` is the **trigger** that activates the broken code path, not the **cause** of the broken math.

### What MediaPipe needs vs MMPose needed

- MMPose era: complex pose math required body-proportion priors to back into stable measurements (the rationale for adding height/wingspan).
- MediaPipe era: emits world-coordinate-style landmarks directly, and the mediapipe service runs its own body_based calibration in `mediapipe-service/app/calibration.py` using **anthropometric constants (shoulder=0.45 yd, hip=0.32 yd)**. No athlete-specific input needed. (That service's calibration is also imperfect — see open question above — but it doesn't depend on form input.)

### Recommendation

**REMOVE both fields from the upload form. REMOVE the entire in-edge body_based code path.**

Concretely:
- Drop the "Body Calibration" section in `TestingPanel.tsx` (form fields, validation, payload assembly).
- Delete `calculateBodyBasedCalibration` (~120 lines), `getAthleteHeightMeasurement`, `convertHeightToYards`, the `body_based` branch in `resolveCalibration`, and related types (`BodyBasedCalibrationResult`, `AthleteHeightMeasurement`, `BodyMeasurementSample`).
- Resulting calibration priority: **dynamic (when implemented) → static (Reference tab) → mediapipe-service body_based pass-through (optional fallback) → none.**

Replacement: nothing. The Reference tab already collects `pixels_per_yard` per camera angle. That's the system of record.

### Severity, scope, fix path

- **Severity:** ARCHITECTURAL (MEDIUM-LARGE). Removes the trigger for Issue 1 *and* the broken code path entirely. With this fix, Issue 1 becomes a non-issue (the buggy function is gone).
- **Fix scope:** SMALL form edit + MEDIUM edge function delete (~150 lines).
- **Ship as patch?** No — batch with Phase 1c. This requires a coordinated decision on the calibration fallback chain and touches the upload contract. Worth getting right rather than fast.

---

## Issue 3 — Metric cards display "Unassigned Phase / Unknown Calc"

### Root cause

Render site, `src/features/athlete-lab/components/TestingPanel.tsx:961-962`:

```tsx
<span>{metric.phase_name ?? metric.phase_id ?? "Unassigned phase"}</span>
<span>{metric.calculation_type ?? "Unknown calc"}</span>
```

The `metric` here is a `PipelineMetricResult` (`src/features/athlete-lab/types.ts:369-384`) with optional flat `phase_id`, `phase_name`, `calculation_type`. The edge function constructs persisted metric rows by spreading the **node-config metric** (e.g. `analyze-athlete-video/index.ts:2128`, `2134`, `2142`, and the success path that ends at `results.push(...)`). The node-config metric has those fields **nested inside `keypoint_mapping`**, not flat:

DB confirmation from `metric_results[0]`:
```json
{
  "name": "Plant Leg Extension",
  "calculation_type": <missing at top level>,
  "phase_id": <missing at top level>,
  "phase_name": <missing>,
  "keypoint_mapping": {
    "phase_id": "e63c5444-0799-4b6a-8f67-e706e59f5d85",
    "calculation_type": "angle",
    "keypoint_indices": [23, 25, 27]
  }
}
```

So `metric.phase_name`, `metric.phase_id`, and `metric.calculation_type` are all `undefined` → both fallbacks fire on every metric card.

### Severity, scope, fix path

- **Severity:** OBSERVABILITY (MEDIUM). Cosmetic on its own, but the same bug breaks Issue 5 (real consequence).
- **Fix scope:** SMALL — flatten `phase_id`, `phase_name` (looked up from `nodeConfig.phase_breakdown`), and `calculation_type` onto the persisted metric row at the metric loop in `analyze-athlete-video/index.ts` (around lines 2110-2300). UI requires no change.
- **Ship as patch?** Yes.

---

## Issue 4 — Keypoint confidence summary truncated to indices 0-16

### Pipeline IS capturing all 33 landmarks

- `mediapipe-service/app/pose.py:25` — `LANDMARK_COUNT = 33`
- `pose.py:104-108` — defensive padding/truncation **to 33**, not 17
- `mediapipe-service/app/main.py:163-167` — keypoints/scores arrays preserve full landmark count per frame
- DB evidence: `metric_results[0].detail.confidenceDiagnostics.per_keypoint_avg_confidence` shows `{"24": 0.999, "26": 0.992, "28": 0.983}` — proving indices 24/26/28 are present in the captured score arrays at full resolution

### Truncation site

`supabase/functions/analyze-athlete-video/index.ts:973-1010`, function `summarizeKeypointConfidence`:

```ts
// Line 994-995
return Array.from(totals.entries())
  .slice(0, 17)   // ← LITERAL TRUNCATION SOURCE
  .map(([index, summary]) => { ... })
```

The `.slice(0, 17)` drops indices 17-32 from the summary written to `log_data.rtmlib.keypoint_confidence`. DB confirmation: `jsonb_array_length(result_data->'log_data'->'rtmlib'->'keypoint_confidence') = 17`.

### Active metrics use the dropped range

| Metric | Indices used | In the 0-16 summary? |
|---|---|---|
| Plant Leg Extension | [23, 25, 27] (after bilateral → [24, 26, 28]) | **No** |
| Hip Stability | [23, 24] | **No** |
| Release Speed | [23, 24] | **No** |
| Hands Extension | [19, 20] | **No** |

Zero observability on the keypoints the active metrics actually use.

### Renderer

`src/features/athlete-lab/components/AnalysisLog.tsx` reads `logData.rtmlib.keypoint_confidence` and renders whatever's there. The renderer is not the bottleneck. Names are formatted as `"Keypoint N"` — a MediaPipe-name lookup table exists at `src/constants/keypointLibrary.json` but is not currently wired in.

### Severity, scope, fix path

- **Severity:** OBSERVABILITY (HIGH). Without confidence on the indices the metrics use, we cannot distinguish a genuine 92° plant leg reading from a noisy estimate. (For this specific run, `per_keypoint_avg_confidence` shows 0.99/0.99/0.98 on [24,26,28] — so the 92° reading was high-confidence — but we only know that because of an unrelated debug field.)
- **Fix scope:** SMALL edge-function patch — drop `.slice(0, 17)` on line 995, accept full 33-landmark summary. MEDIUM if we also wire in MediaPipe landmark names from `keypointLibrary.json`.
- **Ship as patch?** Yes for the truncation removal. Name-lookup enhancement is a Phase 1c nicety.

---

## Issue 5 — Distance Variance sub-card not rendering on Hip Stability

### Root cause

Helper `distanceVarianceSummary` in `src/features/athlete-lab/components/TestingPanel.tsx:182-201`:

```ts
function distanceVarianceSummary(metric: PipelineMetricResult) {
  if (metric.calculation_type !== "distance_variance") return null;  // ← bails here
  ...
}
```

As established in Issue 3, `metric.calculation_type` is `undefined` on the persisted metric (it lives at `metric.keypoint_mapping.calculation_type`). The helper returns `null`, the render block guarded by `variance` (line 951) never displays.

### The data is present

DB confirmation from Hip Stability's `detail`:
```json
{
  "stdDev_yd": 0.0985,
  "mean_yd": 0.179,
  "min_yd": 0.0616,
  "max_yd": 0.3815,
  "range_yd": 0.3199,
  "framesUsed": 10,
  "pixelStdDev": 16.535
}
```

Every field the helper expects is present and well-typed.

### Disclosure mechanism

The variance sub-card has no user-facing toggle — it renders unconditionally when `variance` is non-null. So this is purely a data-shape bug, not a UX state issue. The user did not "fail to expand it"; the card was never inserted into the DOM.

### Severity, scope, fix path

- **Severity:** OBSERVABILITY (MEDIUM). Direct consequence of Issue 3.
- **Fix scope:** SMALL — fixed by the same single edit as Issue 3 (flatten `calculation_type` onto the persisted metric row). No additional UI change required.
- **Ship as patch?** Yes, paired with Issue 3.

---

## Triage Recommendation

### IMMEDIATE — must fix before next test

These two block meaningful test signal. Smallest possible change set.

- **Issue 1 — calibration index bug.** Until fixed, every distance/velocity metric is ~2× wrong. No diagnostic value from another run. Smallest, highest-impact patch. (Note: Issue 2's deletion path is the durable fix, but the index swap is the smallest patch that produces correct measurements today.)
- **Issue 4 — keypoint truncation.** Without this we cannot validate whether Issue 1's fix is actually producing high-confidence readings on the indices the metrics use. This unblocks diagnostic capability for the next run.

### SOON — next 1-2 sessions

- **Issues 3 + 5 — flatten metric `phase_id`, `phase_name`, `calculation_type`.** Single edit fixes both. Doesn't block testing, but every subsequent triage session reads a label and looks for the variance sub-card. Worth shipping standalone.

### PHASE 1C — architectural batch

Bundle with mechanics tab deprecation, position field UI, system-instruction substitution, and phase-context wiring.

- **Issue 2 — remove `athlete_height` and `athlete_wingspan`. Delete in-edge `calculateBodyBasedCalibration` and the `body_based` branch in `resolveCalibration`.** Decide canonical priority order: dynamic (future) → static (Reference tab) → mediapipe-service body_based pass-through (optional) → none. Drop the "Body Calibration" form section.
- **Issue 4 enhancement** — replace `"Keypoint N"` labels with MediaPipe landmark names from `src/constants/keypointLibrary.json`.

---

## Open question to flag for Phase 1c

Even after Issue 1's index fix, the in-edge body_based calc will likely remain unreliable. Evidence: the mediapipe service's separate body_based — which already uses correct MediaPipe indices [11,12,23,24] and anthropometric constants — produced **ppy = 299.6** on this same run, ~3.7× the static 80 from the Reference tab. The `auto_zoom_factor: 1.75` applied this run is the most likely explanation (the body looks larger in the cropped/zoomed frame than its real-world ratio against the original frame's width), but it's a class problem, not a one-off. This is the empirical case for Issue 2's deletion path: even a "fixed" body_based likely produces calibration off by 2-4× when auto-zoom is active. The Reference tab calibration (manually validated, ground-truth) should be the source of record.
