# Seven follow-ups from run c6fa0895

Run c6fa0895 (library clip 932b91df, 69 in, start yard 5, break yard 9, expected depth 4 yd) currently scores 94.

## 1. Speed into the break (Slant v12)
- Peak search limited to Stem frames that come before Break starts (Stem 19 to 37 on this clip). Today the search runs over all of Stem, which is why the peak landed on frames 39 to 43, inside Break.
- Tolerance changes from 0.2 to 0.05. Target 0.9, at_least and weight 15 stay the same.
- Rescore c6fa0895 from stored data only (no new pose run, saved result left alone). Report end frames, peak frames, value, score, and the new aggregate.

## 2. "Perfect" ban scope
- Don't flag "perfect" when it refers to the score ("perfect score", "a perfect 100", "scored perfect").
- Still flag it when it describes the athlete or the rep ("perfect release", "that rep was perfect").
- Test: the rejected retry from c6fa0895, read from its stored diagnostics, is checked again. Its score wording passes, and an athlete or rep phrase still fails.

## 3. Word budget
- Prompt asks for 120 to 140 words. The check rejects only above 160.
- The fallback summary also stays at or under 160.

## 4. Build stamps
- analyzer_build is set automatically at deploy as commit plus date (for example `a1b2c3d-2026-10-22`). It's written into the function during deploy, with no hand-edited constant. If unavailable, it's stored as "unknown" rather than an old value.
- run_identity.cloud_run_revision comes from the pose service's response (its `service_revision`). Today it reads the analyzer's own environment, which is empty.

## 5. Ground-truth speed check (library runs only)
- When start and break yard lines are set: expected speed = expected depth / time from the release anchor frame to the break anchor frame.
- Compare with the mean measured hip speed across Stem (calibrated, per-frame scale).
- Analysis Log line: "Ground truth speed: expected 3.50 yd/s, measured 3.47 yd/s (0.9% off), PASS". PASS within 10%, otherwise WARN. It's display only and doesn't affect scoring.
- Also included in the diagnostic export. Verify that c6fa0895 reads about 3.5 vs 3.47.

## 6. Seam flags
- Mark each frame where the frame source changes (leading recovery to main, main to following crop, and any other change).
- Export: `frame_source_seams: [{ frame, from, to }]`, plus a `seam: true` flag on that row of the per-frame table.
- Overlay: a tick on the timeline at each seam, and a "Seam: main → following crop" badge on that frame.

## 7. Clip 932b91df
- Add "height_based" as an expected calibration source option (form dropdown and the allowed values in the type).
- Set clip 932b91df to height_based. It's currently body_based. The values stored on past runs stay as they were recorded.

## Unchanged
Other metrics, phases, weights, the pose service, and saved results.

## Technical details
- `speedRetention.ts`: add a `peakEnd` input set to `min(stemEnd, nextPhaseStart - 1)`, which the analyzer passes at both call sites (lines ~2863 and ~4373). Add a test.
- `prompt.ts`: strip score-referent patterns before the "perfect" test, same as the existing "at or under is perfect" strip. `MAX_FEEDBACK_WORDS = 160`, plus a separate instructed range in the template and Slant system instructions. Tests are in `coachingPrompt.test.ts`.
- `ANALYZER_BUILD` comes from a generated `build.ts` written by a deploy step from `git rev-parse --short HEAD` plus the date. `cloud_run_revision` is set to `rtmlibResult.service_revision`.
- New pure helper `groundTruthSpeed.ts` (tested), written to `result_data.diagnostics.ground_truth_speed` on library runs. `analysisLogReporting` and `diagnosticExport` read it. The c6fa0895 rescore computes it from stored data.
- Seams are computed in `poseOverlay.ts` from the stored per-frame source and reused by `diagnosticExport.ts`.
- A data update for clip 932b91df. Check `admin-calibration-clips` for value validation.
- Node v12 is a data update to `key_metrics` (tolerance only). Slant stays LIVE.
