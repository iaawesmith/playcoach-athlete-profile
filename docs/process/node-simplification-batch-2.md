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

## Pending — not a completed batch

- External Cloud Run deploy: no authenticated deployment connection available. Previous service deployment used user Cloud Shell.
- Analyzer deployment must run `bun scripts/stamp-analyzer-build.ts` immediately beforehand.
- Recover/reconstruct the stored-data comparator; target c6fa0895 fingerprint is `718c917a66f44a5edb40fde67c80ccf704f9a0ebc22a7d916541adaf6e55688e`.
- After service deploy, fresh library 932b91df run must detect all 90 frames, match keypoint fingerprint `aa28d25d143392ab0029726ece774454b2b64e89b77e1beb8bf41442da6c4867`, preserve leading-recovery and following-crop frame lists and score 94. Stop on keypoint drift, report the changes, and do not proceed.
- Only after that check passes, open stored bcf95d35 overlay. No simulated history or video substitution counts as verification.

No fresh run or redeploy has been claimed. Production service remains unchanged.