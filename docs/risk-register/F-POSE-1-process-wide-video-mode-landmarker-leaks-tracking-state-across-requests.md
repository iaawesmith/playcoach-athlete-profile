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
