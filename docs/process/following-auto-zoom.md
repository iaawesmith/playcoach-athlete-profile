# Following auto-zoom — prepared November 18, 2026

Service restore point: `16cb488`. Not deployed: user must deploy the pose service from Cloud Shell before fresh verification.

## Implementation

- Probe original frames every 12 frames plus existing sample/tail indices. Existing IMAGE-engine probe retries remain.
- Local box centre/size interpolated per frame, smoothed symmetrically over five frames. Following crops depend on local boxes, never union-path fit.
- Maximum zoom 6x, target 25% body-height fill to leave headroom above 20%. Frame edges clamp crops. Tiny athletes may still fall below 20% at the cap; no unverified guarantee.
- Lazy indexed transforms retain bounded streaming memory and deterministic frame-to-crop association regardless of read order.
- Existing confidence safety backoff reverts to original frames at the unchanged 85% ratio.
- Each frame inverse-mapped through its own crop before recovery, validation, calibration, and metrics. Missing zero points remain zero; world landmarks are preserved untransformed. Recovery checks each frame's crop edge, not the first crop's edge.
- Final fill is measured from accepted original-space detections divided by the used crop height. Report median zoom/fill, crop mode, and analyzer's unchanged reliable-frame percentage through Analysis Log/export.
- No event detection, metric definitions, scoring math or node-config changes. No analyzer deployment required: stored service `auto_zoom` diagnostics already preserve factor/fill/reason; frontend identifies following mode from the recorded reason.

## Before (latest stored runs)

| Clip | Aggregate | Zoom | Final fill (old service) | Reliable frames |
|---|---:|---:|---:|---:|
| Slant Sideline | 94 | 1.75x | 8.53% | 84.6% |
| Curl Sideline | 69 | 1.1262x | 12.96% | 84.5% |
| Corner Sideline | 79 | 1.6079x | 19.01% | 79.5% |
| In Sideline | 98 | 1.75x | 8.13% | 56.3% |
| Post Sideline | 0 | 1x | 12.72% | 29% |

Old fill was probe height/original frame height, not effective post-zoom fill. New fill measures actual accepted body height relative to crop height; mark this reporting change when comparing.

## Verification and pending checks

30 model-free service tests pass (20 framing, 6 streaming, 2 loop, 2 integration). Integration asserts per-frame inverse mapping, missing-point/world preservation and confidence backoff. Python syntax checks pass. 204 app tests passed; preview build OK; original c6fa0895 fba7237f… still matches (94).

Real MediaPipe/crop tracking quality and the five requested after runs remain unverified until user deployment. Then run all five, compare score/fill/reliability, explain changes over five points, inspect In frame 105–155 tracking and Post break/catch events. Do not replace stored baseline.

```bash
cd ~/playcoach-athlete-profile
git pull --ff-only origin main
git log -1 --oneline -- mediapipe-service
grep -n 'MAX_FACTOR = 6.0' mediapipe-service/app/auto_zoom.py
gcloud run deploy mediapipe-service --source mediapipe-service --region us-central1 --update-env-vars SERVICE_BUILD=16cb488
gcloud run services describe mediapipe-service --region us-central1 --format='value(status.latestReadyRevisionName)'
```

Use the actual checkout location if it differs; repo is iaawesmith/playcoach-athlete-profile.