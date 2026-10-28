# Event detection fixes (snap, break, catch) + Go determinism

Scope: event detection in `segmentation.ts` and its call site in `index.ts` only. No changes to metric definitions, node configs, scoring math, badges or the Reference tab. Stored baseline fingerprint `fba7237f…` is not replaced.

## 0. Determinism first (Go - Sideline 37 then 0)
Snap today reads only the first stance frames; any hip frame below the hip-confidence floor drops out, and fewer than 3 left means `insufficient_stance_frames`. A small confidence wobble between two runs flips snap on/off, which skips every snap-dependent metric.
- Compare the two stored Go runs frame by frame (hip coordinates, hip confidence, recovery/crop frames, pose revision, decode line).
- If the keypoints differ: the cause is in the pose service (tracker or recovery path). I report it and propose a pose-service fix separately, and do not deploy any pose-service change without telling you.
- If the keypoints are identical: the cause is in the analyzer, and I fix it here.
- Either way, fix 1 below removes the hard flip: a borderline stance no longer drops snap entirely.

## 1. Snap without a stance
- Keep the current method when the stance has at least 3 usable frames (In, Slant unchanged).
- Otherwise fall back to the first sustained forward acceleration: smoothed calibrated hip speed rising over 3 consecutive frames and passing an absolute floor (yd/s on each frame's own scale), within the first part of the clip.
- Snap records `method` (`stance_jitter` or `acceleration_fallback`) and a lower confidence for the fallback. If the athlete is already at speed from frame 0, snap = first usable frame, flagged `in_motion_at_start`.

## 2. Break relative to the clip's own motion
- Replace the fixed 60-degree peak with a clip-relative test: the sharpest sustained turn after snap must stand out from that clip's straight-running turn noise (peak at least several times the median turn, with an absolute floor around 20 degrees so a straight run never qualifies).
- Measure the turn over a span scaled by distance travelled (yards) rather than a fixed frame count, so a 3-yard shallow cut and an 8-yard deep cut are compared fairly.
- Keep the ground-plane math and the coverage check. Record the noise level, ratio and all candidates in the log.

## 3. Catch: hands converging with a forward reach
- Drop the above-shoulder requirement.
- Catch = both wrists confident, the gap between them shrinking to within about 1.5 shoulder widths, and both wrists extended away from the torso (wrist-to-shoulder distance compared with arm length), for at least 2 frames, after the break (or after snap on no-break routes).
- Frame = the tightest hand gap in the first qualifying run. A normal running arm swing (hands moving opposite ways) still does not qualify.

## Verification
- Unit tests for each new rule: stance-less snap, 3-yd and 8-yd synthetic cuts, straight run never breaks, chest-height catch, arm swing not a catch.
- Stored-data rescore with `--anchor-events` on all nine sideline clips, plus In - Sideline and SLANT - INDOOR DIAGONAL; report detected snap/break/catch frames and scores before and after.
- Do not regress: In - Sideline 98 (snap and break at confidence 1.0) and SLANT baseline 94. If either moves, stop and report before deploying.
- Then deploy the analyzer, run fresh runs of the nine clips, and report events, scores and run time. Go - Sideline runs twice to confirm the same result both times.

## Technical details
- Files: `supabase/functions/analyze-athlete-video/segmentation.ts` (computeReleaseAnchor fallback, detectBreak relative test, detectCatch rewrite), `index.ts` (passes per-frame scale to snap), `src/test/segmentation.test.ts`, `src/test/routeEvents.test.ts`, `docs/process/event-detection-fixes.md`, one AGENTS.md line updated.
- Constants are named and recorded in each event's detail so the log shows why something was or wasn't detected.
- `fingerprint-rescore.ts --expect fba7237f…` on legacy phases must still match.
