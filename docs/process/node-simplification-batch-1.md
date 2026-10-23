# Node simplification — Batch 1 Camera

## Restore point

Pre-batch repository revision: `42e63ab`. Lovable's history entry identifier is unavailable to the agent; the history entry immediately before this Camera batch is the UI restore point. Slant WR's original filming instructions are retained under `batch1_archived_filming_instructions` in its Camera JSON.

## Changes

- Hide min FPS, min resolution and legacy auto-reject settings; parsing/serialization preserves every hidden saved key.
- Keep recommended distance and athlete filming instructions. Preserve legacy plain-text instructions too.
- Editor and export derive required visible body parts from active metrics only.
- Camera readiness checks distance guidance only and no longer claims to validate uploaded footage.
- Update Slant WR instructions: maximum 3-second clip, no 60 fps requirement, no hands-at-catch requirement, required athlete height. Node version 12, LIVE status, metrics and scoring unchanged.
- No Reference camera-angle changes, analyzer changes, deployment or new pose run.

## Verification

- All 147 tests pass, including five new Camera tests for preservation, active-only visibility and distance readiness.
- Preview build reports `build OK`.
- Real Slant WR Reference page loaded from the database: no FPS/resolution controls; distance 8–15 yards; only hips, knees and ankles listed; updated instructions displayed.
- Stored-data rescore uses `diagnostics.raw_keypoints` and `raw_scores` from all 90 frames of c6fa0895 with stored per-frame scales and phase windows. The current analyzer and Batch 0 baseline both produce:
  `718c917a66f44a5edb40fde67c80ccf704f9a0ebc22a7d916541adaf6e55688e`.
- Plant Leg Extension 139.61 / 100, Hip Stability 0.01 / 100, Release Speed 3.76 / 68.9765, Speed into the break 1.00 / 100. Aggregate remains 94. Nothing overwritten on the stored run.
- Verification artifacts: `/tmp/b0/batch1_cmp.ts`, `/tmp/b0/batch1_result.log`, `/tmp/browser/batch1/camera.png`.

## Remaining batches

Use the full fingerprint above for every remaining batch, not the historic stored diagnostic digest. Stop here for user approval of Batch 2.