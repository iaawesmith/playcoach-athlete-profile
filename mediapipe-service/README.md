# mediapipe-service

Lightweight Cloud Run pose service using Google's MediaPipe Pose Landmarker
(33 landmarks). Drop-in replacement for the legacy `playcoach-rtmlib-service`.
The response shape matches `CloudRunResponse` in
`supabase/functions/analyze-athlete-video/index.ts`, so cutover is a single
env-var flip — no Edge Function code change.

---

## Endpoints

### `GET /health`
```json
{ "ok": true, "engine": "mediapipe", "model": "pose_landmarker_lite" }
```

### `POST /analyze`
Request body (matches what the Edge Function already sends):
```json
{
  "video_url": "https://...signed-url...mp4",
  "start_seconds": 0.0,
  "end_seconds": 4.5,
  "solution_class": "MediaPipe Pose",
  "performance_mode": "balanced",
  "det_frequency": 2,
  "tracking_enabled": true
}
```

Response: see `app/schema.py` (`AnalyzeResponse`). Coordinates are always in
**original video pixel space** even when auto-zoom is applied (landmarks are
reverse-mapped before return).

---

## Local development

```bash
cd mediapipe-service
docker build -t mediapipe-service:dev .
docker run --rm -p 8080:8080 mediapipe-service:dev
```

Smoke test:
```bash
curl http://localhost:8080/health
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "<signed-url>",
    "start_seconds": 0,
    "end_seconds": 4,
    "det_frequency": 2,
    "tracking_enabled": true
  }'
```

---

## Deploy to Cloud Run

```bash
PROJECT_ID=<your-gcp-project>
REGION=us-central1
SERVICE=mediapipe-service

gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE:latest .

gcloud run deploy $SERVICE \
  --image gcr.io/$PROJECT_ID/$SERVICE:latest \
  --region $REGION \
  --platform managed \
  --cpu 2 \
  --memory 2Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 4 \
  --timeout 300 \
  --allow-unauthenticated
```

Capture the resulting `https://mediapipe-service-xxx.run.app` URL.

---

## Cutover (Edge Function — zero code change)

1. Verify `/health` on the new URL.
2. Side-by-side curl test against the backyard slant signed URL.
3. In Lovable Cloud secrets, set `RTMLIB_URL` = new MediaPipe Cloud Run URL.
   (Optionally also add `MEDIAPIPE_URL` for reference / Phase 1.5 rename.)
4. Re-run the Slant node from AthleteLab. Confirm a row lands in
   `athlete_lab_results` with non-null `aggregate_score`.

### Rollback
Revert the `RTMLIB_URL` secret to the old RTMlib Cloud Run URL. Old service
stays warm and reachable — instant zero-downtime rollback.

---

## Acceptance criteria

1. `docker build` succeeds; image < 1.5 GB.
2. `/health` returns the JSON above.
3. `/analyze` on the backyard slant clip returns 33 keypoints per frame with
   non-null visibility scores.
4. Response validates against `CloudRunResponse` (no missing required fields).
5. `pixels_per_yard` populated when ≥ 6 frames have shoulder + hip visibility
   > 0.7.
6. Auto-zoom does **not** trigger for the backyard slant (athlete already
   fills frame).
7. Warm `/analyze` on a 4-second clip completes in < 12 s end-to-end.
8. Old RTMlib service remains reachable for env-var rollback.

---

## Notes

- CPU-only. No GPU, no torch, no onnxruntime.
- Pose Landmarker Lite (~10 MB) is pre-baked into the image during `docker build`.
- Auto-zoom factor is hard-capped at **1.75x** — intentionally less aggressive
  than the legacy RTMlib service.
- `solution_class`, `performance_mode`, and `tracking_enabled` are accepted
  for request-shape parity but currently ignored (logged only).
