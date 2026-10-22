# Pose overlay player (admin only, Testing Panel result view)

## What's stored (checked on bcf95d35)
- Keypoints: `diagnostics.raw_keypoints`, 90 frames x 33 landmarks, original 3840x2160 pixel coordinates.
- Confidence: **per-frame, per-landmark confidence is stored** (`diagnostics.raw_scores`, 90 x 33). The player uses it; run-level RELIABLE/MARGINAL/UNRELIABLE status is the fallback only for runs without it.
- Per-frame: hip center, scale, athlete height, mean confidence, phases.
- Service: fps 30, frame size, missed / rejected (+ reasons) / recovered (leading recovery, frames 0-22) / zoom-fallback (following crop, frames 77-89) frame lists, auto-zoom factor 1.75 and crop rectangle.
- Phase windows, metric details with frames used and keypoint indices, release anchor (log), catch anchor (catch metric detail).
- Smoothed keypoints are not stored separately. "Smoothed" view recomputes them from raw keypoints with the analyzer's own smoothing code (same 3-frame window, same missing-frame rules), so it is exactly what metrics used. Nothing is written.
- The upload's stored clip link is a short-lived signed link; the player requests a fresh one through the existing admin function.

## Player
1. **Video + canvas**: source clip with overlay, frame-synced via requestVideoFrameCallback (fallback currentTime x fps). Play/pause, 0.25x/0.5x/1x, step +/-1 frame (buttons and arrow keys), scrubber.
2. **Skeleton**: 33 landmarks + standard MediaPipe connections. Green reliable, yellow marginal, red unreliable (same thresholds as the Analysis Log); a line takes its weaker endpoint's color; confidence-0 points hidden. Missed/rejected frames draw nothing and show "No detection". Raw / Smoothed toggle.
3. **Top-left panel**: "Frame 46/89 · 1.53s"; active phase(s), both when overlapping, "pre-release (stance)" before the first; frame source (main pass with zoom 1.75x, leading recovery, following crop, missed, rejected + reason); "Release anchor" / "Catch anchor" tags on their frames; legend (confidence colors, hip trail, metric highlight).
4. **Metric highlights**: built from the run's own metrics (any node). Dropdown: All or one metric. Highlights that metric's keypoints on its frames used, with name and value in the panel; angle metrics show the live angle at the middle joint (e.g. plant knee).
5. **Hip trail** toggle: hip-center path from frame 0 to the current frame (from stored per-frame hip centers).
6. **Follow athlete**: default on when athlete is under 20% of frame height. Crop ~1/3 of frame width centered on 9-frame moving-average hip, scaled to fill. Minimap corner: full frame, auto-zoom crop (white), follow window (orange), hip trail.
7. **Phase timeline** under the player: one thin bar per phase (overlaps visible), playhead, markers for release anchor, catch anchor and metric frames; click to seek.
8. Empty state "No stored keypoints for this run." when keypoints are absent.

Opened from a "Pose overlay" button in the Testing Panel result view, admin only (same guard as today).

## Verification
- Open bcf95d35, screenshot frames 10, 46, 82 with follow on, and show them next to your references.
- Check the hip trail points equal the stored per-frame hip centers for every frame.
- Tests: coordinate scaling (native to display and to follow crop), frame-source lookup, phase overlap labels, metric-highlight frames from stored detail.

## Technical details
- Pure helpers in `src/features/athlete-lab/utils/poseOverlay.ts` (scaling, frame source, phase labels, highlight resolution, follow window, confidence color); tests in `src/test/poseOverlay.test.ts`.
- Component `src/features/athlete-lab/components/PoseOverlayPlayer.tsx`, local state only; data fetched through `src/services/athleteLab.ts` (existing admin result fetch + signed clip link).
- Smoothed view imports `supabase/functions/analyze-athlete-video/smoothing.ts` (pure).
- No analyzer, scoring, node, or pose-service changes; AGENTS.md gets one rule for the overlay helper module.
