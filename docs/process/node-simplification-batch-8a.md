# Node simplification — Batch 8a code cleanup only

## Restore point

Pre-edit repository revision: `675a07241c85d5175fc09b156c193b18abe4bd5c`. Use its corresponding Lovable history entry; no separate history identifier is available.

## Scope

- Removed unused PoseEngine/pose_engine declarations, Analysis Log Solution Class/Model rows, WholeBody Catch Efficiency preset, legacy admin reference placeholder, Data Dictionary MMPose status/filter/reference presentation, stale comments and historical rtmlibSummary reader.
- Renamed live analyzer response/base/URL/fallback identifiers to pose names; error labels now say POSE_SERVICE_URL. Preserve URL resolution precedence, the legacy RTMLIB_URL secret alias, and the exact existing fallback endpoint.
- Retain persisted log_data.rtmlib unchanged. The analyzer, overlay, Testing Panel and diagnostic export use local poseLog aliases. Existing readers/tests still load the same namespace; no duplicate stored pose key or data migration.
- Neutral checklist constant names retain historical rtmw_model_confirmed/wholebody_tested IDs so saved completion and notes survive.
- No pose-service file changed or deployment needed. No node/knowledge-base writes, stored-run updates, metric/scoring/calibration/crop/model/frame-clock changes. Batch 8b not started.

## Verification

- c6fa0895 before/after on identical saved input and final fresh database read: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94. Canonical values/scores/statuses unchanged. Only Slow release off the line detected.
- Analyzer stamp `7101f74-2026-10-23`; analyzer submitted source SHA256 `ae66a8fcc15bcd25e75b7d0687e1376073e396e18fd107495bb7915528dbb659`. Analyzer and pipeline-health deployed; pose service remains `4b79473` / `mediapipe-service-00021-dzs`.
- Fresh actual library clip `932b91df-48e8-4d2e-8640-b2182d2a1b6c`: upload `98680e7b-cf10-4355-8b5a-dec8f31c42a5`, result `9b9c1c1d-7e23-4077-b9d0-ba98d08641ab`. 90/90 frames, keypoint SHA256 `aa28d25d143392ab0029726ece774454b2b64e89b77e1beb8bf41442da6c4867`, aggregate 94. Recovery 0–22, following crop 77–89 unchanged. Read back through the normal result normalization and rendered Analysis Log; no synthetic result fixtures.
- Existing bcf95d35 overlay fetched real stored data via upload `9078c337-97cc-41ad-a622-dc07b8957800`; skeleton, confidence, scale 242.5 px/yd, height 241px, phase windows and timeline visibly render. Same existing Chromium media error 4 after a fresh link: video playback/alignment remains unverified. History returns no rows, so the existing player was mounted directly for this data-loading check, without replacement video.
- 171 tests pass, including an added historical-log overlay regression; preview build OK.
- Browser checks used the existing public admin surface because session minting found no auth users; no auth or security changes were made.

Stopped after Batch 8a.