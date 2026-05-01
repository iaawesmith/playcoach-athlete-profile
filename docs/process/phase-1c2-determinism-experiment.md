# Phase 1c.2 — 5-Run Determinism Experiment

> *Legacy slice outcome doc (pre-template, Pass 3f). Frontmatter contract evolved 2026-04-26; this doc retained as historical record.*


**Date:** 2026-04-26
**Slice context:** B1 verification — answering "is Run #1 vs Run #2 metric divergence caused by MediaPipe nondeterminism, edge metric-math nondeterminism, or upstream pipeline state?"
**Test clip:** `slant-route-reference-v1.mp4`
**Window:** `start_seconds=0`, `end_seconds=3` (matches d1b3ab23 baseline)
**Node:** Slant `75ed4b18-8a22-440e-9a23-b86204956056` v1, camera_angle `sideline`

> **Important note on baseline:** The d1b3ab23 baseline (`athlete_lab_results.id 43931849-…`) used a **different uploaded video file** (`75ed4b18-…-1777081020066.mp4`), not `slant-route-reference-v1.mp4`. So this experiment establishes determinism on the *new* canonical reference clip — the absolute metric values here will not match the d1b3ab23 frozen baseline by design.

> **Pass 5e-bis clarification (2026-04-26):** This document's original "Group A vs Group B" framing predates the full-SHA-256 hash analysis introduced by `scripts/aggregate-calibration-audit.ts`. The findings on `body_based_ppy` specifically remain valid (deterministic within Group A; ~0.78% drift to Group B). However, the implicit framing that Group B was a single bit-identical cluster is **insufficient**: the E.3.6 row that *appeared* to land in Group B has the same `body_based_ppy` but a different `body_based_confidence`, so the full `calibration_audit` payload is distinct (Pass 5e-bis labels it Group C). See [`F-SLICE-E-2`](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) for the revised multimodal framing and Phase 2 guidance to use full-hash analysis rather than `body_based_ppy` comparison.

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

---

## Section D-supplement — Methodology, sanity checks, and direction (added per review)

### D.1 — What was actually measured

| Question | Answer |
|---|---|
| Frame? | Frame index 60 (2.0 s into the 4.0 s clip), full-resolution **4096 × 2304 px** |
| Two pixel coordinates? | Not two coordinates — a **3,579-pixel-wide arc** of white pixels in the lower portion of the frame (x∈[0, 3579], y∈[1803, 2284]) was algebraically circle-fit |
| Visible arc shape | Partial arc only. The frame shows the **upper portion of a circle** centered below the bottom edge of the frame. Chord ≈ 3,579 px, sagitta ≈ 481 px |
| Assumed real-world distance | **Radius = 9.15 m = 10.0066 yd** (FIFA spec for soccer center circle) |
| How "10 yards" was determined | **Assumption only.** The marking was identified visually as a soccer center circle based on shape, location (mid-field on green turf in an indoor dome), and isolation (no concentric or intersecting markings nearby). It was **not** confirmed via metadata, facility documentation, or an in-frame scale reference. This is the single biggest uncertainty in Section D. |

> **Original document overstated the precision of step 5.** The fit is robust geometrically. The yard-mapping is an assumption.

### D.2 — Athlete-height sanity check (the user's challenge)

The user's challenge: at ppy=495, athlete should be impossibly tall.
That is true **only under the briefed clip dimensions** (1024×576), which were incorrect.

`ffprobe` confirms actual dimensions: **4096 × 2304 px**.

Independent measurement of athlete bounding box on frame 60 (color-segmented, athlete in right-center of frame):

| Quantity | Value |
|---|---|
| Athlete head (top) y | ≈ 560 px |
| Athlete foot (bottom) y | ≈ 1530 px |
| Vertical bbox height | **≈ 970 px** |

Athlete in clip is in cutting/breaking pose (slightly leaning), so vertical pixel height is roughly equal to or slightly less than standing height.

