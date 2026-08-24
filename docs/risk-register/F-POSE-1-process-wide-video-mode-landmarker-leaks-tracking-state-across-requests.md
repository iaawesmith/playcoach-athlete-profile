---
id: F-POSE-1
title: Process-wide VIDEO-mode landmarker leaks tracking state across requests and athletes
status: open
severity: Sev-1
origin_slice: PHASE-2A
origin_doc: docs/process/phase-2a-slice-b1-outcome.md
related_adrs: [ADR-0005, ADR-0009, ADR-0014]
related_entries: [F-SLICE-E-2, F-POSE-2, F-CALIB-1, F-SLICE-B-1]
opened: 2026-08-24
last_updated: 2026-08-24
---

# F-POSE-1 — Process-wide VIDEO-mode landmarker leaks tracking state across requests and athletes

- **Phase:** PHASE-2A (surfaced while gating the B1/B2 drift band; the defect itself predates and is independent of B1/B2)
- **Severity:** Sev-1 — analysis output is not a function of analysis input. Ships as confident, silently-wrong metrics.
- **Status:** Open. No code change made. Scoping of remediation options requested; implementation not approved.

## Mechanism

`mediapipe-service/app/pose.py` constructs one `PoseLandmarker` with
`running_mode=RunningMode.VIDEO` and holds it as a module-level singleton
(`_ENGINE`, `get_engine()`), documented as "reused for the container's lifetime."

Two consequences follow directly:

1. **Cross-request tracking history.** `detect_for_video` is history-dependent by
   design: with `min_tracking_confidence=0.5` it tracks from the previous frame
   and only re-runs full detection when tracking is lost. Therefore
   `detect(frame_i)` depends on every frame the container has previously
   processed — including frames belonging to **other requests, other clips, and
   other athletes**. The same clip analyzed twice on containers with different
   request histories returns different landmarks.

2. **Unguarded concurrent access.** `_ts_lock` guards the `_next_ts_ms` counter
   but **not the landmarker itself**. `main.py` dispatches pose work via
   `asyncio.to_thread`, so two in-flight requests on one instance interleave
   `detect_for_video` calls against a single stateful object. Two athletes
   analyzed concurrently contaminate each other's results.

A third contributor is the cold-vs-warm container split: a fresh instance starts
with clean tracking state and `_next_ts_ms = 0`, a warm one does not, and which
instance serves a run is decided by Cloud Run autoscaling — external and
timing-dependent.

## Evidence (read-only query, 2026-08-24)

Nine stored runs of the canonical clip
`athlete-videos/test-clips/slant-route-reference-v1.mp4` at identical inputs
(`start_seconds=0`, `end_seconds=3`, `camera_angle=sideline`) split into exactly
two discrete states:

| Runs | `mean_conf_before` | `final_fill_ratio` | `crop_rect.y` | `body_based_ppy` |
|---|---|---|---|---|
| 7 | `0.7198830715267721` | `0.0599` | `525` | `200.21353797234588` |
| 2 | `0.8364339660514485` / `0.8400683950896215` | `0.0385` | `562` | `201.7827255013638` |

Within each group the values are **bit-identical**, so this is not float jitter —
it is a discrete difference in engine state. The probe detections themselves
differ (mean confidence `0.72` vs `0.84` on identical bytes), which is upstream
of every threshold in `auto_zoom.py`. The `+0.784%` `body_based_ppy` separation
recorded in F-SLICE-E-2 is the downstream consequence: a 37 px shift in crop
origin changes which pixels the model sees on the second pass.

## Why `calibration_audit` cannot reveal it

`calibration_audit` records no engine-state, container-identity, or
concurrency information. The audit is bit-stable within a mode, so a
contaminated run is indistinguishable from a clean one in the stored artifact.
Invisibility is the defect's primary danger, exactly as with the
`world_keypoints` zeroing defect.

## Consequences

- Analysis is not reproducible for fixed input bytes.
- Concurrent analyses can corrupt each other with no error surfaced.
- Any determinism bar expressed as a tolerance band (ADR-0005) is measuring a
  noise floor that this defect creates, not a property of the code under test.
- Ground-truth entries record a `body_based_ppy` that depends on request
  history, which weakens every entry in `docs/reference/calibration/ground-truth.yaml`.

## Remediation options (scoped, not implemented)

