# Event detection fixes (2026-10-28)

Scope: `segmentation.ts` detectors and their call site only. Metric definitions, node configs, scoring math and the Reference tab are unchanged. Stored baseline `fba7237f…` is not replaced and still matches (aggregate 94).

## Rules
- Snap: original stance rule first. If fewer than 3 stance frames, or no sustained movement, fall back to the first sustained forward acceleration (3-frame mean hip speed rising over 3 frames, +0.02 yd/frame, reaching 0.033 yd/frame; confidence 0.7). If the athlete is already at 0.067 yd/frame when first tracked, snap = first tracked frame (`in_motion_at_start`, confidence 0.5).
- Break: original fixed rule first (30 deg runs, 60 deg peak). If it fails, clip-relative: runs above max(15 deg, 2x the clip's median turn), peak above max(30 deg, 3x median), confidence x0.8. When the calibration scale is a single value or flat, depth comes from the athlete's rolling-median shoulder-to-ankle size (direction only, never a measured distance).
- Catch: hands raised together (original) or hands converging with a forward reach at any height above the hips (gap <= 0.45 torso, both wrists >= 0.3 torso to the same side of the shoulders, gap closed >= 0.15 torso over the prior 8 frames). Earliest qualifying run wins.

## Fresh runs (analyzer b652dfa / f82f8a8, pose ad629f9)
| Clip | Before | After | Snap | Break | Catch |
|---|---|---|---|---|---|
| In - Sideline | 98 | 98 | 12 | 92 | none |
| Curl | 43 | 44 | 21 | 75 | 99 |
| Comeback | 42 | 42 | 10 | 77 | 114 |
| Out | 28 | 28 | 13 (in motion) | 52 | 89 |
| Wheel | 24 | 24 | 58 (accel) | 235 | none |
| Cross | 0 | 56 | 36 | 50 (body size) | 88 |
| Corner | 0 | 42 | 12 | 57 (relative) | 126 |
| Post | 0 | 0 | 17 (accel) | none | none |
| Go (x2) | 0 | 63 / 63 | 10 (accel) | n/a | 88 |
| Slant Indoor Diagonal | 94 | 94 | 10 | 44 | 85 |