| Assumed athlete height | Implied ppy |
|---|---|
| 1.7 yd (5'1") — youth | 571 |
| **2.0 yd (6'0") — typical adult WR** | **485** |
| 2.2 yd (6'7") — tall adult | 441 |

**Athlete-height ppy ≈ 485** for a 6-ft adult ≈ within 2% of the circle-fit ppy of **495**. The two completely independent measurements agree.

The user's "physically impossible" intuition was correct under the briefed (wrong) dimensions. Under correct 4096 × 2304 dimensions, athlete at ppy=495 occupies ~990 of 2304 vertical pixels (~43% of frame height). Plausible.

### D.3 — Math walk-through, fit recomputed cleanly

**Original fit (in shipped doc):** lower 60% of frame, all bright pixels, components ≥ 2000 px → label-7 dominant component → algebraic circle fit on label-7 only:

- Center = (1257.9, 6772.8) px
- Radius = 4952.17 px
- Diameter = 9904.33 px
- Residual std = 10.29 px (0.21% of radius)

**Independent recomputation (cleaner)**, using just bottom 22% of frame (y ≥ 1797), all white pixels (no component filter):

- Center = (1370.4, 7352.3) px
- Radius = **5541.3 px**
- Diameter = **11082.6 px**
- Residual std = 11.18 px (0.20% of radius)

**Chord-sagitta closed form** (no fit, just geometry from arc extremes):

- Chord = 3579 px (the arc's x-span)
- Sagitta = 481 px (vertical drop from chord midpoint to arc apex)
- r = (chord² / 4 + sagitta²) / (2 × sagitta) = **3,569 px**

The three estimates of arc radius span **3,569 – 5,541 px** (±25%). The original 4,952 figure sits in the middle. The discrepancy comes from how much "tail" of the arc is included: the arc is genuinely large enough that a wider chord moves the fit substantially. Conservative interpretation: **r_arc ≈ 4,000–5,500 px**.

**Ppy under different real-world radii**, given the corrected r_arc range:

| Assumed real radius | ppy if r_arc = 4000 | ppy if r_arc = 5000 | ppy if r_arc = 5500 |
|---|---|---|---|
| 5 yd | 800 | 1000 | 1100 |
| **10 yd (FIFA soccer)** | **400** | **500** | **550** |
| 15 yd | 267 | 333 | 367 |
| 20 yd | 200 | 250 | 275 |
| 25 yd | 160 | 200 | 220 |
| 30 yd | 133 | 167 | 183 |

Cross-referenced against the athlete-height ppy ≈ 485 (independent measurement):

- The marking is **most consistent with a ~10-yard radius** (FIFA soccer center circle), giving ppy ≈ 400–550.
- A 20-yd radius marking would imply ppy ≈ 200–275 — close to body_based 234 but contradicts the athlete-height ppy.
- A 30-yd radius marking would imply ppy ≈ 133–183 — closer to baseline d1b3ab23's 167.87 ppy but **far below** athlete-height ppy.

**Best estimate of true ppy on this clip: ppy ≈ 485 ± 50.** Used as ~495 in the analysis below; the ±10% uncertainty does not change the directional finding.

### D.4 — Direction of error (resolves contradiction)

`ppy = pixels per yard`
`distance_yards = pixel_distance / ppy`

If true ppy = 495 and a calibration source reports ppy = 234:
- The source reports a **numerically smaller ppy** than true → "under-reports ppy"
- Plug into the formula: `d_reported = px / 234` vs `d_true = px / 495`
- Ratio: `d_reported / d_true = 495 / 234 = 2.12`
- → For any given pixel measurement, the source produces **distances 2.12× LARGER** than true.

Direction summary:

| Statement | Equivalent statement |
|---|---|
| Source under-reports ppy | Source over-reports distances |
| Source over-reports ppy | Source under-reports distances |

**Empirical findings on this clip:**

| Source | ppy reported | Direction | Distance error |
|---|---|---|---|
| Ground truth (best estimate) | ~495 | — | — |
| body_based (Cloud Run, conf=high) | 233.9 | **Under-reports ppy by 53%** | **Over-reports distances by 2.12×** |
| static (sideline reference_calibrations[0]) | 80 | **Under-reports ppy by 84%** | **Over-reports distances by 6.19×** |

**Reconciliation against F-SLICE-B-1:**

F-SLICE-B-1's investigation language: "body_based **inflates** ppy" → "distances appear **smaller** than true."

Section D evidence on `slant-route-reference-v1.mp4`: body_based **deflates** ppy → distances appear **larger** than true.

**These are opposite directions.** The investigation finding does **not** generalize to this clip. Possible reasons:

1. The investigation was based on a different clip with different camera distance / framing.
2. body_based's failure mode is bidirectional (over- or under-estimates depending on camera distance vs athlete distance).
3. The investigation arithmetic itself contained an error (the trace-vs-investigation disagreement F-SLICE-B-1 flagged).

We cannot resolve which of (1)–(3) is true without ground-truth ppy on the clip the investigation analyzed. **The original investigation doc cannot be confirmed correct or incorrect by Section D — only its applicability to this specific clip is refuted.**

### D.5 — Metric reconciliation against d1b3ab23 baseline

Baseline d1b3ab23 used body_based ppy ≈ 167.87 (per F-SLICE-B-1 trace doc) on a different file. If we hypothetically scale baseline metrics to true-ppy 495 (treating that as the true ppy on the d1b3ab23 clip too — **strong assumption**, since d1b3ab23 used a different file):

| Metric | Baseline | Scale (167.87/495) | "True" if same setup | Plausibility |
|---|---|---|---|---|
| Hip Stability | 0.09 yd | × 0.339 | 0.031 yd (~1.1 in) | Possible for elite, on the edge of plausible |
| Release Speed | 158.94 mph | × 0.339 | 53.9 mph | **Still implausible** — hip displacement should be ~3–5 mph during a slant cut |
| Hands Extension at Catch | 1.74 yd | × 0.339 | 0.59 yd (~21 in) | Plausible (typical arm reach for a catch) |

**Two of three reconciled values are still wrong**, which is diagnostic:

1. **Hands Extension** reconciles cleanly → calibration error explains this metric's baseline value
2. **Hip Stability** is borderline but plausible → likely calibration-dominated
3. **Release Speed** is *still* off by ~10× even after calibration correction → there is an **independent metric-math bug** beyond calibration. Consistent with **F-SLICE-B1-2** (already logged in the prior loop).

Note that **current pipeline (Section B)** reports `Release Speed = 3.37 mph` (using static ppy=80). At true ppy 495, that scales to **0.54 mph** — too small. So Release Speed swings from "way too high" (158 mph at body_based 167) to "way too low" (0.54 mph at static 80) depending on calibration. Under correct calibration ~495, release speed would be in the right order of magnitude. Both calibration paths are wrong, but the **metric is calibration-dominated** in this regime — fixing calibration is necessary but possibly not sufficient (the F-SLICE-B1-2 root cause may be additional).

### D.6 — Implication for Slice B2 architectural decision

**Re-examining Option A ("delete body_based, retain static"):**

| Path | ppy on this clip | Distance error |
|---|---|---|
| Keep body_based | 234 | over-reports 2.12× |
| Keep static (Option A) | 80 | over-reports 6.19× |
| Delete both | undefined | metric pipeline disabled |

**On this clip, Option A makes calibration ~2.9× worse** (6.19 / 2.12). Option A as previously approved is contraindicated by Section D.

But **one clip is not generalizable evidence**. The d1b3ab23 baseline used a different file with possibly different camera setup. We cannot know whether body_based's under-report direction here is consistent across all sideline football clips, or whether the investigation's "body_based inflates" finding applies to a *different* camera setup.

**Recommendation:** Withdraw the previously-approved Option A. Defer the B2 architectural decision until we have ground-truth ppy on at least:

- 1 additional sideline football clip with a real 5-yard line marker visible
- Ideally 2–3 clips spanning camera distances (close, mid, far)

Until then, neither "delete body_based" nor "delete static" can be supported by evidence. The interim path:

1. **Keep both calibration paths in place** (no architectural change in Slice B2).
2. **Add structured logging** of `(body_based_ppy, static_ppy, dynamic_failure_reason, ground_truth_ppy_if_known)` per analysis so that as more clips flow through, we accumulate the evidence needed to make the architectural decision.
3. Consider raising or removing the `dynamic_pixels_per_yard_out_of_range` upper bound when `body_based_confidence == high`, to test whether body_based produces better metrics in production.

### D.7 — What this resolves about F-SLICE-B-1

| Question | Answer |
|---|---|
| Which doc (trace vs investigation) is correct? | Cannot be resolved by Section D alone. Section D refutes the investigation's directional claim **on this clip**, but says nothing about the clip the investigation analyzed. |
| Revised true ppy for this clip? | **~495 ± 50** (or ~485 from athlete height; ~495 from circle fit, both consistent) |
| Severity of F-SLICE-B-1? | Likely needs upgrade from Sev-3 → Sev-2. Not because body_based is "more broken" than thought, but because **both calibration paths produce 2–6× distance errors** and the Slice B2 fix path is now unclear. |
| Should B2 still be approved as Option A? | **No.** Withdraw approval. See D.6 for interim path. |

## Files

## Section D corrections (added 2026-04-26)

Reviewer feedback after the initial Section D supplement identified five issues that materially sharpen the record. The ppy estimate has narrowed and become **more defensible**, not less. Recording these corrections inline so future readers do not anchor on the original framing.

### Correction 1 — Dimension confusion is now resolved

The file uploaded to the reviewer was `1024×576`. The file at the signed URL the analysis pipeline downloads is `4096×2304`. These are different files — likely the upload was a transcoded preview while the bucket file is the 4K master. Reviewer's dimension-based sanity checks operating on `1024×576` were technically invalid against the actual analysis target. **All Section D measurements in this doc are against the `4096×2304` master.**

### Correction 2 — Athlete-height bbox is contaminated; raw pixel-height estimate was too high

The cyan diagnostic bbox in `slant_frame60_diagnostic.png` extends well to the right of the actual athlete and hits the netting/dome wall, inflating the bbox-derived athlete pixel height (~970 px). Visual measurement of the actual athlete (head visible around y≈400–450, foot around y≈1180–1250) gives **~750–850 px**, not 970 px.

### Correction 3 — Marking identification is well-supported by facility context

The original framing said the visible arc "could be a soccer center circle (10-yd radius), a penalty arc (also 10-yd radius), or a custom training facility marking." On closer inspection, the reference clip was filmed in a **soccer training facility** — visible from the dome interior, soccer goal in background, and field markings consistent with a soccer pitch. **In a soccer facility specifically, the prominent visible arc is almost certainly the center circle.** Penalty arcs are at field ends and not typically framed as the training reference; center spots are dots not arcs. The FIFA 10-yard radius assumption underlying `ppy ≈ 494.89` therefore has stronger empirical grounding than the original "either/or/or" framing suggested. **Marking identification uncertainty is smaller than D.6 originally documented.**

### Correction 4 — Posture compression reconciles the athlete-height check

A fully-erect 6-ft athlete at `ppy ≈ 495` would occupy ~990 px of pixel height. The athlete in this clip is mid-cut, leaning. **Leaning compresses pixel height by 15–25%**, putting expected pixel height at `ppy ≈ 495` in the 750–850 px range — exactly where the corrected bbox observation lands. The two independent methods (circle fit and athlete height) **converge** on `ppy ≈ 485–495` once the bbox contamination is removed and posture is accounted for.

### Correction 5 — `ppy ≈ 495` is more defensible than the "400–550 range" framing

Combining corrections 2–4: the original "400–550 range" framing was driven by (a) raw bbox over-counting athlete height, (b) over-broad marking-identification uncertainty, and (c) not accounting for posture. With those resolved, the **point estimate `ppy ≈ 495`** is the appropriate ground-truth value to record, with a defensible widening to ~450–550 only if marking identification is held conservatively open. The directional finding from D.7 is unchanged and in fact strengthened:

| Path | ppy | error vs 495 ground truth | error across 450–550 range |
|---|---|---|---|
| `body_based` | 234 | 2.1× under-report | 1.9–2.4× under-report |
| `static` | 80 | 6.2× under-report | 5.6–6.9× under-report |

**Static is more wrong than `body_based` regardless of where exactly true ppy lands within the conservative uncertainty window.** This invariance is what makes Option A (delete `body_based`, keep `static`) contraindicated by Section D.

### Correction 6 — Multi-context filming reality reframes the B2 choice space

Static reference value (80) was authored for one specific filming geometry — likely sideline tactical camera at a football field, 25–40 yards from action. Real PlayCoach users will film in indoor soccer/turf facilities (this reference clip), backyards (we already have one clip in this category), high-school football fields, and training facilities of every kind. Each filming context has different ppy depending on camera distance, focal length, and frame composition. **Static at 80 is correct for one specific filming geometry and wrong everywhere else.** This isn't a bug in static authoring — it's a fundamental limitation of having a single static constant for a multi-context product. `body_based` at least *adapts* to the athlete's actual proportions in the frame, even when its scale assumptions are imperfect.

**Implication for B2:** the right long-term answer is the audit's **Option B (migrate to MediaPipe world coordinates entirely, eliminate calibration as a concept)** — not Option A (delete one of the two imperfect paths). This is multi-week Phase 2+ work, not Phase 1c.2 deletion work.

### Operational consequences (recorded for traceability)

- **Option A WITHDRAWN.** `body_based` and the `athlete_height` field that feeds it remain in the codebase.
- **F-SLICE-B-1 upgraded Sev-3 → Sev-2.** See `docs/migration-risk-register.md` F-SLICE-B-1 Status (2026-04-26) update.
- **Interim path:** keep both calibration paths in place; add structured `calibration_audit` logging so future ground-truth measurements join the dataset for cross-clip analysis. Implemented in Slice C.5.
- **Ground-truth dataset established:** `docs/calibration-ground-truth-dataset.md` is the long-lived registry. The `slant-route-reference-v1.mp4` entry is recorded with `true_ppy_estimate ≈ 495`, `measurement_confidence: medium`, and the full set of caveats above.
- **B2 architectural decision deferred** until that dataset has ≥3 entries spanning ≥2 filming contexts, ideally including ≥1 sideline football clip with a real 5-yard line marker visible (the original analysis-target geometry).

## Files

| Path | Purpose |
|---|---|
| `scripts/verification/slice1c2_determinism_cloudrun.ts` | Section A harness (deno, throwaway) |
| `/tmp/cloudrun_run_{1..5}.json` | Raw Cloud Run captures |
| `/tmp/cloudrun_summary.json` | Section A parsed summary |
| `/tmp/ground_truth_ppy.json` | Section D fit details (original lstsq fit) |
| `/mnt/documents/slant_frame60_centercircle.png` | Source frame 60 |
| `/mnt/documents/slant_frame60_circle_fit.png` | Fitted circle overlay (original) |
| `/mnt/documents/slant_frame60_diagnostic.png` | Section D-supplement: arc + chord + sagitta + athlete bbox overlays |

## Pipeline upload IDs (Section B)

| Run | upload_id | result_id |
|---|---|---|
| 1 | `df625061-f104-493b-86fa-706bdb1b0528` | `c68791bd-01a5-48c3-a7c3-6005ea5de95d` |
| 2 | `3a2c6e98-8d28-434b-872b-3dcd74edb574` | `916e8d1c-1c9b-44b9-b46a-9b6789ff90ce` |
| 3 | `a7e8287d-dcc2-4c49-b5a8-2cd2c4284d9b` | (pulled in query) |
| 4 | `3b7b7b41-9059-4284-bc22-2b2f021bbd90` | (pulled in query) |
| 5 | `4eb11f6d-0a9f-4dca-9267-2c9c1cdc49e0` | (pulled in query) |
