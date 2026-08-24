---
id: F-POSE-2
title: Auto-zoom probe implies 1000 fps timestamps to the VIDEO-mode tracker
status: open
severity: Sev-2
origin_slice: PHASE-2A
origin_doc: docs/process/phase-2a-slice-b1-outcome.md
related_adrs: [ADR-0009]
related_entries: [F-POSE-1, F-SLICE-E-2]
opened: 2026-08-24
last_updated: 2026-08-24
---

# F-POSE-2 — Auto-zoom probe implies 1000 fps timestamps to the VIDEO-mode tracker

- **Phase:** PHASE-2A (surfaced during the determinism gate on the B1/B2 band)
- **Severity:** Sev-2 — silent correctness drift in the auto-zoom firing decision and in the landmarks the probe returns.
- **Status:** Open. Stands as its own defect independent of F-POSE-1: it is wrong on its face, not merely nondeterministic.

## Mechanism

Two timestamp conventions are in use against the same VIDEO-mode landmarker:

- **Main pass.** `run_with_skip` uses `PoseEngine.reserve_timestamp_range(n_frames, fps)`
  (`pose.py`), which computes `frame_interval_ms = max(1, round(1000 / fps))` —
  33 ms at the pipeline's `TARGET_FPS = 30`. Correct.
- **Auto-zoom probe.** `auto_zoom.decide_and_apply` calls
  `engine.detect(frames[i])` with `timestamp_ms=None`. The default branch in
  `PoseEngine.detect` increments `_next_ts_ms` by **1**, i.e. one millisecond per
  frame — an implied **1000 fps**.

`detect_for_video` reads timestamp deltas to drive its temporal filtering and
tracking window. The probe is therefore telling the tracker that the athlete
covered a full frame's worth of displacement in 1 ms, across frames that are in
reality sampled *evenly across the whole clip* (`_sample_indices`) and so are
seconds apart in source time.

## Why it matters beyond determinism

The probe's outputs are not diagnostic-only. They feed:

- `_bbox_fill` → `avg_fill` → the `FILL_THRESHOLD = 0.30` firing decision
- `_median_hip` → the crop origin, and therefore which pixels the second pass sees
- `_mean_conf` → the `0.85` safety-backoff decision

A tracker being fed physically impossible frame intervals is being asked to
track motion it cannot model. Any degradation in probe landmark quality
propagates straight into the crop geometry and hence into `body_based_ppy`.

## Observed context

In the nine stored canonical-clip runs analysed on 2026-08-24, the probe's
`mean_conf_before` took two discrete values (`0.72` and `0.84`) on identical
bytes, and `crop_rect.y` moved 37 px between them. The probe is where the
divergence is first visible.

## Note on ordering

Both conventions advance the same shared `_next_ts_ms` counter, so the probe's
1 ms-per-frame stride also shifts the absolute timestamp base the main pass then
reserves. The two defects (this and F-POSE-1) interact; fixing the timestamp
convention alone does not make analysis pure.

## Remediation (not implemented)

Pass real source-time timestamps into the probe — the sample indices are known,
so `idx / TARGET_FPS * 1000` is available at the call site. This is a small
change, but it alters landmarks and therefore the `calibration_audit` hash, so it
carries the same baseline-reset cost as any other fix in this family and must not
land mid-measurement.