See the costed comparison of `RunningMode.IMAGE`, per-request landmarker, and
pooled-with-reset in the Phase 2a determinism scoping report. Note that the
MediaPipe Python Tasks API exposes no tracking-state reset short of `close()` +
reconstruction, so the pooled option does not eliminate history without
rebuilding the landmarker.

## Blocking relationships

- The B1/B2 drift band (ADR-0005 Option D) is unmeasurable while this is open,
  because within-arm variance is driven by this defect rather than by the change
  under test.
- Any fix changes landmarks → `body_based_ppy` → the `calibration_audit` hash,
  which resets the baseline artifact the band measures.

## Ground-truth admissibility ruling (2026-08-24)

The n=1 soccer-facility entry (`slant-route-reference-v1.mp4`) is the entire
second filming context, so whether the fix invalidates it decides whether A3's
plan is rescheduled or rebuilt. Ruling, per-field rather than per-entry, because
the entry is not one measurement:

**Admissible, unchanged — the fields the ADR-0004 threshold is actually counting.**

- `true_ppy_estimate` (point 495, convergence 485–495). Produced by
  least-squares circle fit on the visible arc plus a manual athlete-height
  cross-check. Both are measurements of **pixels in frames**, taken by a human
  against the master file. Neither consumes MediaPipe output. F-POSE-1 cannot
  reach them.
  - One qualifier, stated rather than buried: methodology #2 references a "cyan
    diagnostic bbox" that *was* pipeline-derived. But the entry explicitly
    **discards** it as contaminated by the dome wall (970 px overstated) and
    substitutes hand-read head/foot coordinates (750–850 px). The recorded value
    rests on the manual reading, not the pipeline's.
- `notes.filming_context` — the soccer-dome identification. Observational.
- `static_ppy_at_time_of_measurement: 80` — a compile-time constant, not a
  measurement.
- `measurement_confidence: medium` and its rationale — unaffected.

**Stale, must be re-measured post-fix.**

- `body_based_ppy_at_time_of_measurement.edge_function_*` — recorded as
  `200.21` (5 runs) and `201.78` (1 run). **Those are precisely the two F-POSE-1
  modes** identified in the correlation query above (mode A `200.21353797234588`,
  mode B `201.7827255013638`). The entry has been recording this defect's
  signature since 2026-04-26 under the label "possible Cloud Run instance
  variance vs. real determinism issue." It was the real determinism issue.
- `inter_run_drift_pct: 0.78` and the dataset-level `noise_floor_pct: 1.0` /
  `noise_floor_origin` — these describe the defect, not the code. They become
  historical record once the fix lands (see ADR-0005 supersede note).
- `path_disagreement` Cloud Run 235.32 vs edge 200–202, and
  `cloud_run_service_side` values — measured through the same defective engine.

**Surviving conclusions, robust to the fix.** The directional finding
(`body_based` under-reports ppy by 1.7–2.4×; static by 5–6.9×; both under-report
vs ~495) holds. The mode spread is 0.78%; the conclusion rests on a 2×-order gap.
A sub-1% perturbation cannot flip it. Same for the 14–15% path disagreement.

**Answer to "n=1 or n=0 of trustworthy data": n=1.** Not n=0, and the difference
is not a technicality. What ADR-0004's threshold counts is *ground-truth ppy per
filming context* — the independent variable the calibration paths are scored
against. That value is intact and was never pipeline-derived. What is invalidated
is the *dependent* variable, the `body_based_ppy` the entry is scored against,
and that is recoverable **without refilming**: the clip is still at
`athlete-videos/test-clips/slant-route-reference-v1.mp4`, so re-measurement is
one re-analysis after the fix, not a new context acquisition.

**Consequence for A3: reschedule, not rebuild.** The `n>=3 across >=2 contexts`
threshold remains reachable with the three side-angle clips from the new rig
(context B) plus the retained soccer-facility entry (context A). The asymmetry
already flagged — context A rests on a single measurement — is unchanged by this
ruling, neither improved nor worsened.

**Added obligation, and it is a real one:** every `body_based_ppy` in
`ground-truth.yaml` must be re-measured post-fix, including the existing entry.
Appending new entries measured post-fix alongside a stale pre-fix value would put
two incomparable measurement regimes in one column with nothing marking the
boundary — the same class of error as the pre-C.5 / post-C.5 comparability
footnote the entry already carries. That is why step 2 stays held until the fix
lands, rather than proceeding in parallel with the trim.
