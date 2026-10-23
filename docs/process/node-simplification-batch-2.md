# Node simplification — Batch 2 Pipeline Setup

## Restore point

Pre-batch revision: `7712968`. Lovable's history identifier is unavailable; use the history entry immediately preceding this batch.

## Source changes

- Hide Pipeline Config, segmentation selector and Checkpoints; phase proportions remain visible and readiness always validates their sum.
- Omit retired fields from node edit-save patches, preserving database values exactly. No node data migration.
- Omit retired controls from generated admin text exports.
- Analyzer request contains only video URL and start/end timestamps; no per-scenario detection resolution.
- Pose request removes solution class, performance mode, tracking and detection frequency. Every decoded frame invokes detection, retaining the original timestamp clock. The video decoder still normalizes to 30 FPS; no decoder/model/crop/calibration changes.
- Keep legacy response diagnostics `det_frequency_used` and `detection_every_n` as 1 for compatibility.

## Verified

- 149 frontend/analyzer tests pass.
- 17 existing framing tests and 2 new every-frame loop tests pass (90 frames at 30 FPS and 180 frames at 60 FPS).
- Python source compiles; preview reports build OK.

## Live checks — October 23

- User confirmed pose deployment; fresh run response records service build `4b79473`, revision `mediapipe-service-00021-dzs`.
- Fresh library 932b91df run: upload `6531386b-d343-47f3-89e9-f42cf72f1f8e`, result `3656cb1f-910a-4fc5-998f-b2a7896900f3`. All 90 frames detected; SHA256 `aa28d25d143392ab0029726ece774454b2b64e89b77e1beb8bf41442da6c4867` unchanged. Leading recovery frames 0–22 and following-crop frames 77–89 unchanged. Aggregate 94. No keypoint drift.
- c6fa0895 stored-data rescore: aggregate 94 → 94; Plant Leg Extension 139.61 / 100, Hip Stability 0.01 / 100, Release Speed 3.76 / 68.97650277178401, Speed into the break 1.00 / 100. Real stored raw keypoints/scores used; stored result not overwritten.
- bcf95d35 is a result ID; its actual upload is `9078c337-97cc-41ad-a622-dc07b8957800`. Browser opened the existing overlay directly with that upload ID and fetched its real stored data. Canvas, scale/height panel and phase timeline rendered. No history fixtures or replacement video used.

## Pending — not a completed batch

- Exact historical metrics fingerprint remains unverified: original `/tmp/b0/batch1_cmp.ts` and serialization were not recoverable from surviving logs. The later full-metric-array comparator hashes to `d6cd603659986cca8578f27c0e8a6014a86f043200be0e8fa2922c6ae5af3013`, not the approved `718c917a66f44a5edb40fde67c80ccf704f9a0ebc22a7d916541adaf6e55688e`. Identical metric values do not prove exact fingerprint equivalence; this is not evidence of keypoint drift.
- Normal history access returned no rows even with All dates. Direct player inspection bypassed navigation only, not data loading; therefore the history-to-player flow is unverified.
- Original video failed playback in sandbox Chromium (media error 4, zero video dimensions) even after the player's one-time fresh-link request. Stored skeleton rendered over black; synchronization/alignment against video is unverified. Evidence: `/tmp/browser/batch2checks/bcf95d35_overlay.png`.
- Do not start Batch 3. Analyzer deployments must still run `bun scripts/stamp-analyzer-build.ts` immediately beforehand.